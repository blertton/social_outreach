import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireReviewer } from "@/lib/auth/session";

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
  return <main className="mx-auto max-w-4xl px-6 py-10">
    <Link href="/search" className="text-sm underline underline-offset-4">New search</Link>
    <header className="my-8 border-b pb-6">
      <p className="text-sm font-medium text-muted-foreground">{search.source === "fixtures" ? "Sample data — synthetic examples" : "Bluesky — public posts"}</p>
      <h1 className="mt-3 break-words text-3xl font-semibold">Results for “{search.query}”</h1>
      <p className="mt-3 text-sm text-muted-foreground">{results?.length ?? 0} posts · Saved to your workspace</p>
      {(search.filtered_count > 0 || search.skipped_count > 0) && <p className="mt-2 text-sm text-muted-foreground">{search.filtered_count} excluded by source-label policy; {search.skipped_count} invalid records skipped.</p>}
    </header>
    {!results?.length && <p role="status">No matching posts. Try a different phrase or source.</p>}
    <div className="grid gap-5">{results?.map((result) => {
      const post = byId.get(result.post_id);
      return <article key={result.id} className="rounded-xl border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>@{post?.author_handle ?? "Unavailable author"}</span>
          {post && <time dateTime={post.posted_at}>{new Date(post.posted_at).toISOString().slice(0, 10)}</time>}
        </div>
        <p className="my-5 whitespace-pre-wrap break-words leading-relaxed">{result.source_text_snapshot}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Contextual analysis not yet available</span>
          {post?.source === "bluesky" && post.url?.startsWith("https://bsky.app/profile/") && <a href={post.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">View original post</a>}
        </div>
      </article>;
    })}</div>
  </main>;
}
