# AI assistance log

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
