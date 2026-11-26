# Testing guidance

Read the root AGENTS.md first. Use Jest for logic/API boundaries, disposable PostgreSQL for SQL/RLS/concurrency, and Playwright for browser behavior.

- Use Jest, not a second competing unit runner. Follow Next.js's documented Jest setup during scaffolding.
- Unit checks cover contextual relevance, normalization/labels, drafting eligibility, review transitions, output validation and external failures.
- Dedicated-database integration checks cover dedupe, foreign keys, ownership/RLS, persistence and atomic quota reservation. Never destructively test reviewer data.
- Follow the user's browser TDD workflow: write a focused acceptance scenario before changing browser behavior, run it and confirm the intended failure, implement the smallest fix, then run the relevant scenarios and regression suite. Do not describe tests written after implementation as test-first. Cover meaningful negative paths, not just happy paths; the original one-or-two-test limit is superseded.
- Deterministic Playwright uses the real Supabase SDK against local test-only HTTP fixtures; those fixtures do not prove hosted persistence/RLS. Separate PostgreSQL checks verify real SQL. The explicit smoke:search command tests the actual local app and hosted Supabase with a temporary account and synthetic posts, then cleans up; never run against existing user data. Browser interception can test UI error states but does not mock server-to-server inference.
- Cover edit/approve/save/reload, rejection and sensitive/failure behavior. Prefer accessible selectors; avoid arbitrary sleeps and live API dependencies.
- Keep real-model evaluation separate, with synthetic examples and direct human scoring of reply quality.
- No placeholder tests, broad snapshots or implementation-mirroring assertions. Report actual commands/outcomes.
