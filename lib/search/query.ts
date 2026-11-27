const queryError = "Use up to four comma-separated phrases. Remove empty phrases or unfinished quotation marks.";

export function parseSearchQuery(query: string): { text: string; exact: boolean }[] {
  const parts = query.trim().split(",");
  if (parts.length > 4) throw new Error(queryError);
  const parsed = parts.map((part) => {
    const value = part.trim();
    const quoted = value.startsWith('"') && value.endsWith('"') && value.length > 2;
    const text = quoted ? value.slice(1, -1).trim() : value;
    if (!text || text.includes('"')) throw new Error(queryError);
    return { text, exact: parts.length > 1 || quoted };
  });
  return parsed.filter((part, index) => parsed.findIndex((p) => p.text.toLowerCase() === part.text.toLowerCase() && p.exact === part.exact) === index);
}

// Commas already make each alternative a phrase. Legacy wrapper quotes are
// unnecessary in the editor; keep single-search matching and invalid edits intact.
export function normalizeSearchAlternatives(query: string): string {
  try {
    const parts = parseSearchQuery(query);
    return parts.length > 1 ? parts.map((part) => part.text).join(", ") : query;
  } catch { return query; }
}

function quote(text: string) { return `"${text.replace(/\\/g, "\\\\")}"`; }
const plainTerm = /^[\p{L}\p{N}_#]+$/u;

// Individual phrase searches are reliable on the tested public endpoint; its
// boolean-query behavior is not assumed. The adapter merges bounded responses.
export function toBlueskyQueries(query: string): string[] {
  return parseSearchQuery(query).map(({ text, exact }) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(text)) return text;
    if (exact) return quote(text);
    return text.split(/\s+/).map((term) => plainTerm.test(term) && !/^(AND|OR|NOT)$/.test(term) ? term : quote(term)).join(" ");
  });
}

const words = (text: string) => text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function matchesSampleQuery(query: string, text: string, topics = "") {
  const textWords = words(text); const searchable = new Set([...textWords, ...words(topics)]);
  return parseSearchQuery(query).some((part) => {
    const terms = words(part.text);
    if (!terms.length) return false;
    return part.exact ? ` ${textWords.join(" ")} `.includes(` ${terms.join(" ")} `) : terms.every((word) => searchable.has(word));
  });
}
