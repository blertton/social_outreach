"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { searchInput } from "@/lib/search/schema";
import { normalizeSearchAlternatives, parseSearchQuery } from "@/lib/search/query";
import { appendSearchPhrase, suggestionSchema } from "@/lib/search/suggestions";
import type { SourceId } from "@/lib/sources/types";

export function SearchForm({ initialQuery = "", initialSource = "bluesky" }: { initialQuery?: string; initialSource?: SourceId }) {
  const router = useRouter();
  const [query, setQuery] = useState(() => normalizeSearchAlternatives(initialQuery));
  const [source, setSource] = useState<SourceId>(initialSource);
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ phrases: string[]; model: string } | null>(null);
  const submitting = useRef(false); const queryField = useRef<HTMLTextAreaElement>(null);
  const busy = pending || suggesting;

  async function suggest() {
    if (submitting.current) return;
    const parsed = searchInput.safeParse({ query, source });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Enter keywords first."); return; }
    submitting.current = true; setSuggesting(true); setError(""); setSuggestions(null);
    try {
      const response = await fetch("/api/search/suggestions", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: parsed.data.query }), signal: AbortSignal.timeout(50_000) });
      const body = await response.json();
      if (!response.ok) {
        const seconds = Number(response.headers.get("Retry-After"));
        const wait = response.status === 429 && Number.isFinite(seconds) && seconds > 0 ? ` Try again in ${Math.ceil(seconds)} seconds.` : "";
        throw new Error((typeof body.error === "string" ? body.error : "Suggestions are unavailable.") + wait);
      }
      const output = suggestionSchema.safeParse({ phrases: body.phrases });
      if (!output.success || typeof body.model !== "string") throw new Error("Suggestions are unavailable. You can still search with your own keywords.");
      setSuggestions({ phrases: output.data.phrases, model: body.model });
    } catch (failure) {
      setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Suggestions are unavailable. You can still search with your own keywords.");
    } finally { submitting.current = false; setSuggesting(false); }
  }
  let phraseCount = 0;
  try { phraseCount = query.trim() ? parseSearchQuery(query).length : 0; } catch { /* Validation explains incomplete edits. */ }
  const full = phraseCount >= 4;
  return <form className="mt-8 grid gap-6 rounded-xl border bg-card p-4 shadow-xs sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8" onSubmit={async (event) => {
    event.preventDefault(); if (submitting.current) return;
    const parsed = searchInput.safeParse({ query, source });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your search phrases."); return; }
    submitting.current = true; setPending(true); setError("");
    let navigating = false;
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(40_000) });
      const result = await response.json();
      if (!response.ok || !result.searchId) {
        const seconds = Number(response.headers.get("Retry-After"));
        const wait = response.status === 429 && Number.isFinite(seconds) && seconds > 0
          ? ` Try again in ${seconds < 60 ? `${Math.ceil(seconds)} seconds` : `about ${Math.ceil(seconds / 60)} minutes`}.` : "";
        setError((result.error ?? "Search could not be completed.") + wait); return;
      }
      navigating = true;
      router.push(`/searches/${result.searchId}`);
    } catch { setError("Search could not be completed. Please try again."); }
    finally { if (!navigating) { submitting.current = false; setPending(false); } }
  }}>
    <div className="grid min-w-0 content-start gap-4">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="query" className="text-sm font-medium">Keywords or hashtags</label>
          <span className="text-xs tabular-nums text-muted-foreground">{phraseCount} of 4 phrases</span>
        </div>
        <textarea ref={queryField} id="query" name="query" value={query} onChange={(event) => { setQuery(event.target.value); setSuggestions(null); setError(""); }} disabled={busy}
          required rows={4} maxLength={300} aria-describedby="query-help" placeholder="our first home, bought a house"
          className="w-full min-w-0 resize-y rounded-lg border bg-background px-4 py-3 leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" />
        <p id="query-help" className="text-sm leading-relaxed text-muted-foreground">Enter your own topic or hashtags. Separate up to four alternative phrases with commas. No quotation marks needed.</p>
      </div>
      <div className="grid gap-3 border-t pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="lg" disabled={busy || !query.trim() || full} onClick={suggest}>{suggesting ? "Suggesting…" : "Suggest more phrases with AI"}</Button>
          <span className="text-xs leading-relaxed text-muted-foreground">{full ? "All four phrases are in use. Remove one to add a suggestion." : "Optional. Uses one AI request from your allowance."}</span>
        </div>
        {suggestions && <div className="grid gap-3" aria-label="Suggested search phrases">
          <p role="status" className="text-xs text-muted-foreground wrap-break-word">{suggestions.model.startsWith("mock/") ? "Simulated suggestions — no AI inference" : `Suggested by ${suggestions.model}. Review before adding.`}</p>
          <div className="flex flex-wrap gap-2">{suggestions.phrases.map((phrase) => {
            let added = false;
            try { added = parseSearchQuery(query).some((part) => part.text.toLowerCase() === phrase.toLowerCase()); } catch { /* Validation explains incomplete edits. */ }
            return <Button key={phrase} type="button" variant="outline" size="sm" className="h-auto max-w-full whitespace-normal text-left wrap-break-word"
              disabled={busy || added} onClick={() => {
                try { setQuery(appendSearchPhrase(query, phrase)); setError(""); queryField.current?.focus(); }
                catch (failure) { setError(failure instanceof Error ? failure.message : "Edit your search before adding a phrase."); }
              }}>{added ? "Added" : "Add"} “{phrase}”</Button>;
          })}</div>
        </div>}
      </div>
    </div>
    <div className="grid content-start gap-4 lg:border-l lg:pl-8">
      <div className="grid gap-2"><label htmlFor="source" className="text-sm font-medium">Source</label>
        <select id="source" name="source" value={source} onChange={(event) => setSource(event.target.value as SourceId)} disabled={busy}
          className="h-10 rounded-lg border bg-background px-3 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="bluesky">Bluesky — public posts</option><option value="fixtures">Sample data — synthetic examples</option></select>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">Up to 20 search matches. AI analysis is optional: choose individual posts or analyze all after reviewing the results. Nothing is sent automatically.</p>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" disabled={busy} className="h-11 w-full px-6 sm:w-fit lg:w-full">{pending ? "Searching…" : "Search posts"}</Button>
    </div>
  </form>;
}
