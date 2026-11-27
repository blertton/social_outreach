"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const AnalysisActions = createContext<{ busy: boolean; analyzePost: (id: string) => void } | null>(null);

export function AnalyzePostButton({ resultId, failed }: { resultId: string; failed: boolean }) {
  const actions = useContext(AnalysisActions);
  if (!actions) return null;
  return <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground">One post · one AI request</span>
    <Button type="button" variant="outline" size="lg" disabled={actions.busy} onClick={() => actions.analyzePost(resultId)}>
      {failed ? "Retry post analysis" : "Analyze post"}</Button>
  </div>;
}

export function BatchAnalysis({ searchId, total, complete, pending, failed, children }: {
  searchId: string; total: number; complete: number; pending: number; failed: number; children: ReactNode;
}) {
  const router = useRouter();
  const running = useRef(false); const mounted = useRef(true);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(complete); const [error, setError] = useState("");
  async function run(resultIds?: string[]) {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    let done = complete;
    try {
      for (let batch = 0; batch < (resultIds ? 1 : 4) && mounted.current; batch++) {
        const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchId, retryFailed: true, ...(resultIds ? { resultIds } : {}) }), signal: AbortSignal.timeout(65_000) });
        const body = await response.json();
        if (!mounted.current) return;
        if (!response.ok) {
          const seconds = Number(response.headers.get("Retry-After"));
          throw new Error(`${typeof body.error === "string" ? body.error : "Analysis is unavailable."}${response.status === 429 && Number.isFinite(seconds) && seconds > 0 ? ` Try again in ${Math.ceil(seconds)} seconds.` : ""}`);
        }
        if (!Number.isInteger(body.processed) || body.processed < 0 || body.processed > 5 || !Number.isInteger(body.remaining) || body.remaining < 0 || (body.processed === 0 && body.remaining > 0)) throw new Error("Analysis did not make progress. Please retry.");
        done += body.processed; setProgress(Math.min(total, done));
        if (body.remaining === 0) break;
        if (batch === 3) throw new Error("Some posts still need analysis. Please retry.");
      }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Analysis is unavailable. Your posts are saved; please retry.");
    } finally {
      running.current = false;
      if (mounted.current) { setBusy(false); router.refresh(); }
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  return <AnalysisActions.Provider value={{ busy, analyzePost: (id) => void run([id]) }}>
    <section aria-label="Analysis progress" className="mb-6 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p role="status" className="font-medium">{busy ? `Analyzing posts… ${progress} of ${total} complete` : `${Math.max(complete, progress)} of ${total} posts analyzed`}</p>
          <p className="text-sm text-muted-foreground">{pending + failed > 0 ? `Choose individual posts below, or analyze the remaining ${pending + failed} together.` : "All posts have saved analysis."}</p>
        </div>
        {(busy || pending > 0 || failed > 0 || error) && <Button type="button" size="lg" disabled={busy} onClick={() => void run()}>
          {busy && <LoaderCircle aria-hidden className="animate-spin" />}
          {busy ? "Analyzing…" : error || failed > 0 ? "Retry analysis" : complete > 0 ? "Analyze remaining posts" : "Analyze all posts"}</Button>}
      </div>
      <div aria-hidden className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
        {/* Scale, not width, so the bar animates on the compositor. */}
        <div className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `scaleX(${total ? Math.max(complete, progress) / total : 0})` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{pending + failed > 0 && `Analyze all uses up to ${Math.ceil((pending + failed) / 5)} AI requests, with five posts per request. `}Opening this page uses no AI credits. Saved analysis is reused.</p>
      {error && <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
    </section>
    {children}
  </AnalysisActions.Provider>;
}
