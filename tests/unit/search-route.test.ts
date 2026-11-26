/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/db/admin", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/sources/bluesky", () => ({ bluesky: { search: jest.fn() } }));

import { POST } from "@/app/api/search/route";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { bluesky } from "@/lib/sources/bluesky";

const getUser = jest.fn(); const rpc = jest.fn(); const save = jest.fn();
const id = "00000000-0000-4000-8000-000000000001";
function request(body: unknown = { query: "baby", source: "fixtures" }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/search", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id } }, error: null });
  rpc.mockResolvedValue({ data: [{ allowed: true, remaining: 29, retry_after_seconds: 0 }], error: null });
  save.mockResolvedValue({ data: id, error: null });
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  jest.mocked(createAdminClient).mockReturnValue({ rpc: save } as unknown as ReturnType<typeof createAdminClient>);
});

test("cross-origin calls are denied before session or privileged access", async () => {
  expect((await POST(request(undefined, "https://other.example"))).status).toBe(403);
  expect(createClient).not.toHaveBeenCalled(); expect(createAdminClient).not.toHaveBeenCalled();
});
test.each([{ query: " ", source: "fixtures" }, { query: "baby", source: "fixtures", user_id: "forged" },
  { query: "baby", source: "fixtures", posts: [] }])("untrusted input is rejected before quota or source calls", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(rpc).not.toHaveBeenCalled();
});
test("oversized bodies are rejected", async () => {
  expect((await POST(request({ query: "x".repeat(5000), source: "fixtures" }))).status).toBe(413);
  expect(createClient).not.toHaveBeenCalled();
});
test("anonymous calls cannot reach trusted writes", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401);
  expect(createAdminClient).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
test("quota rejection includes Retry-After and stops external work", async () => {
  rpc.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 15 }], error: null });
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("15");
  expect(createAdminClient).not.toHaveBeenCalled();
});
test("sample search reserves allowance then saves under verified user ownership", async () => {
  const response = await POST(request());
  expect(response.status).toBe(201); expect(await response.json()).toEqual({ searchId: id });
  expect(rpc).toHaveBeenCalledWith("reserve_usage", { p_action: "search" });
  expect(save).toHaveBeenCalledWith("save_search", expect.objectContaining({ p_user_id: id, p_source: "fixtures",
    p_posts: expect.arrayContaining([expect.objectContaining({ url: null, external_id: "sample:new-parent" })]) }));
  expect(bluesky.search).not.toHaveBeenCalled();
});
test("source failures return an explicit error without silently saving fixture data", async () => {
  jest.mocked(bluesky.search).mockRejectedValue(new Error("provider failed"));
  const response = await POST(request({ query: "baby", source: "bluesky" }));
  expect(response.status).toBe(503); expect(save).not.toHaveBeenCalled();
});
test("database failures never produce a successful search ID", async () => {
  save.mockResolvedValue({ data: null, error: { message: "private DB detail" } });
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("private DB detail");
});
