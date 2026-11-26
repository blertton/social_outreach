/** @jest-environment node */
import { normalizeBluesky, bluesky } from "@/lib/sources/bluesky";
import { fixtures } from "@/lib/sources/fixtures";
import { searchInput } from "@/lib/search/schema";

const post = { uri: "at://did:plc:test/app.bsky.feed.post/abc123", author: { did: "did:plc:test", handle: "sample.test" },
  record: { text: "We welcomed a baby", createdAt: "2026-11-20T12:00:00Z" } };

afterEach(() => jest.restoreAllMocks());
test("normalizes source evidence and deduplicates matching URIs", () => {
  const result = normalizeBluesky({ posts: [post, post] });
  expect(result.posts).toHaveLength(1);
  expect(result.posts[0]).toMatchObject({ external_id: post.uri, text: post.record.text, author_id: post.author.did });
  expect(new URL(result.posts[0].url!).hostname).toBe("bsky.app");
});
test.each(["!no-unauthenticated", "!hide", "porn", "sexual", "nudity", "bot"])("filters prohibited labels from either author or post", (val) => {
  expect(normalizeBluesky({ posts: [{ ...post, labels: [{ val }] }] }).filtered).toBe(1);
  expect(normalizeBluesky({ posts: [{ ...post, author: { ...post.author, labels: [{ val }] } }] }).posts).toHaveLength(0);
});
test("skips malformed posts and inconsistent identities without losing valid results", () => {
  const result = normalizeBluesky({ posts: [null, { ...post, uri: "javascript:alert(1)" },
    { ...post, author: { ...post.author, did: "did:plc:someoneelse" } }, post] });
  expect(result.skipped).toBe(3); expect(result.posts).toHaveLength(1);
});
test("does not invent an empty success for malformed source responses", () => {
  expect(() => normalizeBluesky({ error: "unavailable" })).toThrow();
});
test("uses the fixed official host, encoded query, language and bounded first page", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ posts: [post] }) } as Response);
  await bluesky.search("#newbaby & house");
  const url = fetchMock.mock.calls[0][0] as URL;
  expect(url.origin).toBe("https://api.bsky.app");
  expect(url.searchParams.get("q")).toBe("#newbaby & house");
  expect(url.searchParams.get("limit")).toBe("20");
  expect(url.searchParams.has("cursor")).toBe(false);
});
test("propagates provider failures without silently substituting samples", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 429 } as Response);
  await expect(bluesky.search("baby")).rejects.toThrow("Bluesky is unavailable");
});
test("fixture results are synthetic, searchable and have no fake live links", async () => {
  const { posts } = await fixtures.search("baby");
  expect(posts.length).toBeGreaterThan(0);
  expect(posts.every((p) => p.external_id.startsWith("sample:") && p.url === null)).toBe(true);
  expect((await fixtures.search("unmatchablephrase")).posts).toHaveLength(0);
});
test("validates search shape and rejects client-supplied source records", () => {
  expect(searchInput.parse({ query: " baby ", source: "fixtures" }).query).toBe("baby");
  for (const input of [{ query: " ", source: "bluesky" }, { query: "x".repeat(301), source: "bluesky" },
    { query: "baby", source: "other" }, { query: "baby", source: "fixtures", posts: [post] }]) {
    expect(searchInput.safeParse(input).success).toBe(false);
  }
});
