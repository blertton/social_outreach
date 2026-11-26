# AI assistance log

## 2026-11-26 — Phase 3 database foundation

- Added versioned product tables, composite ownership/source foreign keys, deduplication constraints, per-owner RLS and safe draft-review state transitions. Ordinary users cannot write ingestion or analysis fields; future trusted server writes require a server-only privileged client plus explicit ownership checks. No new privileged key/client has been configured.
- Expanded disposable PostgreSQL tests for product records: cross-owner links/reads/edits denied, duplicate posts rejected, forged analysis denied, edits clear prior review metadata, and deleting source posts cascades through result snapshots/drafts.
- After local tests and hosted dry-run review, applied 20261126220000_usage_limits and 20261126230000_review_schema to the linked amanet project through the CLI. Local/remote migration history matches. Read-only hosted grant checks confirm anonymous reservation is denied and authenticated analysis updates are denied.
- Generated public-schema TypeScript types and connected the browser/server SDK helpers to them. Verified 36 unit tests, integration SQL tests, lint, TypeScript and production build. No application login, search UI, real-source ingestion or draft endpoint is implemented yet.
- Updated the local phase tracker without checking off outstanding model grounding or deployed-source checks. No commits or pushes were performed.

## 2026-11-26 — User-selected quota adjustment

- Updated the unapplied migration to the user's exact limits: searches 10/minute and 30/day; AI attempts 20/minute and 100/day. Updated tests, README and local planning/tracking notes to match; did not use a multiplication formula from the interrupted request.
- Verification: all 36 unit tests passed. Disposable PostgreSQL 17 checks passed with 25 concurrent AI reservations allowing exactly 20 and blocking 5, the 30/day search boundary, permission/RLS checks and expired buckets. Whitespace checks passed. No hosted migration, commit or push occurred.

## 2026-11-26 — Model feasibility and app safeguards

- Added an explicit billable synthetic model spike. Initial incomplete responses required disabling reasoning. The first complete run matched 6/8 expected labels, confusing illness with bereavement and missing bakery/business relevance. Revised instructions matched 8/8 on the tuning set, not a held-out benchmark.
- Human review caught invented household size/time-of-day details despite schema-valid output and absent injection markers. Further grounding instructions still produced an unsupported "all three of you". This remains an open quality failure, not a passing result. Latest resumed four-call run reported $0.000354923; this excludes previous attempts.
- An attempted final run was not executed when automatic approval review hit a usage limit; after the user's continuation instruction, a normal approved retry completed. No approval check was bypassed.
- Added deterministic draft eligibility and server-side session/ownership/quota gates. Prepared persistent minute/day quotas with a SECURITY DEFINER function, empty search_path, denied direct writes, RLS for usage reads and a per-user/action transaction lock.
- These helpers are for future authenticated product endpoints; the developer CLI spike does not use app quotas. No hosted migration, product endpoint, commit or push was performed in this step.
- Verification: 36 Jest tests passed, along with lint, TypeScript and production build. The migration was applied only in a disposable PostgreSQL 17 container: anonymous access, invalid actions and direct writes were denied; RLS hid other-user counters; 15 simultaneous AI calls allowed exactly 10 and blocked 5; daily caps and expired buckets behaved correctly. The container was removed afterward.

## 2026-11-26 — Pre-commit review fixes

- Removed UTF-8 BOMs and extra trailing blank lines introduced by PowerShell writes. The package.json BOM caused a real production-build failure.
- Tightened Supabase public configuration: allow publishable keys or legacy JWTs with anon role, reject privileged/malformed keys, require HTTPS except HTTP loopback, and reject embedded URL credentials. JWT decoding is only a format/role guard, not signature verification or authorization. Public environment variables must never contain secrets, regardless of runtime validation.
- Added 17 focused Jest cases for these boundaries. Fixed the test environment fixture to include the NODE_ENV property required by Next.js types.
- Updated README with actual .env setup, connectivity limitations and the CLI migration workflow.
- Verification: 17 Jest tests passed; lint and TypeScript passed; production build passed after removing generated .next output that retained the earlier BOM-related failure. No application data or migrations were changed, and no commits or pushes were made.

## 2026-11-26 — Supabase connection check correction

- Added Supabase SDK/SSR helpers, CLI configuration and a migration-only workflow; no application schema migrations applied.
- Mistake: the initial connectivity script requested the Data API root and interpreted its secret-key requirement as a rejected public key. That diagnosis was incorrect; replacing keys was unnecessary for this check.
- Correction: changed the probe to a deliberately nonexistent table. The configured public key received the expected PostgREST PGRST205 response, confirming API reachability without reading or writing application data.
- CLI login and the amanet project link are verified. Table permissions, RLS, application login and migrations are not yet tested.
- Consolidated actual local configuration in ignored .env; .env.example contains placeholders. No commits or pushes are authorized for these setup changes.

Record concrete assistance, checks, mistakes and corrections as work happens. Each entry describes the state at that step.

## 2026-11-26 — Planning and repository guidance

- Assistance: reviewed the brief/plan, consolidated scope, incorporated recorded Bluesky findings and added repository guidance with planned Jest/Playwright verification.
- Correction: replaced a blanket sensitive-reply block with explicitly requested noncommercial bereavement condolences; other sensitive/uncertain cases remain blocked.
- Correction: removed unnecessary hashes while retaining stable reviewed text snapshots.
- Verification: read repository files and the supplied spike findings. API tests in that document were supplied evidence, not independently rerun in this documentation work.
- Limits: no app scaffold, model comparison, database check or runnable automated tests completed. No passing test results claimed.

## 2026-11-26 — Next.js foundation

- Assistance: scaffolded Next.js App Router/TypeScript, initialized Tailwind/shadcn, configured Jest/Testing Library and Playwright, and replaced planned README commands with actual setup instructions.
- Correction: shadcn initialization added a Google font fetch and a self-referencing font variable. Replaced them with a system font so builds do not depend on a font download. Fixed an initial PostCSS export lint warning.
- Verification: lint, route-type generation/TypeScript and production build passed. The Chromium Playwright entry-page smoke test passed (1 test). Jest initialized successfully with an explicit no-tests flag; there are no unit tests yet, so this is not unit coverage. Runtime dependency audit reported no vulnerabilities.
- Scope: search, Supabase/auth, inference, business logic tests and full review-journey E2E coverage remain unimplemented. No real-model or database success is claimed.
- Repository handling: private local materials use machine-local Git exclusions; AI_LOG.md stays versioned. Created separate local commits for guidance and the verified scaffold, without pushing.
