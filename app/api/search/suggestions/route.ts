import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { suggestSearchPhrases } from "@/lib/ai/search-suggestions";
import { searchInput } from "@/lib/search/schema";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";
import { GateError, withUsageGate } from "@/lib/security/gates";

const inputSchema = z.object({ query: searchInput.shape.query }).strict();
export const maxDuration = 60;

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const parsed = inputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new GateError(400, "Enter valid keywords or phrases first.");
    const client = await createClient();
    const output = await withUsageGate(client, "ai", () => suggestSearchPhrases(parsed.data.query));
    return NextResponse.json(output, { headers });
  } catch (error) {
    if (error instanceof GateError) {
      if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Search suggestions are unavailable. You can still search with your own keywords." }, { status: 503, headers });
  }
}
