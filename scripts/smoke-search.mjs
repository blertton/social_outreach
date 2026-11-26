// Optional live integration smoke check: real Supabase, synthetic posts only.
// Creates one temporary confirmed account, sends no email and removes it (and
// its cascading rows) in finally. Never reads existing users' records.
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const app = new URL(process.env.SMOKE_APP_URL ?? "http://localhost:3000");
const checkAnalysis = process.argv.includes("--analysis");
let userId; let admin;
try {
  if (app.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(app.hostname)) throw new Error("Local app required");
  if (!url || !publicKey || !secret?.startsWith("sb_secret_")) throw new Error("Missing configuration");
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) } };
  admin = createClient(url, secret, options);
  const email = `smoke-${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Temporary account setup failed");
  userId = created.data.user.id;
  const cookies = new Map();
  const client = createServerClient(url, publicKey, {
    cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (values) => { for (const { name, value } of values) cookies.set(name, value); } },
  });
  if ((await client.auth.signInWithPassword({ email, password })).error) throw new Error("Temporary sign-in failed");
  const cookie = [...cookies].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ");
  const searchIds = [];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(new URL("/api/search", app), { method: "POST",
      headers: { Origin: app.origin, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "baby", source: "fixtures" }), signal: AbortSignal.timeout(45_000) });
    if (response.status !== 201) throw new Error(`Local search HTTP ${response.status}`);
    const body = await response.json();
    if (!/^[a-f0-9-]{36}$/.test(body.searchId)) throw new Error("Invalid search ID");
    searchIds.push(body.searchId);
    const saved = await fetch(new URL(`/searches/${body.searchId}`, app), { headers: { Cookie: cookie },
      redirect: "manual", signal: AbortSignal.timeout(45_000) });
    if (saved.status !== 200 || !(await saved.text()).includes("Our daughter arrived yesterday.")) throw new Error("Saved page did not render");
  }
  const { count, error } = await client.from("posts").select("id", { count: "exact", head: true });
  if (error || count !== 2) throw new Error("Canonical post deduplication failed");
  console.log("Real Supabase sign-in, app quota, trusted saving, result rendering and repeated-post deduplication passed using only synthetic data.");
  if (checkAnalysis) {
    const { data: result, error: resultError } = await client.from("search_results").select("*")
      .eq("search_id", searchIds[0]).eq("original_rank", 0).single();
    if (resultError || !result) throw new Error("Analysis smoke failed");
    for (const cached of [false, true]) {
      const response = await fetch(new URL("/api/analysis", app), { method: "POST",
        headers: { Origin: app.origin, Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ resultId: result.id }), signal: AbortSignal.timeout(70_000) });
      const body = await response.json();
      if (response.status !== 200 || body.cached !== cached) throw new Error("Analysis smoke failed");
    }
    const { data: analyzed } = await client.from("search_results").select("*").eq("id", result.id).single();
    const { data: untouched } = await client.from("search_results").select("analysis_status")
      .eq("search_id", searchIds[1]);
    const { data: counters } = await client.from("usage_counters").select("count").eq("action", "ai").eq("period", "day");
    if (analyzed?.analysis_status !== "complete" || analyzed.analysis_model?.startsWith("mock/") ||
      analyzed.analysis?.relevance !== "relevant" || analyzed.analysis?.sensitivity !== "none" ||
      !result.source_text_snapshot.includes(analyzed.analysis?.evidence) ||
      untouched?.length !== 2 || untouched.some((row) => row.analysis_status !== "pending") ||
      counters?.length !== 1 || counters[0].count !== 1) throw new Error("Analysis smoke failed");
    const page = await fetch(new URL(`/searches/${searchIds[0]}`, app), { headers: { Cookie: cookie }, signal: AbortSignal.timeout(45_000) });
    if (page.status !== 200 || !(await page.text()).includes("Standard reply allowed")) throw new Error("Analysis smoke failed");
    console.log("Real app analysis, OpenRouter inference, persisted evidence/RLS, cache reuse without quota and separate-search isolation passed.");
  }
} catch (error) {
  const safe = error instanceof Error && /^(Local search HTTP \d+|Local app required|Missing configuration|Temporary account setup failed|Temporary sign-in failed|Invalid search ID|Saved page did not render|Canonical post deduplication failed|Analysis smoke failed)$/.test(error.message) ? error.message : "Live smoke check could not complete";
  console.error(safe); process.exitCode = 1;
} finally {
  if (userId && admin) {
    try {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      console.log("Temporary test account and its data removed.");
    } catch {
      console.error(`Temporary account cleanup failed; operator cleanup required for ID ${userId}.`); process.exitCode = 1;
    }
  }
}
