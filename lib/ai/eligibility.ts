import { z } from "zod";

const reviewedAnalysis = z.object({
  status: z.literal("complete"),
  relevance: z.enum(["relevant", "irrelevant", "uncertain"]),
  sensitivity: z.enum(["none", "bereavement", "other", "uncertain"]),
});

// Call with trusted, persisted server analysis, never a browser-supplied decision.
export function draftMode(analysis: unknown): "standard" | "condolence" | "blocked" {
  const parsed = reviewedAnalysis.safeParse(analysis);
  if (!parsed.success || parsed.data.relevance !== "relevant") return "blocked";
  if (parsed.data.sensitivity === "none") return "standard";
  if (parsed.data.sensitivity === "bereavement") return "condolence";
  return "blocked";
}
