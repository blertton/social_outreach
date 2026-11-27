import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { analyzeBatch } from "@/lib/ai/analysis";
import { requireUser, reserveUsage, GateError } from "@/lib/security/gates";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";

const inputSchema = z.object({ searchId: z.uuid(), retryFailed: z.boolean().optional(),
  resultIds: z.array(z.uuid()).min(1).max(5).refine((ids) => new Set(ids).size === ids.length).optional(),
}).strict();
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const parsed = inputSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) throw new GateError(400, "Choose a valid saved search.");
    const client = await createClient();
    const userId = await requireUser(client);
    const { data: search, error: searchError } = await client.from("searches").select("query")
      .eq("id", parsed.data.searchId).eq("user_id", userId).maybeSingle();
    if (searchError) throw new Error();
    if (!search) throw new GateError(403, "This search is unavailable.");
    const selected = parsed.data.resultIds;
    const statuses = selected || parsed.data.retryFailed ? ["pending", "failed"] : ["pending"];
    let query = client.from("search_results").select("*").eq("search_id", parsed.data.searchId).eq("user_id", userId);
    query = selected ? query.in("id", selected) : query.in("analysis_status", statuses);
    const { data: rows, error } = await query.order("original_rank").limit(selected ? 5 : 20);
    if (error || !rows) throw new Error();
    if (rows.some((r) => r.user_id !== userId || r.search_id !== parsed.data.searchId || (selected ? !selected.includes(r.id) : !statuses.includes(r.analysis_status)))
      || (selected && (rows.length !== selected.length || selected.some((id) => !rows.some((r) => r.id === id))))) throw new GateError(403, "These results are unavailable.");
    const eligible = rows.filter((r) => statuses.includes(r.analysis_status));
    const batch = eligible.slice(0, 5);
    if (!batch.length) return NextResponse.json({ processed: 0, remaining: 0, cached: true }, { headers });
    await reserveUsage(client, "ai");
    const admin = createAdminClient();
    let output: Awaited<ReturnType<typeof analyzeBatch>>;
    try {
      output = await analyzeBatch(search.query, batch.map((r) => ({ id: r.id, text: r.source_text_snapshot,
        source: z.enum(["bluesky", "fixtures"]).parse(r.source) })));
    } catch {
      // A late failure must never overwrite another request's completed result.
      await admin.from("search_results").update({ analysis_status: "failed", analysis: null,
        analysis_error_code: "inference_failed", analyzed_at: null, analysis_model: null, analysis_prompt_version: null })
        .in("id", batch.map((r) => r.id)).eq("search_id", parsed.data.searchId).eq("user_id", userId).neq("analysis_status", "complete");
      throw new Error();
    }
    const { data: saved, error: saveError } = await admin.rpc("save_analysis_batch", {
      p_user_id: userId, p_search_id: parsed.data.searchId, p_results: output.results,
      p_model: output.model, p_prompt_version: output.promptVersion,
    });
    if (saveError || saved === null) throw new Error();
    return NextResponse.json({ processed: batch.length, remaining: eligible.length - batch.length, cached: false }, { headers });
  } catch (error) {
    if (error instanceof GateError) {
      if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Analysis could not be completed. Your post is saved; please retry." }, { status: 503, headers });
  }
}
