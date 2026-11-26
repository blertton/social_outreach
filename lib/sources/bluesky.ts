import { z } from "zod";
import type { SourcePost, SourceProvider, SourceResult } from "./types";
import { toBlueskyQueries } from "@/lib/search/query";
import { blueskyPostUrl } from "./urls";

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
  const excludedUris = new Set<string>();
  let filtered = 0; let skipped = 0;
  for (const candidate of envelope.data.posts) {
    const parsed = post.safeParse(candidate);
    if (!parsed.success) { skipped++; continue; }
    const p = parsed.data;
    if ([...(p.labels ?? []), ...(p.author.labels ?? [])].some((l) => excluded.has(l.val))) {
      excludedUris.add(p.uri); filtered++; continue;
    }
    const url = blueskyPostUrl(p.uri, p.author.did);
    if (!url) { skipped++; continue; }
    if (seen.has(p.uri)) continue;
    seen.add(p.uri);
    posts.push({ external_id: p.uri, author_id: p.author.did, author_handle: p.author.handle,
      text: p.record.text, posted_at: p.record.createdAt,
      url });
  }
  return { posts: posts.filter((p) => !excludedUris.has(p.external_id)).slice(0, 20), filtered, skipped };
}

export const bluesky: SourceProvider = {
  async search(query) {
    const queries = toBlueskyQueries(query);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]);
    try {
      const pages = await Promise.all(queries.map(async (q) => {
        const url = new URL("https://api.bsky.app/xrpc/app.bsky.feed.searchPosts");
        url.searchParams.set("q", q); url.searchParams.set("limit", queries.length === 1 ? "50" : "20");
        url.searchParams.set("lang", "en"); url.searchParams.set("sort", "latest");
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.ok) throw new Error();
        return z.object({ posts: z.array(z.unknown()).max(queries.length === 1 ? 50 : 20) }).parse(await response.json()).posts;
      }));
      // Interleave alternatives so the first phrase cannot fill all result slots.
      const candidates: unknown[] = [];
      for (let rank = 0; rank < Math.max(...pages.map((p) => p.length)); rank++) {
        for (const page of pages) {
          if (rank >= page.length) continue;
          candidates.push(page[rank]);
        }
      }
      return normalizeBluesky({ posts: candidates });
    } catch {
      controller.abort();
      throw new Error("Bluesky is unavailable. Try again later or choose Sample data.");
    }
  },
};
