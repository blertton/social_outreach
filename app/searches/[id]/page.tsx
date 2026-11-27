import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireReviewer } from "@/lib/auth/session";
import { readSavedAnalysis } from "@/lib/ai/analysis-schema";
import { AnalysisPanel } from "./analysis-panel";
import { blueskyPostUrl } from "@/lib/sources/urls";
import { BatchAnalysis } from "./batch-analysis";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireReviewer();
  const { data: search, error } = await client.from("searches").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Saved search is temporarily unavailable.");
  if (!search) notFound();
  const { data: results, error: resultError } = await client.from("search_results").select("*").eq("search_id", id).eq("user_id", user.id).order("original_rank");
  if (resultError) throw new Error("Results are temporarily unavailable.");
  const postIds = (results ?? []).map((r) => r.post_id);
  const { data: posts, error: postError } = postIds.length
    ? await client.from("posts").select("*").in("id", postIds).eq("user_id", user.id)
    : { data: [], error: null };
  if (postError) throw new Error("Source posts are temporarily unavailable.");
  const byId = new Map((posts ?? []).map((p) => [p.id, p]));
  const reviewed = (results ?? []).map((result) => ({ result,
    analysis: result.analysis_status === "complete" ? readSavedAnalysis(result.analysis, result.source_text_snapshot) : null }));
  const visible = reviewed.filter((r) => r.analysis?.relevance !== "irrelevant")
    .sort((a, b) => Number(b.analysis?.relevance === "relevant") - Number(a.analysis?.relevance === "relevant") || a.result.original_rank - b.result.original_rank);
  const irrelevant = reviewed.filter((r) => r.analysis?.relevance === "irrelevant");
  function renderResult({ result, analysis }: typeof reviewed[number]) {
    const post = byId.get(result.post_id);
    const originalUrl = post?.source === "bluesky" ? blueskyPostUrl(post.external_id, post.author_id) : null;
    return <article key={result.id} className="rounded-xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>@{post?.author_handle ?? "Unavailable author"}</span>
        {post && <time dateTime={post.posted_at}>{new Date(post.posted_at).toISOString().slice(0, 10)}</time>}
      </div>
      <p className="my-5 whitespace-pre-wrap break-words leading-relaxed">{result.source_text_snapshot}</p>
      <AnalysisPanel status={result.analysis_status} model={result.analysis_model} analysis={analysis} />
      {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">View original post</a>}
    </article>;
  }
  return <main className="mx-auto max-w-4xl px-6 py-10">
    <nav aria-label="Search actions" className="flex flex-wrap gap-5 text-sm underline underline-offset-4">
      <Link href="/search">New search</Link>
      <Link href={{ pathname: "/search", query: { query: search.query, source: search.source } }}>Refine search</Link>
    </nav>
    <header className="my-8 border-b pb-6">
      <p className="text-sm font-medium text-muted-foreground">{search.source === "fixtures" ? "Sample data — synthetic examples" : "Bluesky — public posts"}</p>
      <h1 className="mt-3 text-3xl font-semibold">Search results</h1>
      <p className="mt-3 break-words leading-relaxed">{search.query}</p>
      <p className="mt-3 text-sm text-muted-foreground">{results?.length ?? 0} {results?.length === 1 ? "post" : "posts"} · Saved to your workspace</p>
      {!!results?.length && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Contextual analysis starts automatically. Relevant posts appear first; check each explanation against the original text.</p>}
      {(search.filtered_count > 0 || search.skipped_count > 0) && <p className="mt-2 text-sm text-muted-foreground">{search.filtered_count} excluded by source-label policy; {search.skipped_count} invalid records skipped.</p>}
    </header>
    {!results?.length && <p role="status" className="leading-relaxed">No matching posts. Refine your search: try a shorter phrase, add an alternative with a comma, or optionally ask AI for more wording. Sample data only contains a few fixed examples.</p>}
    {!!results?.length && <BatchAnalysis key={id} searchId={id} total={reviewed.length}
      complete={reviewed.filter((r) => r.analysis !== null).length}
      pending={reviewed.filter((r) => r.result.analysis_status === "pending").length}
      failed={reviewed.filter((r) => r.result.analysis_status === "failed").length} />}
    <div className="grid gap-5">{visible.map(renderResult)}</div>
    {irrelevant.length > 0 && <details className="mt-6 rounded-lg border p-4">
      <summary className="cursor-pointer font-medium">Not relevant ({irrelevant.length})</summary>
      <div className="mt-4 grid gap-5">{irrelevant.map(renderResult)}</div>
    </details>}
  </main>;
}
