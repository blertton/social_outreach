import type { SourcePost, SourceProvider } from "./types";
import { matchesSampleQuery } from "@/lib/search/query";

const examples = [
  { id: "new-parent", author: "sample.parent", text: "Our daughter arrived yesterday. We are exhausted and completely in love.", topics: "new baby newborn parent daughter" },
  { id: "first-home", author: "sample.homeowner", text: "We got the keys to our first house today. Cannot wait to paint the kitchen.", topics: "first home house homeowner buying" },
  { id: "bakery", author: "sample.baker", text: "I opened my first bakery today. A small business and a very big day for me.", topics: "starting business bakery entrepreneur" },
  { id: "parent-advice", author: "sample.dad", text: "New dad here. What questions should I ask when comparing life insurance?", topics: "new baby newborn dad parent insurance advice" },
  { id: "grief", author: "sample.writer", text: "My dad died last week. I keep reaching for the phone to call him.", topics: "losing parent grief bereavement dad" },
];

export const fixtures: SourceProvider = {
  async search(query) {
    const posts: SourcePost[] = examples.filter((p) => matchesSampleQuery(query, p.text, p.topics))
      .map((p) => ({ external_id: `sample:${p.id}`, author_id: `sample:${p.author}`, author_handle: p.author,
        text: p.text, url: null, posted_at: "2026-11-20T12:00:00Z" }));
    return { posts, filtered: 0, skipped: 0 };
  },
};
