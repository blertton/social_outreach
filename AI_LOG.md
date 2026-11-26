# AI assistance log

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
