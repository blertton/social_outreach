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
  expect(result.posts[0].url).toBe("https://bsky.app/profile/did:plc:test/post/abc123");
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
test("uses the fixed official host, escaped query, language and bounded candidate page", async () => {
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ posts: [post] }) } as Response);
  await bluesky.search("#newbaby & house");
  const url = fetchMock.mock.calls[0][0] as URL;
  expect(url.origin).toBe("https://api.bsky.app");
  expect(url.searchParams.get("q")).toBe('#newbaby "&" house');
  expect(url.searchParams.get("limit")).toBe("50");
  expect(url.searchParams.has("cursor")).toBe(false);
});

test("alternative searches interleave and deduplicate results without using unreliable boolean syntax", async () => {
  const make = (id: string, text = "baby arrived") => ({ ...post,
    uri: `at://did:plc:test/app.bsky.feed.post/${id}`, record: { ...post.record, text } });
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [make("one"), make("shared"), make("three")] }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [make("two"), make("shared")] }) } as Response);
  const result = await bluesky.search('"baby arrived", "daughter arrived"');
  expect(result.posts.map((p) => p.external_id.split("/").at(-1))).toEqual(["one", "two", "shared", "three"]);
  expect(fetchMock.mock.calls.map((call) => (call[0] as URL).searchParams.get("q"))).toEqual(['"baby arrived"', '"daughter arrived"']);
  expect(fetchMock.mock.calls.every((call) => (call[0] as URL).searchParams.get("limit") === "20")).toBe(true);
});

test("more candidates replace excluded records while the saved-result limit stays 20", () => {
  const candidates = Array.from({ length: 50 }, (_, i) => ({ ...post,
    uri: `at://did:plc:test/app.bsky.feed.post/p${i}`, ...(i < 10 || i >= 40 ? { labels: [{ val: "bot" }] } : {}) }));
  const result = normalizeBluesky({ posts: candidates });
  expect(result.posts).toHaveLength(20); expect(result.filtered).toBe(20);
  expect(result.posts[0].external_id.endsWith("/p10")).toBe(true);
});

test("conflicting duplicate labels cannot let an excluded post through", () => {
  const result = normalizeBluesky({ posts: [post, { ...post, labels: [{ val: "!hide" }] }] });
  expect(result.posts).toHaveLength(0); expect(result.filtered).toBe(1);
});

test("one failed alternative does not pretend that an incomplete search succeeded", async () => {
  jest.spyOn(global, "fetch").mockResolvedValueOnce({ ok: true, json: async () => ({ posts: [post] }) } as Response)
    .mockResolvedValueOnce({ ok: false } as Response);
  await expect(bluesky.search("baby, house")).rejects.toThrow("Bluesky is unavailable");
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
