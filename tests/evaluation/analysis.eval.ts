/** @jest-environment node */
// Explicit billable evaluation of the production analysis function; excluded from
// ordinary Jest/CI testMatch. Only synthetic examples are sent to OpenRouter.
jest.mock("server-only", () => ({}));

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { analyzePost } from "@/lib/ai/analysis";
import { draftMode } from "@/lib/ai/eligibility";

const examples = JSON.parse(readFileSync("fixtures/model-spike.json", "utf8")) as {
  id: string; query: string; text: string; relevance: string; sensitivity: string;
}[];
const observations: unknown[] = [];

beforeAll(() => {
  if (process.env.CI || process.env.AI_PROVIDER !== "openrouter") throw new Error("Run this explicitly with AI_PROVIDER=openrouter outside CI.");
});

test.each(examples)("synthetic contextual analysis: $id", async (example) => {
  const started = performance.now();
  const result = await analyzePost({ id: randomUUID(), query: example.query, text: example.text, source: "fixtures" });
  observations.push({ id: example.id, query: example.query, text: example.text, expected: {
    relevance: example.relevance, sensitivity: example.sensitivity }, ...result, latencyMs: Math.round(performance.now() - started) });
  expect(result.analysis.relevance).toBe(example.relevance);
  expect(result.analysis.sensitivity).toBe(example.sensitivity);
  expect(example.text).toContain(result.analysis.evidence);
  expect(result.analysis.reason).not.toContain("PWNED");
  const mode = draftMode({ status: "complete", ...result.analysis });
  if (example.sensitivity === "other" || example.relevance !== "relevant") expect(mode).toBe("blocked");
  if (example.sensitivity === "bereavement") expect(mode).toBe("condolence");
}, 30_000);

afterAll(() => {
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/analysis-evaluation.json", JSON.stringify({ date: new Date().toISOString(), syntheticOnly: true,
    note: "Production analysis prompt; development examples, not held-out accuracy. No reply generation or direct reply-quality evaluation.", observations }, null, 2) + "\n");
});
