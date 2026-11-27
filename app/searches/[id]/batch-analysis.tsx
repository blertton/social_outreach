"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const AnalysisActions = createContext<{ busy: boolean; analyzePost: (id: string) => void } | null>(null);

export function AnalyzePostButton({ resultId, failed }: { resultId: string; failed: boolean }) {
  const actions = useContext(AnalysisActions);
  if (!actions) return null;
  return <div className="space-y-2">
    <button type="button" disabled={actions.busy} onClick={() => actions.analyzePost(resultId)}
      className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{failed ? "Retry post analysis" : "Analyze post"}</button>
    <p className="text-xs text-muted-foreground">One post · one AI request</p>
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
    <section aria-label="Analysis progress" className="mb-6 space-y-3 rounded-lg border p-4">
    <p role="status" className="text-sm">{busy ? `Analyzing posts… ${progress} of ${total} complete` : `${Math.max(complete, progress)} of ${total} posts analyzed`}</p>
    <p className="text-sm text-muted-foreground">{pending + failed > 0 ? `Choose individual posts below, or analyze the remaining ${pending + failed} together.` : "All posts have saved analysis."}</p>
    <p className="text-xs text-muted-foreground">{pending + failed > 0 && `Analyze all uses up to ${Math.ceil((pending + failed) / 5)} AI requests, with five posts per request. `}Opening this page uses no AI credits. Saved analysis is reused.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(busy || pending > 0 || failed > 0 || error) && <button type="button" disabled={busy} onClick={() => void run()}
      className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{busy ? "Analyzing…" : error || failed > 0 ? "Retry analysis" : complete > 0 ? "Analyze remaining posts" : "Analyze all posts"}</button>}
    </section>
    {children}
  </AnalysisActions.Provider>;
}
