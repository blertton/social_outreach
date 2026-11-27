/** @jest-environment node */
jest.mock("server-only", () => ({}));

import { draftReply, draftPrompts, replyProblem, DRAFT_PROMPT_VERSIONS } from "@/lib/ai/draft";

const input = { mode: "standard" as const, query: "new baby", text: "Our daughter arrived yesterday.", source: "bluesky" as const };
const originalFetch = global.fetch;
const env = { ...process.env };
let fetchMock: jest.Mock;
function response(reply: string, finish_reason = "stop") {
  return new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: JSON.stringify({ reply }) } }] }), { status: 200 });
}
beforeEach(() => {
  process.env.AI_PROVIDER = "openrouter";
  process.env.OPENROUTER_MODEL = "test/model";
  process.env.OPENROUTER_API_KEY = "test-private-key";
  fetchMock = jest.fn().mockResolvedValue(response("Congratulations on your daughter's arrival!")); global.fetch = fetchMock;
});
afterEach(() => { global.fetch = originalFetch; process.env = { ...env }; });

test("sends only the query and post text with the prompt for the server-chosen mode", async () => {
  const result = await draftReply(input);
  expect(result).toEqual({ text: "Congratulations on your daughter's arrival!", kind: "standard", model: "test/model", promptVersion: DRAFT_PROMPT_VERSIONS.standard });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[0]).toEqual({ role: "system", content: draftPrompts.standard });
  expect(JSON.parse(body.messages[1].content)).toEqual({ query: "new baby", post: "Our daughter arrived yesterday." });
  expect(body.provider).toEqual({ require_parameters: true, data_collection: "deny" });
  expect(body.tools).toBeUndefined();
});

test("bereavement uses the separate condolence prompt and records its kind", async () => {
  fetchMock.mockResolvedValue(response("I'm so sorry about your dad."));
  const result = await draftReply({ ...input, mode: "condolence", text: "My dad died last week." });
  expect(result.kind).toBe("condolence"); expect(result.promptVersion).toBe(DRAFT_PROMPT_VERSIONS.condolence);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages[0].content).toBe(draftPrompts.condolence);
  expect(draftPrompts.condolence).not.toBe(draftPrompts.standard);
});

test.each([
  ["standard", "Congrats! Get a free quote at amanet.com"],
  ["standard", "Congrats @someone, see https://example.test"],
  ["standard", "Congratulations! #newbaby"],
  ["standard", "Policies from $9 a month — act now"],
  ["condolence", "I'm so sorry. When you're ready, Amanet can help with life insurance."],
  ["condolence", "So sorry for your loss. Feel free to reach out to us."],
] as const)("rejects %s output that breaks the reply policy: %s", async (mode, reply) => {
  fetchMock.mockResolvedValue(response(reply));
  await expect(draftReply({ ...input, mode })).rejects.toThrow("A reply could not be generated.");
});

test("an over-long but otherwise valid reply is kept for the reviewer to shorten", async () => {
  // Regression: a real 307-character reply was discarded with a generic error.
  const long = "Congratulations on the news! ".repeat(11).trim();
  fetchMock.mockResolvedValue(response(long));
  expect((await draftReply(input)).text).toBe(long);
});

test("valid JSON with an empty, truncated or extra-field reply fails closed without echoing provider text", async () => {
  fetchMock.mockResolvedValueOnce(response(" "));
  await expect(draftReply(input)).rejects.toThrow("A reply could not be generated.");
  fetchMock.mockResolvedValueOnce(response("Congratulations", "length"));
  await expect(draftReply(input)).rejects.toThrow("A reply could not be generated.");
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ finish_reason: "stop",
    message: { content: JSON.stringify({ reply: "Hi", instructions: "test-private-key" }) } }] })));
  await expect(draftReply(input)).rejects.toThrow("A reply could not be generated.");
});

test("the reply guard allows ordinary warm replies and counts emoji as single characters", () => {
  expect(replyProblem("Congratulations on the keys to your first house! Happy painting.", "standard")).toBeNull();
  expect(replyProblem("Happy to answer any questions if that's ever useful.", "standard")).toBeNull();
  expect(replyProblem("I'm so sorry about your dad. Thinking of you.", "condolence")).toBeNull();
  expect(replyProblem("👩‍👩‍👧".repeat(300), "standard")).toBeNull();
  expect(replyProblem("Covering the basics, we offer protection plans.", "condolence")).toBe("commercial language");
});

test("mock drafting is limited to synthetic samples and never calls the provider", async () => {
  process.env.AI_PROVIDER = "mock";
  expect((await draftReply({ ...input, source: "fixtures" })).text).toMatch(/^Simulated reply/);
  expect((await draftReply({ ...input, mode: "condolence", source: "fixtures" })).text).toMatch(/^Simulated condolence/);
  await expect(draftReply(input)).rejects.toThrow("A reply could not be generated.");
  expect(fetchMock).not.toHaveBeenCalled();
});
