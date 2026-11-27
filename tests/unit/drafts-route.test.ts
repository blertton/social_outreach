/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/db/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/ai/draft", () => ({ ...jest.requireActual("@/lib/ai/draft"), draftReply: jest.fn() }));
import { POST } from "@/app/api/drafts/route";
import { PATCH } from "@/app/api/drafts/[id]/route";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { draftReply } from "@/lib/ai/draft";

const userId = "00000000-0000-4000-8000-000000000002";
const resultId = "00000000-0000-4000-8000-000000000010";
const draftId = "00000000-0000-4000-8000-000000000020";
const text = "Our daughter arrived yesterday.";
const analysis = (overrides = {}) => ({ relevance: "relevant", sensitivity: "none", reason: "A birth announcement.", evidence: text, ...overrides });
const getUser = jest.fn(), rpc = jest.fn(), upsert = jest.fn(), single = jest.fn();
let result: Record<string, unknown> | null; let existing: Record<string, unknown> | null;

function post(body: unknown = { resultId }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/drafts", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
}
function patch(body: unknown, id = draftId) {
  return [new Request(`http://localhost:3000/api/drafts/${id}`, { method: "PATCH", headers: { Origin: "http://localhost:3000" }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id }) }] as const;
}
beforeEach(() => {
  jest.clearAllMocks();
  result = { id: resultId, user_id: userId, search_id: "s", source: "fixtures", source_text_snapshot: text, analysis_status: "complete", analysis: analysis() };
  existing = null;
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  rpc.mockImplementation((name: string) => Promise.resolve(name === "reserve_usage"
    ? { data: [{ allowed: true, remaining: 99, retry_after_seconds: 0 }], error: null }
    : { data: [{ draft_status: "approved", draft_text: "Edited", reviewed_at: "2026-11-27T12:00:00Z", updated_at: "x" }], error: null }));
  const from = jest.fn((table: string) => {
    const chain: Record<string, jest.Mock> = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    chain.maybeSingle.mockResolvedValue({ data: table === "search_results" ? result : table === "searches" ? { query: "new baby" } : existing, error: null });
    return chain;
  });
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  single.mockResolvedValue({ data: { id: draftId, text: "Congratulations!", status: "draft", kind: "standard", model: "test/model", reviewed_at: null }, error: null });
  upsert.mockReturnValue({ select: () => ({ single }) });
  jest.mocked(createAdminClient).mockReturnValue({ from: () => ({ upsert }) } as unknown as ReturnType<typeof createAdminClient>);
  jest.mocked(draftReply).mockResolvedValue({ text: "Congratulations!", kind: "standard", model: "test/model", promptVersion: "reply-standard-v1" });
});
const quotaCalls = () => rpc.mock.calls.filter(([name]) => name === "reserve_usage").length;

test.each([{ resultId: "bad" }, { resultId, mode: "standard" }, { resultId, text: "forged" }, { resultId, user_id: userId }])(
  "rejects forged generation input before authentication or quota", async (body) => {
    expect((await POST(post(body))).status).toBe(400); expect(createClient).not.toHaveBeenCalled();
  });

test("cross-origin and signed-out requests cannot generate", async () => {
  expect((await POST(post(undefined, "https://other.example"))).status).toBe(403);
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await POST(post())).status).toBe(401);
  expect(draftReply).not.toHaveBeenCalled(); expect(quotaCalls()).toBe(0);
});

test.each([
  ["unknown result", null],
  ["pending analysis", { analysis_status: "pending", analysis: null }],
  ["uncertain relevance", { analysis: analysis({ relevance: "uncertain" }) }],
  ["irrelevant", { analysis: analysis({ relevance: "irrelevant" }) }],
  ["other sensitivity", { analysis: analysis({ sensitivity: "other" }) }],
  ["uncertain sensitivity", { analysis: analysis({ sensitivity: "uncertain" }) }],
  ["ungrounded evidence", { analysis: analysis({ evidence: "They have three children." }) }],
])("blocks %s before quota or inference", async (_, change) => {
  result = change === null ? null : { ...result, ...change };
  expect((await POST(post())).status).toBe(403);
  expect(quotaCalls()).toBe(0); expect(draftReply).not.toHaveBeenCalled(); expect(upsert).not.toHaveBeenCalled();
});

test("an existing draft is not replaced without explicit confirmation, and spends no allowance", async () => {
  existing = { id: draftId };
  expect((await POST(post())).status).toBe(409);
  expect(quotaCalls()).toBe(0); expect(draftReply).not.toHaveBeenCalled();
  expect((await POST(post({ resultId, replace: true }))).status).toBe(201);
});

test("eligible results reserve one AI attempt and save a draft owned by the verified user", async () => {
  const response = await POST(post());
  expect(response.status).toBe(201);
  expect((await response.json()).draft).toMatchObject({ id: draftId, status: "draft", kind: "standard" });
  expect(quotaCalls()).toBe(1);
  expect(draftReply).toHaveBeenCalledWith({ mode: "standard", query: "new baby", text, source: "fixtures" });
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: userId, search_result_id: resultId, status: "draft",
    kind: "standard", prompt_version: "reply-standard-v1" }), { onConflict: "search_result_id" });
});

test("bereavement is generated only through condolence mode", async () => {
  result = { ...result, analysis: analysis({ sensitivity: "bereavement" }) };
  await POST(post());
  expect(jest.mocked(draftReply).mock.calls[0][0].mode).toBe("condolence");
});

test("provider or save failures return a generic retryable error", async () => {
  jest.mocked(draftReply).mockRejectedValueOnce(new Error("provider echoed private text"));
  const failed = await POST(post());
  expect(failed.status).toBe(503); expect(JSON.stringify(await failed.json())).not.toContain("private");
  single.mockResolvedValueOnce({ data: null, error: { message: "private" } });
  expect((await POST(post())).status).toBe(503);
});

test.each([
  [{ text: "x", status: "published" }], [{ text: "   ", status: "draft" }], [{ text: "x", status: "draft", user_id: userId }],
  [{ text: "x".repeat(301), status: "approved" }], [{ text: "x", status: "approved", reviewed_by: userId }],
])("rejects invalid review saves before authentication: %j", async (body) => {
  expect((await PATCH(...patch(body))).status).toBe(400); expect(createClient).not.toHaveBeenCalled();
});

test("review saves text and decision together through the owner-scoped RPC, without AI or quota", async () => {
  const response = await PATCH(...patch({ text: "Edited", status: "approved" }));
  expect(response.status).toBe(200);
  expect((await response.json()).draft).toEqual({ id: draftId, text: "Edited", status: "approved", reviewed_at: "2026-11-27T12:00:00Z" });
  expect(rpc).toHaveBeenCalledWith("save_draft_review", { p_draft_id: draftId, p_text: "Edited", p_status: "approved" });
  expect(quotaCalls()).toBe(0); expect(draftReply).not.toHaveBeenCalled();
});

test("long drafts can still be saved for editing, and unknown drafts return 404", async () => {
  expect((await PATCH(...patch({ text: "x".repeat(400), status: "draft" }))).status).toBe(200);
  rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "Draft unavailable" } });
  expect((await PATCH(...patch({ text: "x", status: "draft" }))).status).toBe(404);
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await PATCH(...patch({ text: "x", status: "draft" }))).status).toBe(401);
});
