import { z } from "zod";
import { parseSearchQuery } from "./query";
import { searchInput } from "./schema";

export const suggestionSchema = z.object({ phrases: z.array(
  z.string().trim().min(2).max(80).refine((phrase) => !/[",:\r\n]/.test(phrase), "Use a literal phrase without query operators."),
).min(1).max(3) }).strict();

export function appendSearchPhrase(query: string, phrase: string) {
  const validPhrase = suggestionSchema.parse({ phrases: [phrase] }).phrases[0];
  if (parseSearchQuery(query).some((part) => part.text.toLowerCase() === validPhrase.toLowerCase())) return query;
  const combined = `${query.trim()}, "${validPhrase}"`;
  const parsed = searchInput.safeParse({ query: combined, source: "bluesky" });
  if (!parsed.success) throw new Error("Keep up to four phrases and 300 characters. Edit or remove a phrase before adding another.");
  return parsed.data.query;
}
