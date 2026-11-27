/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/db/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/ai/analysis", () => ({ analyzeBatch: jest.fn() }));
import { POST } from "@/app/api/analysis/route";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { analyzeBatch } from "@/lib/ai/analysis";

const id = "00000000-0000-4000-8000-000000000001", userId = "00000000-0000-4000-8000-000000000002";
const rows = Array.from({ length: 7 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
  user_id: userId, search_id: id, source: "fixtures", source_text_snapshot: "Our baby arrived.", analysis_status: "pending" }));
const getUser = jest.fn(), quota = jest.fn(), from = jest.fn(), read = jest.fn(), search = jest.fn(), save = jest.fn(), update = jest.fn(), filters = jest.fn();
function request(body: unknown = { searchId: id }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/analysis", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  quota.mockResolvedValue({ data: [{ allowed: true, remaining: 99, retry_after_seconds: 0 }], error: null });
  read.mockResolvedValue({ data: rows, error: null }); search.mockResolvedValue({ data: { query: "new baby" }, error: null });
  from.mockImplementation(() => {
    const chain = { select: jest.fn(), eq: jest.fn(), in: jest.fn(), order: jest.fn(), limit: read, maybeSingle: search };
    for (const method of [chain.select, chain.eq, chain.in, chain.order]) method.mockReturnValue(chain);
    return chain;
  });
  save.mockResolvedValue({ data: 5, error: null });
  const writeChain = { eq: filters, in: filters, neq: filters };
  filters.mockReturnValue(writeChain); update.mockReturnValue(writeChain);
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc: quota, from } as unknown as Awaited<ReturnType<typeof createClient>>);
  jest.mocked(createAdminClient).mockReturnValue({ rpc: save, from: () => ({ update }) } as unknown as ReturnType<typeof createAdminClient>);
  jest.mocked(analyzeBatch).mockResolvedValue({ results: rows.slice(0, 5).map((r) => ({ id: r.id, analysis: {
    relevance: "relevant", sensitivity: "none", reason: "A birth announcement.", evidence: r.source_text_snapshot,
  } })), model: "test/model", promptVersion: "analysis-batch-v1" });
});
test.each([{ searchId: "bad" }, { searchId: id, analysis: {} }, { searchId: id, user_id: userId }])("rejects forged input before authentication or quota", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(createClient).not.toHaveBeenCalled();
});
test("origin and request size boundaries stop SDK access", async () => {
  expect((await POST(request(undefined, "https://other.example"))).status).toBe(403);
  expect((await POST(request({ searchId: "x".repeat(2000) }))).status).toBe(413); expect(createClient).not.toHaveBeenCalled();
});
test("signed-out and foreign searches cannot dispatch inference", async () => {
  getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401);
  search.mockResolvedValueOnce({ data: null, error: null });
  expect((await POST(request())).status).toBe(403);
  read.mockResolvedValueOnce({ data: [{ ...rows[0], user_id: "foreign" }], error: null });
  expect((await POST(request())).status).toBe(403); expect(quota).not.toHaveBeenCalled(); expect(analyzeBatch).not.toHaveBeenCalled();
});
test("server selects at most five owned posts and reserves one AI attempt", async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ processed: 5, remaining: 2, cached: false });
  expect(quota).toHaveBeenCalledTimes(1); expect(quota).toHaveBeenCalledWith("reserve_usage", { p_action: "ai" });
  expect(analyzeBatch).toHaveBeenCalledWith("new baby", rows.slice(0, 5).map((r) => ({ id: r.id, text: r.source_text_snapshot, source: "fixtures" })));
  expect(save).toHaveBeenCalledWith("save_analysis_batch", expect.objectContaining({ p_user_id: userId, p_search_id: id }));
});
test("completed searches reuse saved analysis without quota or privileged access", async () => {
  read.mockResolvedValue({ data: [], error: null });
  const response = await POST(request()); expect(await response.json()).toEqual({ processed: 0, remaining: 0, cached: true });
  expect(quota).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled();
});
test("quota denial returns Retry-After without dispatch", async () => {
  quota.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 30 }], error: null });
  const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30");
  expect(analyzeBatch).not.toHaveBeenCalled();
});
test("inference failure marks only that batch retryable without overwriting completed results", async () => {
  jest.mocked(analyzeBatch).mockRejectedValue(new Error("private-provider-detail"));
  const response = await POST(request()); expect(response.status).toBe(503); expect(save).not.toHaveBeenCalled();
  expect(filters).toHaveBeenCalledWith("id", rows.slice(0, 5).map((r) => r.id));
  expect(filters).toHaveBeenCalledWith("user_id", userId); expect(filters).toHaveBeenCalledWith("analysis_status", "complete");
  expect(JSON.stringify(await response.json())).not.toContain("private-provider-detail");
});
test("read or atomic-write errors do not report success", async () => {
  read.mockResolvedValueOnce({ data: null, error: { message: "private" } });
  expect((await POST(request())).status).toBe(503); expect(quota).not.toHaveBeenCalled();
  save.mockResolvedValue({ data: null, error: { message: "private" } });
  expect((await POST(request())).status).toBe(503);
});
