import { Ban, CircleCheck, HeartHandshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { draftMode } from "@/lib/ai/eligibility";
import type { SavedAnalysis } from "@/lib/ai/analysis-schema";
import { AnalyzePostButton } from "./batch-analysis";

const relevance = {
  relevant: { label: "Relevant", dot: "positive" },
  uncertain: { label: "Relevance uncertain", dot: "caution" },
  irrelevant: { label: "Not relevant", dot: "neutral" },
} as const;
const sensitivity = {
  none: { label: "No sensitivity identified", dot: undefined },
  bereavement: { label: "Bereavement", dot: "neutral" },
  other: { label: "Sensitive discussion", dot: "negative" },
  uncertain: { label: "Sensitivity uncertain", dot: "caution" },
} as const;
const policy = {
  standard: { label: "Standard reply allowed", Icon: CircleCheck },
  condolence: { label: "Condolence only — no commercial outreach", Icon: HeartHandshake },
  blocked: { label: "Reply drafting blocked", Icon: Ban },
} as const;

export function AnalysisPanel({ analysis, status, model, resultId }: {
  analysis: SavedAnalysis | null; status: string; model: string | null; resultId: string;
}) {
  if (analysis) {
    const rule = policy[draftMode({ status: "complete", ...analysis })];
    return <section aria-label="Contextual analysis" className="mt-5 grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge dot={relevance[analysis.relevance].dot}>{relevance[analysis.relevance].label}</Badge>
        <Badge dot={sensitivity[analysis.sensitivity].dot}>{sensitivity[analysis.sensitivity].label}</Badge>
      </div>
      <p className="text-sm leading-relaxed">{analysis.reason}</p>
      <p className="text-xs text-muted-foreground">Highlighted in the post: the words this assessment relies on</p>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium"><rule.Icon aria-hidden className="size-4 text-muted-foreground" /><span>{rule.label}</span></p>
        <p className="text-xs text-muted-foreground wrap-break-word">{model?.startsWith("mock/") ? "Simulated analysis — no AI inference" : `AI assessment · ${model ?? "Unknown model"} · Check against the original post`}</p>
      </div>
    </section>;
  }

  return <section aria-label="Contextual analysis" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
    <p className="text-sm text-muted-foreground">{status === "failed" ? "Analysis failed. Retry the remaining posts above." : status === "complete" ? "Saved analysis is unavailable." : "Awaiting contextual analysis"}</p>
    {status !== "complete" && <AnalyzePostButton resultId={resultId} failed={status === "failed"} />}
  </section>;
}
