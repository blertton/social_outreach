import { z } from "zod";

export const savedAnalysisSchema = z.object({
  relevance: z.enum(["relevant", "irrelevant", "uncertain"]),
  sensitivity: z.enum(["none", "bereavement", "other", "uncertain"]),
  reason: z.string().trim().min(1).max(600),
  evidence: z.string().min(1).max(500),
}).strict();

export const analysisOutputSchema = z.object({
  results: z.array(savedAnalysisSchema.extend({ id: z.string().min(1).max(100) })).length(1),
}).strict();

export type SavedAnalysis = z.infer<typeof savedAnalysisSchema>;

// Valid structure is insufficient: require a verbatim excerpt of the reviewed text.
// This checks evidence grounding, not the semantic correctness of the explanation.
export function readSavedAnalysis(value: unknown, text: string): SavedAnalysis | null {
  const parsed = savedAnalysisSchema.safeParse(value);
  return parsed.success && parsed.data.evidence.trim() && text.includes(parsed.data.evidence) ? parsed.data : null;
}
