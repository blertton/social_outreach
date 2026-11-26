import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { withUsageGate, GateError } from "@/lib/security/gates";
import { searchInput } from "@/lib/search/schema";
import { bluesky } from "@/lib/sources/bluesky";
import { fixtures } from "@/lib/sources/fixtures";
import { hasSameOrigin } from "@/lib/security/origin";

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new GateError(400, "A search request is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 4096) { await reader.cancel(); throw new GateError(413, "Search request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

export async function POST(request: Request) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403, headers });
    const parsed = searchInput.safeParse(await readBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Enter 1–300 characters and choose a valid source." }, { status: 400, headers });
    const client = await createClient();
    const id = await withUsageGate(client, "search", async (userId) => {
      const admin = createAdminClient();
      const result = await ({ bluesky, fixtures }[parsed.data.source]).search(parsed.data.query);
      const { data, error } = await admin.rpc("save_search", {
        p_user_id: userId, p_query: parsed.data.query, p_source: parsed.data.source,
        p_posts: result.posts.map((p) => ({ ...p })), p_filtered: result.filtered, p_skipped: result.skipped,
      });
      if (error || !data) throw new Error("Search could not be saved.");
      return data;
    });
    return NextResponse.json({ searchId: id }, { status: 201, headers });
  } catch (error) {
    if (error instanceof GateError) {
      if (error.retryAfterSeconds) headers["Retry-After"] = String(error.retryAfterSeconds);
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Search is unavailable. Please retry, or explicitly choose Sample data if Bluesky is unavailable." }, { status: 503, headers });
  }
}
