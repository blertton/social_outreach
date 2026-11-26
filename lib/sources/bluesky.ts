import { z } from "zod";
import type { SourcePost, SourceProvider, SourceResult } from "./types";

const label = z.object({ val: z.string() });
const post = z.object({
  uri: z.string(),
  author: z.object({ did: z.string().min(1), handle: z.string().min(1), labels: z.array(label).optional() }),
  record: z.object({ text: z.string().min(1).max(10000), createdAt: z.iso.datetime({ offset: true }) }),
  labels: z.array(label).optional(),
});
const excluded = new Set(["!no-unauthenticated", "!hide", "porn", "sexual", "nudity", "bot"]);

export function normalizeBluesky(input: unknown): SourceResult {
  const envelope = z.object({ posts: z.array(z.unknown()).max(100) }).safeParse(input);
  if (!envelope.success) throw new Error("Bluesky returned an invalid response.");
  const posts: SourcePost[] = [];
  const seen = new Set<string>();
  let filtered = 0; let skipped = 0;
  for (const candidate of envelope.data.posts) {
    const parsed = post.safeParse(candidate);
    if (!parsed.success) { skipped++; continue; }
    const p = parsed.data;
    if ([...(p.labels ?? []), ...(p.author.labels ?? [])].some((l) => excluded.has(l.val))) { filtered++; continue; }
    const match = /^at:\/\/(did:[a-z0-9]+:[A-Za-z0-9._:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9]+)$/.exec(p.uri);
    if (!match || match[1] !== p.author.did) { skipped++; continue; }
    if (seen.has(p.uri)) continue;
    seen.add(p.uri);
    posts.push({ external_id: p.uri, author_id: p.author.did, author_handle: p.author.handle,
      text: p.record.text, posted_at: p.record.createdAt,
      url: `https://bsky.app/profile/${encodeURIComponent(p.author.did)}/post/${match[2]}` });
    if (posts.length === 20) break;
  }
  return { posts, filtered, skipped };
}

export const bluesky: SourceProvider = {
  async search(query) {
    const url = new URL("https://api.bsky.app/xrpc/app.bsky.feed.searchPosts");
    url.searchParams.set("q", query); url.searchParams.set("limit", "20");
    url.searchParams.set("lang", "en"); url.searchParams.set("sort", "latest");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("Bluesky is unavailable. Try again later or choose Sample data.");
    return normalizeBluesky(await response.json());
  },
};
