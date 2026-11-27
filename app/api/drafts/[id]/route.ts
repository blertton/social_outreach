import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { REPLY_LIMIT, replyLength } from "@/lib/ai/draft";
import { GateError, requireUser } from "@/lib/security/gates";
import { hasSameOrigin } from "@/lib/security/origin";
import { readJsonBody } from "@/lib/security/request";

const inputSchema = z.object({
  text: z.string().max(5000).refine((text) => text.trim().length > 0, "Write a reply before saving."),
  status: z.enum(["draft", "approved", "rejected"]),
}).strict().refine((input) => input.status !== "approved" || replyLength(input.text) <= REPLY_LIMIT,
  `Shorten the reply to ${REPLY_LIMIT} characters before approving it.`);

// Saves text and decision together under the user's own session and RLS. No AI
// call or quota: the reviewer's text is stored as written.
export async function PATCH(request: Request, ctx: RouteContext<"/api/drafts/[id]">) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (!hasSameOrigin(request)) throw new GateError(403, "Request origin is not allowed.");
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) throw new GateError(400, "Choose a valid draft.");
    const parsed = inputSchema.safeParse(await readJsonBody(request, 24_576));
    if (!parsed.success) throw new GateError(400, parsed.error.issues[0]?.message ?? "Enter a valid reply and decision.");
    const client = await createClient();
    await requireUser(client);
    const { data, error } = await client.rpc("save_draft_review", { p_draft_id: id, p_text: parsed.data.text, p_status: parsed.data.status });
    if (error?.code === "P0002") throw new GateError(404, "This draft is unavailable.");
    const row = Array.isArray(data) ? data[0] : null;
    if (error || !row) throw new Error();
    return NextResponse.json({ draft: { id, text: row.draft_text, status: row.draft_status, reviewed_at: row.reviewed_at, updated_at: row.updated_at } }, { headers });
  } catch (error) {
    if (error instanceof GateError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    return NextResponse.json({ error: "Your reply could not be saved. Your text is still here; please retry." }, { status: 503, headers });
  }
}
