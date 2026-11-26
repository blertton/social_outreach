/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/db/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/ai/analysis", () => ({ analyzePost: jest.fn() }));

import { POST } from "@/app/api/analysis/route";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { analyzePost } from "@/lib/ai/analysis";

const id = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const saved = { analysis: { relevance: "relevant", sensitivity: "none", reason: "A birth announcement.", evidence: "Our daughter arrived." },
  model: "test/model", promptVersion: "analysis-v1" };
const row = { id, user_id: userId, search_id: id, source: "fixtures", source_text_snapshot: "Our daughter arrived.", analysis_status: "pending", analysis: null };
const getUser = jest.fn(), rpc = jest.fn(), from = jest.fn(), update = jest.fn(), writeFrom = jest.fn(), write = jest.fn();
const readResult = jest.fn(), readSearch = jest.fn();
const filters = jest.fn();
function request(body: unknown = { resultId: id }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/analysis", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  rpc.mockResolvedValue({ data: [{ allowed: true, remaining: 99, retry_after_seconds: 0 }], error: null });
  readResult.mockResolvedValue({ data: { ...row }, error: null });
  readSearch.mockResolvedValue({ data: { query: "new baby" }, error: null });
  from.mockImplementation((table) => {
    const chain = { select: jest.fn(), eq: jest.fn(), maybeSingle: table === "search_results" ? readResult : readSearch };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    return chain;
  });
  write.mockResolvedValue({ data: { id }, error: null });
  const chain = { eq: filters, neq: filters, select: () => chain, maybeSingle: write };
  filters.mockReturnValue(chain); update.mockReturnValue(chain); writeFrom.mockReturnValue({ update });
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  jest.mocked(createAdminClient).mockReturnValue({ from: writeFrom } as unknown as ReturnType<typeof createAdminClient>);
  jest.mocked(analyzePost).mockResolvedValue(saved as Awaited<ReturnType<typeof analyzePost>>);
});

test.each([{ resultId: "invalid" }, { resultId: id, analysis: saved.analysis }, { resultId: id, user_id: userId }])("rejects invalid or forged input", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(createClient).not.toHaveBeenCalled();
});
test("rejects cross-origin and oversized input", async () => {
  expect((await POST(request(undefined, "https://other.example"))).status).toBe(403);
  expect((await POST(request({ resultId: "x".repeat(5000) }))).status).toBe(413);
  expect(createClient).not.toHaveBeenCalled();
});
test("anonymous and foreign results never reach quota or inference", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401);
  readResult.mockResolvedValueOnce({ data: null, error: null });
  expect((await POST(request())).status).toBe(403);
  readResult.mockResolvedValueOnce({ data: { ...row, user_id: "foreign" }, error: null });
  expect((await POST(request())).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled(); expect(analyzePost).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled();
});
test("valid saved analysis is reused without inference, quota or privileged writes", async () => {
  readResult.mockResolvedValue({ data: { ...row, analysis_status: "complete", analysis: saved.analysis }, error: null });
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "complete", cached: true });
  expect(rpc).not.toHaveBeenCalled(); expect(analyzePost).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled();
});
test("corrupt completed analysis fails closed instead of being treated as reusable", async () => {
  readResult.mockResolvedValue({ data: { ...row, analysis_status: "complete", analysis: { ...saved.analysis, evidence: "invented evidence" } }, error: null });
  expect((await POST(request())).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled(); expect(analyzePost).not.toHaveBeenCalled();
});
test("uses stored query and immutable text, then saves with verified ownership", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("reserve_usage", { p_action: "ai" });
  expect(analyzePost).toHaveBeenCalledWith({ id, query: "new baby", text: row.source_text_snapshot, source: "fixtures" });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ analysis_status: "complete", analysis: saved.analysis, analysis_model: "test/model" }));
  expect(filters).toHaveBeenCalledWith("id", id); expect(filters).toHaveBeenCalledWith("user_id", userId);
});
test("quota denial returns retry guidance without inference or writes", async () => {
  rpc.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 42 }], error: null });
  const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("42");
  expect(analyzePost).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled();
});
test("inference failures persist a retryable failure, never irrelevance or raw provider errors", async () => {
  jest.mocked(analyzePost).mockRejectedValue(new Error("private-provider-secret"));
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private-provider-secret");
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ analysis_status: "failed", analysis: null, analysis_error_code: "inference_failed" }));
  expect(filters).toHaveBeenCalledWith("analysis_status", "complete");
});
test("storage failures never report successful analysis", async () => {
  write.mockResolvedValue({ data: null, error: { message: "private-db-detail" } });
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private-db-detail");
});
test("read failures stop before paid inference", async () => {
  readSearch.mockResolvedValue({ data: null, error: { message: "private-db-detail" } });
  expect((await POST(request())).status).toBe(503); expect(rpc).not.toHaveBeenCalled(); expect(analyzePost).not.toHaveBeenCalled();
});
test("a concurrent successful save is reused instead of overwritten", async () => {
  write.mockResolvedValue({ data: null, error: null });
  readResult.mockResolvedValueOnce({ data: row, error: null }).mockResolvedValueOnce({
    data: { ...row, analysis_status: "complete", analysis: saved.analysis }, error: null });
  expect((await POST(request())).status).toBe(200);
  expect(update).toHaveBeenCalledTimes(1);
  expect(filters).toHaveBeenCalledWith("analysis_status", "complete");
});
