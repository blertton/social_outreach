"use client";

import { useEffect, useRef, useState } from "react";

export type SavedDraft = { id: string; text: string; status: string; kind: string; model: string; reviewed_at: string | null };
type Status = "draft" | "approved" | "rejected";

const REPLY_LIMIT = 300;
const statusLabels: Record<string, string> = { draft: "Status: Draft", approved: "Status: Approved", rejected: "Status: Rejected" };
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
  const [draft, setDraft] = useState(initialDraft);
  const [text, setText] = useState(initialDraft?.text ?? "");
  const [pending, setPending] = useState<"" | "generate" | Status>("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const dirty = !!draft && text !== draft.text;
  const count = length(text);
  const label = mode === "condolence" ? "Condolence draft" : "Reply draft";

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function generate() {
    if (busy.current) return;
    const replace = !!draft;
    if (replace && (dirty || draft.status !== "draft") &&
      !window.confirm("Replace the current reply with a new AI draft? Your edits and review decision will be lost.")) return;
    busy.current = true; setPending("generate"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId, ...(replace ? { replace: true } : {}) }), signal: AbortSignal.timeout(65_000) });
      if (!response.ok) throw new Error(await readError(response, "A reply could not be generated. Please retry."));
      const { draft: saved } = await response.json() as { draft: SavedDraft };
      setDraft(saved); setText(saved.text);
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
      const { draft: saved } = await response.json() as { draft: Pick<SavedDraft, "text" | "status" | "reviewed_at"> };
      setDraft({ ...draft, ...saved }); setText(saved.text);
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
  return <section aria-label="Reply review" className="my-5 space-y-3 border-t pt-5">
    {mode === "condolence" && <p className="text-sm font-medium">Condolence only — no products, offers or follow-up.</p>}
    {!draft && <div className="space-y-2">
      <button type="button" onClick={generate} disabled={!!pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pending === "generate" ? "Generating…" : generateLabel}</button>
      <p className="text-xs text-muted-foreground">One AI request. You review and edit before anything is used.</p>
    </div>}
    {draft && <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label htmlFor={`draft-${resultId}`} className="font-medium">{label}</label>
        <span className="font-medium">{statusLabels[draft.status] ?? "Status: Draft"}</span>
      </div>
      <textarea id={`draft-${resultId}`} value={text} onChange={(event) => { setText(event.target.value); setNotice(""); }}
        rows={4} maxLength={5000} disabled={!!pending}
        className="w-full rounded-lg border bg-background p-3 text-sm leading-relaxed" />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{dirty ? <span className="font-medium text-foreground">Unsaved changes</span> : draft.reviewed_at ? `Reviewed ${new Date(draft.reviewed_at).toLocaleString()}` : "Not reviewed yet"}</span>
        <span className={count > REPLY_LIMIT ? "font-medium text-destructive" : ""}>{count} / {REPLY_LIMIT}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => save("approved")} disabled={!!pending || !text.trim() || count > REPLY_LIMIT}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending === "approved" ? "Saving…" : "Approve"}</button>
        <button type="button" onClick={() => save("rejected")} disabled={!!pending || !text.trim()}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{pending === "rejected" ? "Saving…" : "Reject"}</button>
        <button type="button" onClick={() => save("draft")} disabled={!!pending || !text.trim()}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{pending === "draft" ? "Saving…" : "Save draft"}</button>
        <button type="button" onClick={generate} disabled={!!pending}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-50">{pending === "generate" ? "Generating…" : "Regenerate"}</button>
        {draft.status === "approved" && !dirty && <button type="button" onClick={copy}
          className="rounded-md border px-4 py-2 text-sm">Copy reply</button>}
      </div>
      <p className="break-words text-xs text-muted-foreground">{draft.model.startsWith("mock/") ? "Simulated draft — no AI inference" : `AI draft · ${draft.model} · Check every detail against the post`}</p>
      <p className="text-xs text-muted-foreground">Approval only records your decision. Nothing is posted or sent.</p>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </section>;
}
