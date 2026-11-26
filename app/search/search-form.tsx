"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SearchForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  return <form className="mt-8 grid max-w-2xl gap-5" onSubmit={async (event) => {
    event.preventDefault(); if (pending) return;
    const data = new FormData(event.currentTarget); setPending(true); setError("");
    try {
      const response = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: data.get("query"), source: data.get("source") }), signal: AbortSignal.timeout(40_000) });
      const result = await response.json();
      if (!response.ok || !result.searchId) {
        const seconds = Number(response.headers.get("Retry-After"));
        const wait = response.status === 429 && Number.isFinite(seconds) && seconds > 0
          ? ` Try again in ${seconds < 60 ? `${Math.ceil(seconds)} seconds` : `about ${Math.ceil(seconds / 60)} minutes`}.` : "";
        setError((result.error ?? "Search could not be completed.") + wait); return;
      }
      router.push(`/searches/${result.searchId}`);
    } catch { setError("Search could not be completed. Please try again."); }
    finally { setPending(false); }
  }}>
    <div className="grid gap-2"><label htmlFor="query" className="text-sm font-medium">Keywords or hashtags</label>
      <input id="query" name="query" required maxLength={300} placeholder="new baby, first home, #newbaby" className="h-12 rounded-lg border px-4 focus-visible:outline-2 focus-visible:outline-ring" />
    </div>
    <div className="grid gap-2"><label htmlFor="source" className="text-sm font-medium">Source</label>
      <select id="source" name="source" className="h-11 rounded-lg border bg-background px-3"><option value="bluesky">Bluesky — public posts</option><option value="fixtures">Sample data — synthetic examples</option></select>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Up to 20 posts per search. Results are keyword matches until contextual analysis is available. Nothing is sent automatically.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending} className="h-11 w-fit px-6">{pending ? "Searching…" : "Search posts"}</Button>
  </form>;
}
