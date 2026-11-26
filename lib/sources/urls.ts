// Build links from validated source identity, including for previously saved URLs.
// Bluesky's profile route expects DID colons intact (did:plc:...), not %3A.
export function blueskyPostUrl(uri: string, authorId: string): string | null {
  const match = /^at:\/\/(did:[a-z0-9]+:[A-Za-z0-9._:%-]+)\/app\.bsky\.feed\.post\/([A-Za-z0-9]+)$/.exec(uri);
  if (!match || match[1] !== authorId) return null;
  return `https://bsky.app/profile/${match[1]}/post/${match[2]}`;
}
