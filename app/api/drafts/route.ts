import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { readSavedAnalysis } from "@/lib/ai/analysis-schema";
import { draftReply } from "@/lib/ai/draft";
import { GateError, withDraftGate } from "@/lib/security/gates";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";

// Only a result ID and an explicit overwrite flag: eligibility, text and mode
// always come from saved server records, never from the request.
const inputSchema = z.object({ resultId: z.uuid(), replace: z.boolean().optional() }).strict();
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const parsed = inputSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) throw new GateError(400, "Choose a valid saved result.");
    const client = await createClient();
    let loaded: { userId: string; query: string; text: string; source: "bluesky" | "fixtures" } | undefined;

    const draft = await withDraftGate(client, async (userId) => {
      const { data: result, error } = await client.from("search_results")
        .select("id,user_id,search_id,source,source_text_snapshot,analysis_status,analysis")
        .eq("id", parsed.data.resultId).eq("user_id", userId).maybeSingle();
      if (error) throw new Error();
      if (!result) return null;
      const { data: search, error: searchError } = await client.from("searches").select("query")
        .eq("id", result.search_id).eq("user_id", userId).maybeSingle();
      if (searchError || !search) throw new Error();
      // Checked before quota so a double click cannot silently replace edited text.
      const { data: existing, error: existingError } = await client.from("drafts").select("id")
        .eq("search_result_id", result.id).eq("user_id", userId).maybeSingle();
      if (existingError) throw new Error();
      if (existing && !parsed.data.replace) throw new GateError(409, "A reply already exists. Confirm to replace it.");
      loaded = { userId, query: search.query, text: result.source_text_snapshot, source: z.enum(["bluesky", "fixtures"]).parse(result.source) };
      const analysis = result.analysis_status === "complete" ? readSavedAnalysis(result.analysis, result.source_text_snapshot) : null;
      return { userId: result.user_id, analysis: analysis && { status: "complete", ...analysis } };
    }, async (mode) => {
      if (!loaded) throw new Error();
      const { userId, ...post } = loaded;
      const output = await draftReply({ mode, ...post });
      // Trusted write after session, ownership, eligibility and quota checks. The
      // composite foreign key also rejects a result owned by someone else.
      const { data, error } = await createAdminClient().from("drafts").upsert({
        user_id: userId, search_result_id: parsed.data.resultId, text: output.text, kind: output.kind,
        status: "draft", model: output.model, prompt_version: output.promptVersion,
      }, { onConflict: "search_result_id" }).select("id,text,status,kind,model,reviewed_at").single();
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
