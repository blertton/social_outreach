import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { analyzePost } from "@/lib/ai/analysis";
import { readSavedAnalysis } from "@/lib/ai/analysis-schema";
import { requireUser, reserveUsage, GateError } from "@/lib/security/gates";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";

const inputSchema = z.object({ resultId: z.uuid() }).strict();
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const parsed = inputSchema.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success) throw new GateError(400, "Choose a valid saved result.");
    const client = await createClient();
    const userId = await requireUser(client);
    const { data: result, error } = await client.from("search_results").select("*")
      .eq("id", parsed.data.resultId).eq("user_id", userId).maybeSingle();
    if (error) throw new Error();
    if (!result || result.user_id !== userId) throw new GateError(403, "This result is unavailable.");
    if (result.analysis_status === "complete") {
      if (!readSavedAnalysis(result.analysis, result.source_text_snapshot)) throw new Error();
      return NextResponse.json({ status: "complete", cached: true }, { headers });
    }
    const { data: search, error: searchError } = await client.from("searches").select("query")
      .eq("id", result.search_id).eq("user_id", userId).maybeSingle();
    if (searchError || !search) throw new Error();
    await reserveUsage(client, "ai");
    const admin = createAdminClient();
    let output: Awaited<ReturnType<typeof analyzePost>>;
    try {
      output = await analyzePost({ id: result.id, query: search.query, text: result.source_text_snapshot,
        source: z.enum(["bluesky", "fixtures"]).parse(result.source) });
    } catch {
      // A late failure must never overwrite another request's completed result.
      await admin.from("search_results").update({ analysis_status: "failed", analysis: null,
        analysis_error_code: "inference_failed", analyzed_at: null, analysis_model: null, analysis_prompt_version: null })
        .eq("id", result.id).eq("user_id", userId).neq("analysis_status", "complete");
      throw new Error();
    }
    const { data: saved, error: saveError } = await admin.from("search_results").update({
      analysis_status: "complete", analysis: output.analysis, analysis_model: output.model,
      analysis_prompt_version: output.promptVersion, analyzed_at: new Date().toISOString(), analysis_error_code: null,
    }).eq("id", result.id).eq("user_id", userId).neq("analysis_status", "complete").select("id").maybeSingle();
    if (saveError) throw new Error();
    if (!saved) {
      const { data: winner, error: winnerError } = await client.from("search_results").select("*")
        .eq("id", result.id).eq("user_id", userId).maybeSingle();
      if (winnerError || winner?.analysis_status !== "complete" || !readSavedAnalysis(winner.analysis, result.source_text_snapshot)) throw new Error();
    }
    return NextResponse.json({ status: "complete", cached: false }, { headers });
  } catch (error) {
    if (error instanceof GateError) {
      if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Analysis could not be completed. Your post is saved; please retry." }, { status: 503, headers });
  }
}
