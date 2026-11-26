// Test-only Auth HTTP fixture. Not imported by the app and no production bypass.
import http from "node:http";
import crypto from "node:crypto";

const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated",
  email: "reviewer@example.test", email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
const tokens = new Set();
let refreshCount = 0;
const searches = []; const posts = []; const results = [];
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(short) {
  const expires = Math.floor(Date.now() / 1000) + (short ? 1 : 3600);
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: expires, role: "authenticated", jti: crypto.randomUUID() })}.test_signature`;
  tokens.add(token);
  return { access_token: token, token_type: "bearer", expires_in: short ? 1 : 3600, expires_at: expires,
    refresh_token: "fixture-refresh-token", user };
}
http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const reply = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
  const url = new URL(req.url, "http://127.0.0.1:54329");
  if (url.pathname === "/health") return reply(200, { ready: true });
  if (url.pathname === "/test/status") return reply(200, { refreshCount });
  const authorization = req.headers.authorization?.replace(/^Bearer /, "");
  if (url.pathname.startsWith("/rest/v1/")) {
    const trusted = req.headers.apikey === "sb_secret_test_key";
    if (!trusted && !tokens.has(authorization)) return reply(401, { message: "Invalid session" });
    if (url.pathname === "/rest/v1/rpc/reserve_usage") return reply(200, [{ allowed: true, remaining: 29, retry_after_seconds: 0 }]);
    if (url.pathname === "/rest/v1/rpc/save_search" && trusted) {
      let raw = ""; for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw); const id = crypto.randomUUID();
      searches.push({ id, user_id: input.p_user_id, query: input.p_query, source: input.p_source,
        filtered_count: input.p_filtered, skipped_count: input.p_skipped });
      input.p_posts.forEach((p, rank) => {
        let post = posts.find((row) => row.external_id === p.external_id && row.user_id === input.p_user_id);
        if (!post) { post = { ...p, id: crypto.randomUUID(), user_id: input.p_user_id, source: input.p_source }; posts.push(post); }
        results.push({ id: crypto.randomUUID(), user_id: input.p_user_id, search_id: id, post_id: post.id,
          source: input.p_source, source_text_snapshot: p.text, original_rank: rank, analysis_status: "pending" });
      });
      return reply(200, id);
    }
    if (req.method === "PATCH" && url.pathname === "/rest/v1/search_results" && trusted) {
      let raw = ""; for await (const chunk of req) raw += chunk;
      const updates = JSON.parse(raw);
      const changed = results.filter((row) => [...url.searchParams].every(([field, filter]) => {
        if (filter.startsWith("eq.")) return row[field] === filter.slice(3);
        if (filter.startsWith("neq.")) return row[field] !== filter.slice(4);
        return true;
      }));
      for (const row of changed) Object.assign(row, updates);
      return reply(200, changed);
    }
    if (req.method === "GET") {
      let data = ({ searches, posts, search_results: results })[url.pathname.split("/").at(-1)];
      if (!data) return reply(404, {});
      data = data.filter((row) => row.user_id === user.id);
      for (const [field, filter] of url.searchParams) {
        if (filter.startsWith("eq.")) data = data.filter((row) => row[field] === filter.slice(3));
        if (field === "id" && filter.startsWith("in.(")) data = data.filter((row) => filter.slice(4, -1).split(",").includes(row.id));
      }
      return reply(200, data);
    }
    return reply(403, {});
  }
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    return tokens.has(authorization) ? reply(200, user) : reply(401, { message: "Invalid session" });
  }
  if (url.pathname === "/auth/v1/logout" && req.method === "POST") {
    tokens.delete(authorization); return reply(200, {});
  }
  if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
    return reply(200, { ...user, email_confirmed_at: null, identities: [] });
  }
  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    let body;
    try {
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 5000) return reply(413, {}); }
      body = JSON.parse(raw);
    } catch { return reply(400, {}); }
    if (url.searchParams.get("grant_type") === "refresh_token" && body.refresh_token === "fixture-refresh-token") {
      refreshCount++; return reply(200, session(false));
    }
    if (url.searchParams.get("grant_type") === "password" && body.email === user.email && body.password === "fixture-password") {
      return reply(200, session(true));
    }
    return reply(400, { code: "invalid_credentials", message: "Invalid login credentials" });
  }
  return reply(404, { message: "Fixture endpoint not found" });
}).listen(54329, "127.0.0.1");
