"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUnsavedChanges } from "@/components/unsaved-changes";
import { Check, CircleAlert, Copy, LoaderCircle, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SavedDraft = { id: string; text: string; status: string; kind: string; model: string; reviewed_at: string | null; updated_at: string };
type Status = "draft" | "approved" | "rejected";

const REPLY_LIMIT = 300;
const statusBadges = {
  draft: { label: "Draft", dot: "neutral" },
  approved: { label: "Approved", dot: "positive" },
  rejected: { label: "Rejected", dot: "negative" },
} as const;
const length = (text: string) => [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)].length;

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  const wait = Number(response.headers.get("Retry-After"));
  const message = typeof body.error === "string" ? body.error : fallback;
  return response.status === 429 && wait > 0 ? `${message} Try again in ${wait} seconds.` : message;
}

export function DraftEditor({ resultId, mode, initialDraft }: {
  resultId: string; mode: "standard" | "condolence"; initialDraft: SavedDraft | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [text, setText] = useState(initialDraft?.text ?? "");
  const [pending, setPending] = useState<"" | "generate" | Status>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const dirty = !!draft && text !== draft.text;
  const count = length(text);
  const label = mode === "condolence" ? "Condolence draft" : "Reply draft";

  useUnsavedChanges(resultId, dirty);

  async function generate() {
    if (busy.current) return;
    const replace = !!draft;
    if (replace && (dirty || draft.status !== "draft") &&
      !window.confirm("Replace the current reply with a new AI draft? Your edits and review decision will be lost.")) return;
    busy.current = true; setPending("generate"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, ...(replace ? { replace: true, expectedUpdatedAt: draft.updated_at } : {}) }), signal: AbortSignal.timeout(65_000) });
      if (!response.ok) throw new Error(await readError(response, "A reply could not be generated. Please retry."));
      const { draft: saved } = await response.json() as { draft: SavedDraft };
      setDraft(saved); setText(saved.text);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "A reply could not be generated. Please retry.");
    } finally { busy.current = false; setPending(""); }
  }

  async function save(status: Status) {
    if (busy.current || !draft) return;
    busy.current = true; setPending(status); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/drafts/${draft.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, status }), signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(await readError(response, "Your reply could not be saved. Your text is still here; please retry."));
      const { draft: saved } = await response.json() as { draft: Pick<SavedDraft, "text" | "status" | "reviewed_at" | "updated_at"> };
      setDraft({ ...draft, ...saved }); setText(saved.text);
      router.refresh();
      setNotice(status === "approved" ? "Approved. Copy the reply and post it yourself — nothing is sent automatically." : "Saved.");
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Your reply could not be saved. Your text is still here; please retry.");
    } finally { busy.current = false; setPending(""); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setNotice("Reply copied."); }
    catch { setError("Copy failed. Select the text and copy it manually."); }
  }

  const generateLabel = mode === "condolence" ? "Generate condolence message" : "Generate reply";
  const badge = statusBadges[(draft?.status ?? "draft") as Status] ?? statusBadges.draft;
  const over = count > REPLY_LIMIT;
  return <section aria-label="Reply review" className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-medium">{mode === "condolence" ? "Condolence message" : "Suggested reply"}</h3>
      {draft && <Badge dot={badge.dot}><span className="sr-only">Status: </span>{badge.label}</Badge>}
    </div>
    {mode === "condolence" && <p className="-mt-2 text-sm text-muted-foreground">Condolence only — no products, offers or follow-up</p>}

    {!draft && <div className="grid gap-3">
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">Draft a reply grounded in this post. One AI request — you edit and approve it before anything is used.</p>
      <Button type="button" size="lg" className="h-10 w-full px-4 sm:w-fit" onClick={generate} disabled={!!pending}>
        {pending === "generate" && <LoaderCircle aria-hidden className="animate-spin" />}
        {pending === "generate" ? "Generating…" : generateLabel}</Button>
    </div>}

    {draft && <div className="space-y-2">
      <label htmlFor={`draft-${resultId}`} className="sr-only">{label}</label>
      <textarea id={`draft-${resultId}`} value={text} onChange={(event) => { setText(event.target.value); setNotice(""); }}
        rows={5} maxLength={5000} disabled={!!pending} aria-describedby={`draft-meta-${resultId}`}
        className={`w-full resize-y rounded-lg border bg-card p-3 leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 ${over ? "border-destructive" : ""}`} />
      <div id={`draft-meta-${resultId}`} className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{dirty ? <span className="font-medium text-amber-700 dark:text-amber-300">Unsaved changes</span> : draft.reviewed_at ? <time data-review-time dateTime={draft.reviewed_at}>Reviewed {new Date(draft.reviewed_at).toISOString().slice(0, 19).replace("T", " ")} UTC</time> : "Not reviewed yet"}</span>
        <span className={over ? "font-medium text-destructive" : ""}>{over ? `${count} / ${REPLY_LIMIT} — shorten to approve` : `${count} / ${REPLY_LIMIT}`}</span>
      </div>
    </div>}

    {draft && <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="grid grid-cols-3 gap-2 sm:flex">
        <Button type="button" size="lg" className="h-10 px-4" onClick={() => save("approved")} disabled={!!pending || !text.trim() || over}>
          <Check aria-hidden />{pending === "approved" ? "Saving…" : "Approve"}</Button>
        <Button type="button" size="lg" variant="outline" className="h-10 px-4" onClick={() => save("draft")} disabled={!!pending || !text.trim()}>
          {pending === "draft" ? "Saving…" : "Save draft"}</Button>
        <Button type="button" size="lg" variant="destructive" className="h-10 px-4" onClick={() => save("rejected")} disabled={!!pending || !text.trim()}>
          <X aria-hidden />{pending === "rejected" ? "Saving…" : "Reject"}</Button>
      </div>
      <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex">
        {draft.status === "approved" && !dirty && <Button type="button" size="lg" variant="outline" className="h-10 px-4" onClick={copy}>
          <Copy aria-hidden />Copy reply</Button>}
        <Button type="button" size="lg" variant="ghost" className="h-10 px-4" onClick={generate} disabled={!!pending}>
          <RefreshCw aria-hidden className={pending === "generate" ? "animate-spin" : ""} />{pending === "generate" ? "Generating…" : "Regenerate"}</Button>
      </div>
    </div>}

    {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /><p role="alert">{error}</p>
    </div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}

    {draft && <p className="text-xs leading-relaxed text-muted-foreground wrap-break-word">
      <span>{draft.model.startsWith("mock/") ? "Simulated draft — no AI inference" : `AI draft · ${draft.model} · Check every detail against the post`}</span>
      <span> · Approval only records your decision. Nothing is posted or sent.</span>
    </p>}
  </section>;
}
