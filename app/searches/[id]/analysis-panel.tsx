import { draftMode } from "@/lib/ai/eligibility";
import type { SavedAnalysis } from "@/lib/ai/analysis-schema";

const relevanceLabels = { relevant: "Relevant", irrelevant: "Not relevant", uncertain: "Relevance uncertain" };
const sensitivityLabels = { none: "No sensitivity identified", bereavement: "Bereavement", other: "Sensitive discussion", uncertain: "Sensitivity uncertain" };

export function AnalysisPanel({ analysis, status, model }: {
  analysis: SavedAnalysis | null; status: string; model: string | null;
}) {

  if (analysis) {
    const mode = draftMode({ status: "complete", ...analysis });
    return <section aria-label="Contextual analysis" className="my-5 space-y-3 border-t pt-5">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        <span>{relevanceLabels[analysis.relevance]}</span>
        <span>{sensitivityLabels[analysis.sensitivity]}</span>
      </div>
      <p className="text-sm leading-relaxed">{analysis.reason}</p>
      <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">“{analysis.evidence}”</blockquote>
      <p className="text-sm font-medium">{mode === "standard" ? "Standard reply allowed" : mode === "condolence" ? "Condolence only — no commercial outreach" : "Reply drafting blocked"}</p>
      <p className="break-words text-xs text-muted-foreground">{model?.startsWith("mock/") ? "Simulated analysis — no AI inference" : `AI assessment · ${model ?? "Unknown model"} · Check against the original post`}</p>
    </section>;
  }

  return <section aria-label="Contextual analysis" className="my-5 space-y-3 border-t pt-5">
    <p className="text-sm text-muted-foreground">{status === "failed" ? "Analysis failed. Retry the remaining posts above." : status === "complete" ? "Saved analysis is unavailable." : "Awaiting contextual analysis"}</p>
  </section>;
}
