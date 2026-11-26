# Social Outreach

Find public conversations and prepare thoughtful replies for human review. Nothing is sent automatically.

## Status

Supabase Auth and keyword search work. Signed-in users can search public Bluesky posts or labelled synthetic samples, save results and reopen them. Contextual AI analysis and reply review are next; keyword matches are explicitly not presented as analyzed opportunities.

## Run locally

Use Node.js 22 or newer and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. On Windows PowerShell, if execution policy blocks `npm.ps1`, use `npm.cmd` and `npx.cmd` instead of changing the machine execution policy.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
```

Jest uses Next.js's transformer and Testing Library. Unit tests cover Supabase public-key validation, privileged-key rejection, HTTPS requirements and local loopback exceptions. Add business tests as features are built.

```sh
npm test -- --runInBand
```

Playwright has eight Auth/search scenarios covering signup confirmation, invalid login, sessions, saved-result reload, empty results, throttling/retry guidance, explicit source fallback, duplicate submissions, access control and mobile layout. Reply review tests will arrive with that feature:

```sh
npx playwright install chromium
npm run test:e2e
```

It builds/starts an isolated production-mode app at http://127.0.0.1:3100 using `.next-e2e` and test-only Auth/Data API HTTP fixtures. This exercises the real SDK, cookies and UI without real accounts/email, but fixture persistence is in memory; real PostgreSQL tests and the separate hosted smoke check validate persistence independently. Your dev server can keep running. Browser interception tests UI error handling, not server-to-server inference.

Browser behavior follows test-first acceptance checks: write a scenario, observe its intended failure, implement and verify it. For example, the Retry-After scenario first failed because the page omitted the waiting time, then passed after the UI handled the header. Earlier search work began before this workflow preference and is not retroactively claimed as TDD.

## Sign in and create an account

Open `/login` or follow Sign in from the homepage. Create an account at `/signup`; Supabase Auth owns credentials, tokens and verification emails. With email confirmation enabled, confirm the email and return to `/login`. There is no custom password database or test-mode bypass in the app. Supabase's configured Auth throttling applies to sign-in/sign-up; per-user search/AI quotas are separate.

The hosted project was checked with signup enabled and email confirmation required. Configure Supabase Auth's Site URL and allowed redirect URLs for the eventual deployment. `supabase/config.jsonc` now permits local signup too; local configuration does not automatically update hosted settings. The initial reviewer-only assumption was superseded by the user's request for signup.

Protected pages verify the user on the server as well as in the session-refresh proxy. Unconfirmed or signed-out users cannot enter `/search`. Choose Bluesky or Sample data, enter a phrase/hashtag, and open the saved results. Source-label exclusions happen before saving; live failures never silently become samples. At most 20 posts are returned per search. No posts are sent to AI in this flow yet.

Trusted ingestion requires `SUPABASE_SECRET_KEY` in ignored `.env`; obtain the server secret key for the same project and never prefix it with NEXT_PUBLIC. The privileged client is server-only, reached only after session verification/quota reservation. The database RPC is executable only by the privileged role and saves the complete search atomically. Record reads use the user's session and RLS.

Optional live smoke check, with your local dev server running: `npm run smoke:search`. It creates a temporary confirmed account (without email), submits synthetic searches through the actual app and hosted Supabase, verifies deduplication/rendering and deletes that account and its cascading records. It does not inspect existing users. A failed cleanup reports the temporary ID for operator removal. This explicit command uses hosted infrastructure; ordinary tests do not.

`npm run test:integration` verifies the quota migration in a disposable PostgreSQL 17 Docker container, including real concurrent reservations and permissions. Start Docker Desktop first. The test downloads the official image if needed, exposes no ports, never accepts a hosted connection URL and removes its container afterward.

`npm run eval` explicitly spends inference credits on eight synthetic classification cases and three independent draft cases using the configured model. It has bounded output, no automatic retries and no automatic model fallback. Reports stay in ignored `tmp/`. Passing labels or marker checks does not mean replies passed human quality review: the current model still invented a household size in the spike. These are tuning examples, not a held-out accuracy estimate. Ordinary automated tests require neither live Bluesky nor paid inference.

## App safeguards in progress

Server helpers in `lib/security/gates.ts` verify the session, reserve persistent quota before external work, and fail closed if quota checks fail. The draft helper also requires an owned result and completed relevant analysis, selects a dedicated condolence mode for bereavement, and blocks other sensitive/uncertain cases. Load ownership/analysis from the database, never from a request body's assertions.

The prepared quota migration sets per-user limits of 10 searches/minute and 30/day, plus 20 AI attempts/minute and 100/day (UTC). Requests rejected by policy do not spend AI allowance; dispatched attempts count even if the provider fails. Each retry needs a separate reservation. Database locks coordinate across app instances; there is no in-memory-only limiter.

The search API uses the session and quota gate, validates origin/input/body size and returns Retry-After with HTTP 429; the UI displays waiting time without discarding input. Analysis/drafting endpoints are not built yet and must use their corresponding gates when added. Three migrations are applied to amanet with generated SDK types. The CLI model spike is separate from authenticated app quotas and remains billable developer tooling. Request quotas do not replace the OpenRouter key's spending cap or human review.

## Working with coding agents

Start with [AGENTS.md](AGENTS.md), then applicable guidance:

- [UI and routes](app/AGENTS.md)
- [Shared logic](lib/AGENTS.md)
- [AI behavior](lib/ai/AGENTS.md)
- [Tests](tests/AGENTS.md)

Give an agent one bounded task with an observable outcome. Inspect existing code, implement the smallest coherent change, run relevant checks and report evidence and remaining blockers. Finish the complete saved-review journey before optional features.

## Intended stack and journey

Next.js App Router, TypeScript, Tailwind/shadcn, Supabase PostgreSQL/Auth using its SDK, and one inexpensive OpenRouter model. Auth, search ingestion, generated types, product schema and RLS are present. Product analysis/drafting endpoints remain to be implemented.

Sign in → search → inspect source and contextual analysis → explicitly generate → edit → approve/reject → save and reopen.

Live Bluesky and Sample data stay visibly separate. Replies are grounded in source text. No personal profiling or vulnerability-based scoring. Approval is an internal saved decision; nothing posts externally.

## Secrets and development notes

Copy `.env.example` to `.env` and replace placeholders with your project URL and public publishable key. `.env` is the single local configuration file and is ignored by Git. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable: Next.js embeds public variables in browser bundles. Runtime validation cannot undo exposure of a wrongly configured public variable.

Run `npm run db:check` for a read-only Auth/Data API connectivity probe. The expected missing-table response confirms reachability, not table permissions, RLS, login or writes. The starter page and deterministic unit tests do not require real credentials. OpenRouter variables are reserved for the future inference feature.

For migrations, follow [the database workflow](supabase/README.md): log in to the CLI, link the intended project, create versioned SQL in `supabase/migrations/`, preview with `npm run db:push:preview` and apply reviewed changes with `npm run db:push`. No schema changes through the dashboard SQL Editor. Local CLI settings do not automatically configure the hosted project. Three migrations are applied; trusted analysis writes remain to be implemented.

Changes stay local unless committing or pushing is explicitly requested. Optional machine-local notes are not required to build a fresh clone. Record genuine AI assistance, mistakes and corrections in [AI_LOG.md](AI_LOG.md), which belongs in the submitted repository.

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Jest setup](https://nextjs.org/docs/app/guides/testing/jest)
- [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next)

Before submission, add verified integration setup, actual environment variables, model choice, assumptions, limitations and manual content-deletion instructions. Prepare the maximum five-minute demo and one-page write-up, and preserve meaningful commit history.
