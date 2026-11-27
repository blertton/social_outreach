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
  return <form className="mt-8 grid max-w-2xl gap-5" onSubmit={async (event) => {
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
    <div className="grid gap-2"><label htmlFor="query" className="text-sm font-medium">Keywords or hashtags</label>
      <textarea ref={queryField} id="query" name="query" value={query} onChange={(event) => { setQuery(event.target.value); setSuggestions(null); setError(""); }} disabled={busy}
        required rows={3} maxLength={300} aria-describedby="query-help" placeholder="e.g. our first home, bought a house" className="w-full min-w-0 resize-y rounded-lg border px-4 py-3 leading-relaxed focus-visible:outline-2 focus-visible:outline-ring" />
      <p id="query-help" className="text-sm leading-relaxed text-muted-foreground">Enter your own topic or hashtags. Separate up to four alternative phrases with commas. No quotation marks needed.</p>
    </div>
    <div className="space-y-3 rounded-lg border p-4">
      <Button type="button" variant="outline" disabled={busy || !query.trim()} onClick={suggest}>{suggesting ? "Suggesting…" : "Suggest more phrases with AI"}</Button>
      <p className="text-xs leading-relaxed text-muted-foreground">Optional. Uses one AI request from your allowance. Suggestions appear here; you choose what to add before searching.</p>
      {suggestions && <div className="space-y-3" aria-label="Suggested search phrases">
        <p role="status" className="break-words text-xs text-muted-foreground">{suggestions.model.startsWith("mock/") ? "Simulated suggestions — no AI inference" : `Suggested by ${suggestions.model}. Review before adding.`}</p>
        <div className="flex flex-wrap gap-2">{suggestions.phrases.map((phrase) => {
          let added = false;
          try { added = parseSearchQuery(query).some((part) => part.text.toLowerCase() === phrase.toLowerCase()); } catch { /* Validation explains incomplete edits. */ }
          return <Button key={phrase} type="button" variant="outline" size="sm" className="h-auto max-w-full whitespace-normal break-words text-left"
            disabled={busy || added} onClick={() => {
              try { setQuery(appendSearchPhrase(query, phrase)); setError(""); queryField.current?.focus(); }
              catch (failure) { setError(failure instanceof Error ? failure.message : "Edit your search before adding a phrase."); }
            }}>{added ? "Added" : "Add"} “{phrase}”</Button>;
        })}</div>
      </div>}
    </div>
    <div className="grid gap-2"><label htmlFor="source" className="text-sm font-medium">Source</label>
      <select id="source" name="source" value={source} onChange={(event) => setSource(event.target.value as SourceId)} disabled={busy} className="h-11 rounded-lg border bg-background px-3"><option value="bluesky">Bluesky — public posts</option><option value="fixtures">Sample data — synthetic examples</option></select>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Up to 20 search matches. Use Analyze post on results to check relevance and context. A life event does not establish insurance need. Nothing is sent automatically.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy} className="h-11 w-fit px-6">{pending ? "Searching…" : "Search posts"}</Button>
  </form>;
}
