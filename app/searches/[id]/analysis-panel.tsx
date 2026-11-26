"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { draftMode } from "@/lib/ai/eligibility";
import type { SavedAnalysis } from "@/lib/ai/analysis-schema";

const relevanceLabels = { relevant: "Relevant", irrelevant: "Not relevant", uncertain: "Relevance uncertain" };
const sensitivityLabels = { none: "No sensitivity identified", bereavement: "Bereavement", other: "Sensitive discussion", uncertain: "Sensitivity uncertain" };

export function AnalysisPanel({ resultId, analysis, status, model }: {
  resultId: string; analysis: SavedAnalysis | null; status: string; model: string | null;
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [state, setState] = useState<"idle" | "pending" | "error" | "saved">("idle");
  const [error, setError] = useState("");

  async function analyze() {
    if (submitting.current) return;
    submitting.current = true;
    setState("pending"); setError("");
    try {
      const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }), signal: AbortSignal.timeout(65_000) });
      const body = await response.json();
      if (!response.ok) {
        const wait = Number(response.headers.get("Retry-After"));
        throw new Error(`${typeof body.error === "string" ? body.error : "Analysis is unavailable."}${response.status === 429 && wait > 0 ? ` Try again in ${wait} seconds.` : ""}`);
      }
      setState("saved");
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Analysis is unavailable. Your post is saved; please retry.");
      setState("error"); submitting.current = false;
    }
  }

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
    <p className="text-sm text-muted-foreground">{status === "failed" ? "Analysis failed. Your post is saved." : status === "complete" ? "Saved analysis is unavailable." : "Not analyzed yet"}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {state === "saved" && <p role="status" className="text-sm">Analysis saved. Refreshing results… <button type="button" className="underline" onClick={() => window.location.reload()}>Reload results</button></p>}
    {status !== "complete" && state !== "saved" && <button type="button" onClick={analyze} disabled={state === "pending"}
      className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50">
      {state === "pending" ? "Analyzing…" : state === "error" || status === "failed" ? "Retry analysis" : "Analyze post"}
    </button>}
    <p className="text-xs text-muted-foreground">Analysis checks this post against your search. Nothing is sent to its author.</p>
  </section>;
}
