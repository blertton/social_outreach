# Social Outreach

Find public conversations and prepare thoughtful replies for human review. Nothing is sent automatically.

## Status

Supabase Auth, keyword search, optional AI phrase suggestions and contextual analysis work. Signed-in users can enter any topic, search public Bluesky posts or labelled synthetic samples, and reopen saved results with explanations and evidence. Pending results are automatically analyzed in sequential batches of five. Reply generation and the saved review workflow are the next implementation milestone.

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

Playwright covers signup confirmation, invalid login, sessions, saved-result reload, empty results, throttling/retry guidance, explicit source fallback, duplicate submissions, access control, freeform keywords, optional AI suggestions, plain phrase alternatives, refinement and original-post links. Analysis scenarios verify automatic batches, four sequential calls for 20 posts, cached reloads, failure recovery, relevant-first ordering, collapsed unrelated results, sensitivity handling and mobile layout. Reply review tests will arrive with that feature:

```sh
npx playwright install chromium
npm run test:e2e
```

It builds/starts an isolated production-mode app at http://127.0.0.1:3100 using `.next-e2e`, test-only Auth/Data API HTTP fixtures and server-configured mock analysis limited to exact synthetic examples. Mock results say “Simulated analysis — no AI inference.” This exercises the real SDK, cookies and UI without real accounts/email or paid inference, but fixture persistence is in memory; real PostgreSQL tests and separate hosted smoke checks validate persistence independently. Your dev server can keep running. Browser interception tests UI error handling, not server-to-server inference. Provider unit tests verify actual request construction and invalid/failed responses with mocked HTTP.

Browser behavior follows test-first acceptance checks: write a scenario, observe its intended failure, implement and verify it. For example, the Retry-After scenario first failed because the page omitted the waiting time, then passed after the UI handled the header. Earlier search work began before this workflow preference and is not retroactively claimed as TDD.

## Sign in and create an account

Open `/login` or follow Sign in from the homepage. Create an account at `/signup`; Supabase Auth owns credentials, tokens and verification emails. With email confirmation enabled, confirm the email and return to `/login`. There is no custom password database or test-mode bypass in the app. Supabase's configured Auth throttling applies to sign-in/sign-up; per-user search/AI quotas are separate.

The hosted project was checked with signup enabled and email confirmation required. Configure Supabase Auth's Site URL and allowed redirect URLs for the eventual deployment. `supabase/config.jsonc` permits local signup too; local configuration does not automatically update hosted settings.

Protected pages verify the session on the server as well as in the session-refresh proxy. Unconfirmed or signed-out accounts cannot enter `/search`. Choose Bluesky or Sample data, enter a phrase/hashtag, and open the saved results. Source-label exclusions happen before saving; live failures never silently become samples. At most 20 posts are returned per search. Opening results starts contextual analysis for pending posts.

Enter your own keywords or hashtags for any topic; there is no fixed topic list or required quotation syntax. For example, `daughter arrived, baby arrived` finds either phrase. Use up to four comma-separated alternatives and 300 characters total. The server adds quotation syntax to phrase alternatives when building Bluesky requests; ordinary single searches still match all words. Previously quoted alternatives remain accepted and appear as plain phrases when refined. Boolean operators and field filters are treated as literal text rather than an advanced query language. Choose **Refine search** on results to retain your phrases/source. Empty results offer concrete ways to broaden the search. Sample data remains a small fixed set; its topic aliases support ordinary keywords and alternative phrases match sample text.

Optionally click **Suggest more phrases with AI** after entering a topic. It sends only your query to the configured model, reserves one AI allowance and returns up to three validated literal phrases. You choose **Add** for each phrase, edit the result, then click **Search posts** separately. Nothing replaces your input or starts retrieval automatically. Editing the query clears old suggestions. Duplicate phrases are not added, and the four-phrase/300-character limits still apply. Suggestion failures preserve manual search. Mock-mode suggestions are visibly simulated; the reviewer deployment uses OpenRouter.

Each live search fetches one candidate page of up to 50 posts, or up to four parallel 20-post pages for alternative phrases, under one shared 12-second deadline. Pages are interleaved, deduplicated and label-filtered before selecting up to 20 saved matches. An exclusion on any duplicate keeps that post out. The whole search fails explicitly if any alternative request fails; there is no hidden partial success, pagination or silent source fallback. One submitted search consumes one app search allowance, even when it contains several bounded source requests. Live matching remains controlled by Bluesky; these phrases improve retrieval focus but do not prove personal circumstances or relevance. Use contextual analysis before preparing replies.

Original-post links are derived from the stored AT URI and verified author DID with colons preserved. This also repairs previously saved percent-encoded links when rendered, without rewriting saved records.

Analysis starts automatically after retrieval, sending only the saved query and up to five immutable post texts/result IDs to OpenRouter using `OPENROUTER_MODEL`. The server validates the exact requested ID set, relevance/sensitivity enums, bounded explanations and verbatim evidence excerpts. Each batch is saved atomically with model/prompt provenance. Twenty new posts require four AI attempts. Progress is visible; a failed batch stops further dispatch and exposes **Retry analysis** for pending/failed posts. Relevant results appear first and unrelated results remain inspectable in a collapsed section. Closing the page stops dispatching further batches; nothing is queued in the background.

Analysis belongs to the query-specific search result. The same post in another search has independent analysis; completed results are reused without another quota reservation or inference call. Failures stay distinct from irrelevance. Completed results remain stable; there is no regeneration control yet.

AI assessments require human checking. Relevant ordinary discussions permit standard drafting; bereavement permits only noncommercial condolences; other sensitive, irrelevant or uncertain results block drafting through the shared policy. Draft controls are not implemented yet. Evidence matching validates an excerpt, not the truth of the explanation or resistance to every injection attack. No financial-need scoring or personal profiles are created.

Trusted ingestion requires `SUPABASE_SECRET_KEY` in ignored `.env`; obtain the server secret key for the same project and never prefix it with NEXT_PUBLIC. The privileged client is server-only, reached only after session verification/quota reservation. The database RPC is executable only by the privileged role and saves the complete search atomically. Record reads use the user's session and RLS.

Optional live smoke check, with your local dev server running: `npm run smoke:search`. It creates a temporary confirmed account (without email), submits synthetic searches through the actual app and hosted Supabase, verifies deduplication/rendering and deletes that account and its cascading records. It does not inspect existing users. A failed cleanup reports the temporary ID for operator removal. This explicit command uses hosted infrastructure; ordinary tests do not.

`npm run smoke:analysis` extends that same temporary-account check with one paid synthetic analysis batch through the actual app, atomic persistence, result rendering, cache reuse without quota consumption, and isolation from a second search. Use the real OpenRouter provider for this check; cleanup removes its identity and records even after failure.

`npm run smoke:suggestions` verifies the actual suggestion endpoint with the real model, exactly one AI allowance and no automatically dispatched search. It uses the same temporary-account cleanup. `npm run eval:search` separately makes three paid synthetic-topic requests, including one embedded instruction, and writes its local report under ignored `tmp/`. These small tuning checks do not establish general suggestion quality or injection resistance.

`npm run test:integration` verifies the quota migration in a disposable PostgreSQL 17 Docker container, including real concurrent reservations and permissions. Start Docker Desktop first. The test downloads the official image if needed, exposes no ports, never accepts a hosted connection URL and removes its container afterward.

`npm run eval` explicitly spends inference credits on eight synthetic classification cases and three independent draft cases using the configured model. It has bounded output, no automatic retries and no automatic model fallback. Reports stay in ignored `tmp/`. Passing labels or marker checks does not mean replies passed human quality review: the current model still invented a household size in the spike. These are tuning examples, not a held-out accuracy estimate. Ordinary automated tests require neither live Bluesky nor paid inference.

`npm run eval:analysis` evaluates individual synthetic contextual examples with the diagnostic single-post helper. It covers the same house post against different queries, plant “babies,” grief, hardship and an embedded instruction. `npm run eval:batch` evaluates the production five-post batch prompt in one paid request, including irrelevant and injection-bearing examples. Reports stay in ignored `tmp/`. These checks do not generate or evaluate replies; findings and corrections are recorded in [AI_LOG.md](AI_LOG.md).

## Security and usage limits

Server helpers in `lib/security/gates.ts` verify the session, reserve persistent quota before external work, and fail closed if quota checks fail. The draft helper also requires an owned result and completed relevant analysis, selects a dedicated condolence mode for bereavement, and blocks other sensitive/uncertain cases. Load ownership/analysis from the database, never from a request body's assertions.

The quota migration sets per-account limits of 10 searches/minute and 30/day, plus 20 AI attempts/minute and 100/day (UTC). Each analysis batch counts as one attempt; optional phrase suggestions and future drafting share that allowance. Requests rejected by policy do not spend AI allowance; dispatched attempts count even if the provider fails. Each retry needs a separate reservation. Database locks coordinate across app instances; there is no in-memory-only limiter. The daily AI allowance can be exhausted before the search allowance.

Search, phrase-suggestion and analysis APIs validate origin/input/body size, verify the session and reserve quota before external calls. Analysis loads ownership and the query under session RLS before reservation. The UI shows Retry-After guidance and preserves source text on failure. Inference uses a shared bounded OpenRouter helper with a 20-second deadline, structured validation, no automatic retries and no model fallback. The privileged-only `save_analysis_batch` function validates ownership/evidence for every member, saves at most five together, and never overwrites completed analysis. Simultaneous requests from separate tabs can still spend more than one allowance before the first save. Drafting must use its prepared gate when added. CLI evaluations bypass authenticated app quotas and remain billable developer tooling. Request quotas do not replace the OpenRouter key's spending cap or human review.

## Working with coding agents

Start with [AGENTS.md](AGENTS.md), then applicable guidance:

- [UI and routes](app/AGENTS.md)
- [Shared logic](lib/AGENTS.md)
- [AI behavior](lib/ai/AGENTS.md)
- [Tests](tests/AGENTS.md)

Give an agent one bounded task with an observable outcome. Inspect existing code, implement the smallest coherent change, run relevant checks and report evidence and remaining blockers. Finish the complete saved-review journey before optional features.

## Intended stack and journey

Next.js App Router, TypeScript, Tailwind/shadcn, Supabase PostgreSQL/Auth using its SDK, and one configured OpenRouter model. Auth, search ingestion, contextual analysis, generated types, product schema and RLS are present. Reply generation and review remain to be implemented.

Sign in → search → inspect source and contextual analysis → explicitly generate → edit → approve/reject → save and reopen.

Live Bluesky and Sample data stay visibly separate. Replies are grounded in source text. No personal profiling or vulnerability-based scoring. Approval is an internal saved decision; nothing posts externally.

## Secrets and development notes

Copy `.env.example` to `.env` and replace placeholders with your project URL and public publishable key. `.env` is the single local configuration file and is ignored by Git. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable: Next.js embeds public variables in browser bundles. Runtime validation cannot undo exposure of a wrongly configured public variable.

Run `npm run db:check` for a read-only Auth/Data API connectivity probe. The expected missing-table response confirms reachability, not table permissions, RLS, login or writes. The starter page and deterministic unit tests do not require real credentials. For inference set `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` and `AI_PROVIDER=openrouter` on the server. `AI_PROVIDER=mock` is for deterministic synthetic testing, visibly labelled and never a fallback; use `openrouter` for the reviewer deployment. Requests require structured-output support and set `data_collection=deny`; this does not establish EU residency or a universal retention guarantee.

For migrations, follow [the database workflow](supabase/README.md): log in to the CLI, link the intended project, create versioned SQL in `supabase/migrations/`, preview with `npm run db:push:preview` and apply reviewed changes with `npm run db:push`. No schema changes through the dashboard SQL Editor. Local CLI settings do not automatically configure the hosted project. Migrations cover quotas, review records, trusted search saving, corrected draft transitions and atomic analysis batches; SDK types are generated from the public schema.

AI assistance, evaluation findings, mistakes and corrections are documented in [AI_LOG.md](AI_LOG.md).

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Jest setup](https://nextjs.org/docs/app/guides/testing/jest)
- [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next)
- [OpenRouter structured outputs](https://github.com/OpenRouterTeam/docs/blob/main/guides/features/structured-outputs.mdx)
- [OpenRouter provider routing](https://github.com/OpenRouterTeam/docs/blob/main/guides/routing/provider-selection.mdx)

## Assumptions and remaining work

Assumptions are public English posts, Bluesky-only retrieval and human review. No clarification questions were submitted during the assessment. The core reply-generation/review journey remains the next milestone; further search enhancements are deferred until it works end to end.

Before public deployment, verify hosting/platform requirements, configure Auth redirects and publish a content-deletion contact. An operator can remove canonical posts and their dependent snapshots, analyses and drafts; a deletion request must cover owner copies across accounts. There are no scheduled monitoring, cleanup or keep-alive jobs. The submission also requires the short demo and technical write-up.
