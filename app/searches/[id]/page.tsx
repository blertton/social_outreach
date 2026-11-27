import { GuardedLink as Link, UnsavedChangesProvider } from "@/components/unsaved-changes";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireReviewer } from "@/lib/auth/session";
import { readSavedAnalysis } from "@/lib/ai/analysis-schema";
import { AnalysisPanel } from "./analysis-panel";
import { blueskyPostUrl } from "@/lib/sources/urls";
import { BatchAnalysis } from "./batch-analysis";
import { DraftEditor } from "./draft-editor";
import { draftMode } from "@/lib/ai/eligibility";
import { ExternalLink } from "lucide-react";
import { AppHeader } from "@/components/app-header";

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
  const resultIds = (results ?? []).map((r) => r.id);
  const { data: drafts, error: draftError } = resultIds.length
    ? await client.from("drafts").select("id,search_result_id,text,status,kind,model,reviewed_at,updated_at").in("search_result_id", resultIds).eq("user_id", user.id)
    : { data: [], error: null };
  if (draftError) throw new Error("Saved replies are temporarily unavailable.");
  const draftsByResult = new Map((drafts ?? []).map((d) => [d.search_result_id, d]));
  const reviewed = (results ?? []).map((result) => ({ result,
    analysis: result.analysis_status === "complete" ? readSavedAnalysis(result.analysis, result.source_text_snapshot) : null }));
  const visible = reviewed.filter((r) => r.analysis?.relevance !== "irrelevant")
    .sort((a, b) => Number(b.analysis?.relevance === "relevant") - Number(a.analysis?.relevance === "relevant") || a.result.original_rank - b.result.original_rank);
  const irrelevant = reviewed.filter((r) => r.analysis?.relevance === "irrelevant");
  function renderResult({ result, analysis }: typeof reviewed[number]) {
    const post = byId.get(result.post_id);
    const originalUrl = post?.source === "bluesky" ? blueskyPostUrl(post.external_id, post.author_id) : null;
    // Same server policy the draft route enforces; the UI only mirrors it.
    const mode = analysis ? draftMode({ status: "complete", ...analysis }) : "blocked";
    const saved = draftsByResult.get(result.id);
    const evidenceAt = analysis ? result.source_text_snapshot.indexOf(analysis.evidence) : -1;
    return <article key={result.id} data-result-id={result.id}
      className="grid overflow-hidden rounded-xl border bg-card shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground">
            <span className="truncate font-medium text-foreground">@{post?.author_handle ?? "Unavailable author"}</span>
            {post && <><span aria-hidden>·</span><time dateTime={post.posted_at} className="tabular-nums">{new Date(post.posted_at).toISOString().slice(0, 10)}</time></>}
          </div>
          {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">
            View original post<ExternalLink aria-hidden className="size-3.5" /></a>}
        </div>
        {/* Signature: the words the assessment relies on are marked inside the post itself. */}
        <p className="mt-4 whitespace-pre-wrap text-[1.0625rem] leading-relaxed wrap-break-word">{evidenceAt >= 0 && analysis ? <>
          {result.source_text_snapshot.slice(0, evidenceAt)}
          <mark className="rounded-sm bg-marker px-0.5 text-foreground">{analysis.evidence}</mark>
          {result.source_text_snapshot.slice(evidenceAt + analysis.evidence.length)}
        </> : result.source_text_snapshot}</p>
        <AnalysisPanel resultId={result.id} status={result.analysis_status} model={result.analysis_model} analysis={analysis} />
      </div>
      <div className="min-w-0 border-t bg-muted/40 p-5 sm:p-6 lg:border-t-0 lg:border-l">
        {mode !== "blocked" ? <DraftEditor resultId={result.id} mode={mode} initialDraft={saved ? {
          id: saved.id, text: saved.text, status: saved.status, kind: saved.kind, model: saved.model, reviewed_at: saved.reviewed_at, updated_at: saved.updated_at } : null} />
          : <div className="flex h-full min-h-24 flex-col justify-center gap-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{analysis ? "No reply suggested" : "Reply waits for analysis"}</p>
            <p className="leading-relaxed">{analysis ? "This post is not a clear, non-sensitive match for your search, so no reply is drafted. Any response is left to your judgement." : "Analyze this post to see whether a reply fits."}</p>
          </div>}
      </div>
    </article>;
  }
  const sourceLabel = search.source === "fixtures" ? "Sample data — synthetic examples" : "Bluesky — public posts";
  return <UnsavedChangesProvider>
    <AppHeader email={user.email} />
    <main className="mx-auto max-w-360 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm text-muted-foreground">{sourceLabel}</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">Search results</h1>
          <p className="mt-2 leading-relaxed wrap-break-word">{search.query}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="tabular-nums">{results?.length ?? 0}</span> {results?.length === 1 ? "post" : "posts"} · Saved to your workspace
            {(search.filtered_count > 0 || search.skipped_count > 0) && <> · {search.filtered_count} excluded by source-label policy; {search.skipped_count} invalid records skipped</>}
          </p>
        </div>
        <Link href={{ pathname: "/search", query: { query: search.query, source: search.source } }}
          className="inline-flex h-9 items-center rounded-lg border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted">Refine search</Link>
      </header>
      {!results?.length && <p role="status" className="rounded-xl border bg-card p-6 leading-relaxed">No matching posts. Refine your search: try a shorter phrase, add an alternative with a comma, or optionally ask AI for more wording. Sample data only contains a few fixed examples.</p>}
      {!!results?.length && <BatchAnalysis key={id} searchId={id} total={reviewed.length}
        complete={reviewed.filter((r) => r.analysis !== null).length}
        pending={reviewed.filter((r) => r.result.analysis_status === "pending").length}
        failed={reviewed.filter((r) => r.result.analysis_status === "failed").length}>
        <p className="mb-4 text-sm text-muted-foreground">Analyze only the posts you choose. Analyzed relevant posts appear first; check each explanation against the original text.</p>
        <div className="grid gap-4">{visible.map(renderResult)}</div>
        {irrelevant.length > 0 && <details className="mt-6 rounded-xl border bg-card p-4">
          <summary className="cursor-pointer font-medium text-muted-foreground">Not relevant ({irrelevant.length})</summary>
          <div className="mt-4 grid gap-4">{irrelevant.map(renderResult)}</div>
        </details>}
      </BatchAnalysis>}
    </main>
  </UnsavedChangesProvider>;
}
