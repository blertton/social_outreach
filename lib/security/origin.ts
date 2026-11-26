export function hasSameOrigin(request: Request) {
  try {
    const value = request.headers.get("origin");
    if (!value) return false;
    const origin = new URL(value);
    const host = request.headers.get("host") ?? new URL(request.url).host;
    // Next.js can reconstruct request.url using an internal hostname. Browser
    // Origin must match the actual HTTP Host, never an arbitrary forwarded host.
    return ["http:", "https:"].includes(origin.protocol) && !origin.username && !origin.password &&
      origin.host === host.toLowerCase() && origin.origin === value;
  } catch { return false; }
}
