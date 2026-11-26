/** @jest-environment node */
jest.mock("server-only", () => ({}));
import { suggestSearchPhrases } from "@/lib/ai/search-suggestions";
import { appendSearchPhrase } from "@/lib/search/suggestions";

const originalFetch = global.fetch; const env = { ...process.env };
let fetchMock: jest.Mock;
function output(phrases: unknown) {
  return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ phrases }) } }] }));
}
beforeEach(() => {
  process.env.AI_PROVIDER = "openrouter"; process.env.OPENROUTER_MODEL = "test/model"; process.env.OPENROUTER_API_KEY = "test-key";
  fetchMock = jest.fn().mockResolvedValue(output(["adopted a cat", "new rescue cat"])); global.fetch = fetchMock;
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...env }; });

test("any user topic is passed as untrusted data with no fixed topic list or extra metadata", async () => {
  expect(await suggestSearchPhrases("cat adoption")).toEqual({ phrases: ["adopted a cat", "new rescue cat"], model: "test/model" });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(JSON.parse(body.messages[1].content)).toEqual({ query: "cat adoption" });
  expect(body.messages[0].content).toContain("untrusted data");
  expect(body.messages[0].content).toContain("Do not infer");
  expect(body.response_format.json_schema.strict).toBe(true);
  expect(body.tools).toBeUndefined(); expect(fetchMock).toHaveBeenCalledTimes(1);
});
test.each([[], ["one", "two", "three", "four"], [""], ["x".repeat(81)], ['"injected"'], ["one,two"], ["from:someone"], ["one\ntwo"]]
  .map((phrases) => ({ phrases })))("rejects unusable or query-operator suggestions", async ({ phrases }) => {
  fetchMock.mockResolvedValue(output(phrases));
  await expect(suggestSearchPhrases("cat adoption")).rejects.toThrow("Search suggestions are unavailable.");
});
test("deduplicates suggestions and bounds them without silently dispatching search", async () => {
  fetchMock.mockResolvedValue(output(["adopted a cat", "Adopted A Cat"]));
  expect((await suggestSearchPhrases("cats")).phrases).toEqual(["adopted a cat"]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("failure and unfinished output never trigger retries or leak provider details", async () => {
  fetchMock.mockResolvedValueOnce(new Response("private detail", { status: 500 }));
  await expect(suggestSearchPhrases("cats")).rejects.toThrow("Search suggestions are unavailable.");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("adding a suggestion preserves existing keywords, avoids duplicates and enforces search bounds", () => {
  expect(appendSearchPhrase("cat adoption", "new rescue cat")).toBe('cat adoption, "new rescue cat"');
  expect(appendSearchPhrase('"new rescue cat"', "NEW RESCUE CAT")).toBe('"new rescue cat"');
  expect(() => appendSearchPhrase("one,two,three,four", "five")).toThrow("Keep up to four phrases");
  expect(() => appendSearchPhrase("x".repeat(299), "new rescue cat")).toThrow("300 characters");
});
