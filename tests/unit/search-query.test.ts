/** @jest-environment node */
import { toBlueskyQueries, matchesSampleQuery } from "@/lib/search/query";
import { searchInput } from "@/lib/search/schema";

test("comma-separated alternatives become bounded separate phrase queries", () => {
  expect(toBlueskyQueries('new baby, "daughter arrived", #newparent')).toEqual(['"new baby"', '"daughter arrived"', '#newparent']);
  expect(matchesSampleQuery('"baby arrived", "daughter arrived"', "Our daughter arrived yesterday.")).toBe(true);
  expect(matchesSampleQuery('"baby arrived", "daughter arrived"', "Baby clothes on sale.")).toBe(false);
});

test("ordinary searches match all words and quotes request one exact phrase", () => {
  expect(toBlueskyQueries("new baby")).toEqual(["new baby"]);
  expect(toBlueskyQueries('"first house"')).toEqual(['"first house"']);
  expect(matchesSampleQuery("first house", "Our first big house")).toBe(true);
  expect(matchesSampleQuery('"first house"', "Our first big house")).toBe(false);
  expect(matchesSampleQuery('"first house"', "Our first house!")).toBe(true);
  expect(matchesSampleQuery("baby", "Babylon is a city")).toBe(false);
});

test.each(['baby,,home', ',baby', 'baby,', '"baby', 'baby"', '"baby" extra',
  Array.from({ length: 5 }, (_, i) => `phrase${i}`).join(",")])("rejects ambiguous or excessive alternatives: %s", (query) => {
  expect(searchInput.safeParse({ query, source: "bluesky" }).success).toBe(false);
});

test("literal search input cannot inject provider field filters or boolean clauses", () => {
  expect(toBlueskyQueries("from:someone OR secret")).toEqual(['"from:someone" "OR" secret']);
  expect(toBlueskyQueries("baby, home OR from:someone")).toEqual(['"baby"', '"home OR from:someone"']);
});
