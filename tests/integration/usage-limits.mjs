// Real PostgreSQL checks in a disposable, network-isolated container.
// Never accepts a hosted database URL and never publishes a database port.
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";

const exec = promisify(execFile);
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
let container;
const docker = (args, input) => execFileSync("docker", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], timeout: 120_000 });
const sql = (statement) => docker(["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], statement).trim();
const asUser = (statement, id = owner) => `set role authenticated; set request.jwt.claim.sub = '${id}'; ${statement}`;
const reserve = (action = "ai") => `select row_to_json(r) from public.reserve_usage('${action}') r;`;

try {
  docker(["info", "--format", "{{.ServerVersion}}"]);
  container = docker(["run", "--rm", "-d", "--network", "none", "--label", "social-outreach.test=usage",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]).trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try { docker(["exec", container, "pg_isready", "-U", "postgres"]); ready = true; break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  assert.ok(ready, "Disposable PostgreSQL did not become ready.");
  sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'), ('${other}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;`);
  sql(readFileSync(new URL("../../supabase/migrations/20261126220000_usage_limits.sql", import.meta.url), "utf8"));
  console.log("Migration applied successfully in disposable PostgreSQL 17.");

  assert.throws(() => sql(`set role anon; ${reserve()}`), /permission denied/);
  assert.throws(() => sql(`set role authenticated; ${reserve()}`), /Authentication required/);
  assert.throws(() => sql(asUser(reserve("invalid"))), /Invalid usage action/);
  assert.throws(() => sql(asUser(`insert into public.usage_counters values ('${owner}', 'ai', 'day', now(), 1);`)), /permission denied/);
  assert.throws(() => sql(asUser("update public.usage_counters set count = 1;")), /permission denied/);
  console.log("Anonymous/invalid reservations and direct counter writes denied.");

  const first = JSON.parse(sql(asUser(reserve())));
  assert.equal(first.allowed, true); assert.equal(first.remaining, 99);
  assert.equal(sql(asUser("select count(*) from public.usage_counters;", other)), "0");
  console.log("Reservation decrements quota and RLS hides another user's counters.");

  sql("truncate public.usage_counters;");
  // Avoid a fixed-minute boundary during the concurrent burst.
  const seconds = Number(sql("select extract(second from clock_timestamp());"));
  if (seconds > 40) await new Promise((r) => setTimeout(r, (61 - seconds) * 1000));
  const attempts = await Promise.all(Array.from({ length: 25 }, async () => {
    const { stdout } = await exec("docker", ["exec", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", asUser(reserve())], { timeout: 30_000 });
    return JSON.parse(stdout.trim());
  }));
  assert.equal(attempts.filter((r) => r.allowed).length, 20);
  assert.equal(attempts.filter((r) => !r.allowed).length, 5);
  assert.ok(attempts.filter((r) => !r.allowed).every((r) => r.retry_after_seconds > 0));
  assert.equal(sql("select count from public.usage_counters where period = 'day';"), "20");
  console.log("25 simultaneous AI reservations: exactly 20 allowed, 5 blocked; no daily overcount.");

  sql("truncate public.usage_counters;");
  sql(`insert into public.usage_counters values ('${owner}', 'search', 'day', date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 29);`);
  assert.equal(JSON.parse(sql(asUser(reserve("search")))).remaining, 0);
  const denied = JSON.parse(sql(asUser(reserve("search"))));
  assert.equal(denied.allowed, false); assert.ok(denied.retry_after_seconds > 0);
  assert.equal(sql("select count from public.usage_counters where period = 'day';"), "30");
  console.log("Daily cap blocks additional calls without consuming extra allowance.");

  sql("truncate public.usage_counters;");
  sql(`insert into public.usage_counters values ('${owner}', 'ai', 'day', (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') - interval '1 day', 100),
    ('${owner}', 'ai', 'minute', date_trunc('minute', now()) - interval '2 minutes', 20);`);
  assert.equal(JSON.parse(sql(asUser(reserve()))).allowed, true);
  console.log("Expired minute/day buckets do not block a fresh reservation. All SQL checks passed.");
  sql(readFileSync(new URL("../../supabase/migrations/20261126230000_review_schema.sql", import.meta.url), "utf8"));
  sql(readFileSync(new URL("./review-schema.sql", import.meta.url), "utf8"));
  console.log("Review schema: dedupe, cross-owner constraints/RLS, protected AI fields, review-state resets and deletion cascades passed.");
} finally {
  if (container && /^[a-f0-9]{64}$/.test(container)) docker(["rm", "-f", container]);
}
