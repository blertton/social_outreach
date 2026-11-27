import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { readSavedAnalysis } from "@/lib/ai/analysis-schema";
import { draftReply } from "@/lib/ai/draft";
import { GateError, withDraftGate } from "@/lib/security/gates";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";

// Only a result ID, regeneration confirmation and expected saved version:
// eligibility, text and mode always come from saved server records.
const inputSchema = z.object({ resultId: z.uuid(), replace: z.boolean().optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }).optional(),
}).strict().refine((input) => input.replace ? !!input.expectedUpdatedAt : !input.expectedUpdatedAt);
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const parsed = inputSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) throw new GateError(400, "Choose a valid saved result.");
    const client = await createClient();
    let loaded: { userId: string; query: string; text: string; source: "bluesky" | "fixtures" } | undefined;
    let previous: { id: string; updated_at: string } | null = null;
    const conflict = () => new GateError(409, "This reply has changed. Reload to review the latest saved version before generating again.");

    const draft = await withDraftGate(client, async (userId) => {
      const { data: result, error } = await client.from("search_results")
        .select("id,user_id,search_id,source,source_text_snapshot,analysis_status,analysis")
        .eq("id", parsed.data.resultId).eq("user_id", userId).maybeSingle();
      if (error) throw new Error();
      if (!result) return null;
      const { data: search, error: searchError } = await client.from("searches").select("query")
        .eq("id", result.search_id).eq("user_id", userId).maybeSingle();
      if (searchError || !search) throw new Error();
      // Reject stale regeneration before spending quota; the write checks again atomically.
      const { data: existing, error: existingError } = await client.from("drafts").select("id,updated_at")
        .eq("search_result_id", result.id).eq("user_id", userId).maybeSingle();
      if (existingError) throw new Error();
      if (existing && !parsed.data.replace) throw new GateError(409, "A reply already exists. Confirm to replace it.");
      if (parsed.data.replace && (!existing || existing.updated_at !== parsed.data.expectedUpdatedAt)) throw conflict();
      previous = existing;
      loaded = { userId, query: search.query, text: result.source_text_snapshot, source: z.enum(["bluesky", "fixtures"]).parse(result.source) };
      const analysis = result.analysis_status === "complete" ? readSavedAnalysis(result.analysis, result.source_text_snapshot) : null;
      return { userId: result.user_id, analysis: analysis && { status: "complete", ...analysis } };
    }, async (mode) => {
      if (!loaded) throw new Error();
      const { userId, ...post } = loaded;
      const output = await draftReply({ mode, ...post });
      // Trusted write after session, ownership, eligibility and quota checks. The
      // composite foreign key also rejects a result owned by someone else.
      const values = {
        user_id: userId, search_result_id: parsed.data.resultId, text: output.text, kind: output.kind,
        status: "draft" as const, model: output.model, prompt_version: output.promptVersion,
      };
      const columns = "id,text,status,kind,model,reviewed_at,updated_at";
      const table = createAdminClient().from("drafts");
      const { data, error } = previous
        ? await table.update(values).eq("id", previous.id).eq("user_id", userId)
          .eq("updated_at", previous.updated_at).select(columns).maybeSingle()
        : await table.insert(values).select(columns).single();
      // A unique insert conflict or zero matched versions means newer work won.
      if ((!previous && error?.code === "23505") || (previous && !error && !data)) throw conflict();
      if (error || !data) throw new Error();
      return data;
    });
    return NextResponse.json({ draft }, { status: 201, headers });
  } catch (error) {
    if (error instanceof GateError) {
      if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "A reply could not be generated. Please retry." }, { status: 503, headers });
  }
}
