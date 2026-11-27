"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function BatchAnalysis({ searchId, total, complete, pending, failed }: {
  searchId: string; total: number; complete: number; pending: number; failed: number;
}) {
  const router = useRouter();
  const running = useRef(false); const autoStarted = useRef(false); const mounted = useRef(true);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(complete); const [error, setError] = useState("");
  const run = useCallback(async (retryFailed: boolean, active: () => boolean = () => true) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    let done = complete;
    try {
      for (let batch = 0; batch < 4 && active(); batch++) {
        const response = await fetch("/api/analysis", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchId, retryFailed }), signal: AbortSignal.timeout(65_000) });
        const body = await response.json();
        if (!active()) return;
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
      if (active()) setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Analysis is unavailable. Your posts are saved; please retry.");
    } finally {
      running.current = false;
      if (active()) { setBusy(false); router.refresh(); }
    }
  }, [complete, router, searchId, total]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    // Delay dispatch by one microtask so development Strict Mode cleanup can
    // cancel the first effect without making a duplicate billable request.
    void Promise.resolve().then(() => {
      if (active && pending > 0 && !autoStarted.current) { autoStarted.current = true; void run(false, () => active); }
    });
    return () => { active = false; mounted.current = false; };
  }, [pending, run]);

  return <section aria-label="Analysis progress" className="mb-6 space-y-3 rounded-lg border p-4">
    <p role="status" className="text-sm">{busy ? `Analyzing posts… ${progress} of ${total} complete` : `${Math.max(complete, progress)} of ${total} posts analyzed`}</p>
    <p className="text-xs text-muted-foreground">Five posts per AI request. Saved analysis is reused. Nothing is sent to authors.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {(busy || pending > 0 || failed > 0 || error) && <button type="button" disabled={busy} onClick={() => void run(true, () => mounted.current)}
      className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{busy ? "Analyzing…" : "Retry analysis"}</button>}
  </section>;
}
