/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/ai/search-suggestions", () => ({ suggestSearchPhrases: jest.fn() }));
import { POST } from "@/app/api/search/suggestions/route";
import { createClient } from "@/lib/db/server";
import { suggestSearchPhrases } from "@/lib/ai/search-suggestions";

const getUser = jest.fn(), rpc = jest.fn();
function request(body: unknown = { query: "cat adoption" }, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/search/suggestions", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
}
beforeEach(() => {
  jest.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "verified-user" } }, error: null });
  rpc.mockResolvedValue({ data: [{ allowed: true, remaining: 99, retry_after_seconds: 0 }], error: null });
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  jest.mocked(suggestSearchPhrases).mockResolvedValue({ phrases: ["adopted a cat"], model: "test/model" });
});
test.each([{ query: " " }, { query: "cat", user_id: "forged" }, { query: "cat", AI_PROVIDER: "mock" }, { query: "cat,,home" }])("invalid requests spend no quota", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(createClient).not.toHaveBeenCalled();
});
test("origin and body limits apply before SDK access", async () => {
  expect((await POST(request(undefined, "https://other.example"))).status).toBe(403);
  expect((await POST(request({ query: "x".repeat(5000) }))).status).toBe(413);
  expect(createClient).not.toHaveBeenCalled();
});
test("signed-out users cannot spend AI credits", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await POST(request())).status).toBe(401); expect(rpc).not.toHaveBeenCalled(); expect(suggestSearchPhrases).not.toHaveBeenCalled();
});
test("suggestions reserve AI allowance and never dispatch a search", async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("reserve_usage", { p_action: "ai" });
  expect(suggestSearchPhrases).toHaveBeenCalledWith("cat adoption");
  expect(await response.json()).toEqual({ phrases: ["adopted a cat"], model: "test/model" });
});
test("quota errors return Retry-After without calling the provider", async () => {
  rpc.mockResolvedValue({ data: [{ allowed: false, remaining: 0, retry_after_seconds: 20 }], error: null });
  const response = await POST(request()); expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("20");
  expect(suggestSearchPhrases).not.toHaveBeenCalled();
});
test("external errors are safe and do not disable manual search", async () => {
  jest.mocked(suggestSearchPhrases).mockRejectedValue(new Error("private-provider-detail"));
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Search suggestions are unavailable. You can still search with your own keywords." });
});
