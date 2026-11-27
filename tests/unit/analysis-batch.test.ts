/** @jest-environment node */
jest.mock("server-only", () => ({}));
import { analyzeBatch } from "@/lib/ai/analysis";

const first = { id: "00000000-0000-4000-8000-000000000001", text: "Our baby arrived today.", source: "fixtures" as const };
const second = { id: "00000000-0000-4000-8000-000000000002", text: "My plant had a baby.", source: "fixtures" as const };
const rows = [
  { id: first.id, relevance: "relevant", sensitivity: "none", reason: "A birth announcement.", evidence: first.text },
  { id: second.id, relevance: "irrelevant", sensitivity: "none", reason: "A plant, not a human newborn.", evidence: second.text },
];
const env = { ...process.env }; const originalFetch = global.fetch;
let fetchMock: jest.Mock;
beforeEach(() => {
  process.env.AI_PROVIDER = "openrouter"; process.env.OPENROUTER_MODEL = "test/model"; process.env.OPENROUTER_API_KEY = "test-key";
  fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ results: rows.toReversed() }) } }] })));
  global.fetch = fetchMock;
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...env }; });
test("a batch uses one inference call and matches results by ID rather than returned order", async () => {
  const result = await analyzeBatch("new baby", [first, second]);
  expect(result.results.map((r) => r.id)).toEqual([first.id, second.id]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(JSON.parse(body.messages[1].content)).toEqual({ query: "new baby", posts: [
    { id: first.id, text: first.text }, { id: second.id, text: second.text },
  ] });
});
test.each([rows.slice(0, 1), [rows[0], rows[0]], [rows[0], { ...rows[1], id: "unknown" }],
  [rows[0], { ...rows[1], evidence: first.text }]].map((results) => ({ results })))("rejects the entire batch on missing, duplicate, unknown IDs or misplaced evidence", async ({ results }) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ results }) } }] })));
  await expect(analyzeBatch("new baby", [first, second])).rejects.toThrow();
});
test("rejects duplicate inputs or more than five posts before dispatch", async () => {
  await expect(analyzeBatch("new baby", [first, first])).rejects.toThrow();
  await expect(analyzeBatch("new baby", Array(6).fill(first))).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
