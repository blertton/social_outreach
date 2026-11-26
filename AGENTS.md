# Repository guidance

## Objective and context

Build a small, polished social listening app with a complete human review journey. Prioritize search quality, thoughtful replies, maintainability and explainable decisions.

Read README.md and relevant code first. Optional local planning notes may supply additional context, but must not be required to run a fresh clone. Nested AGENTS.md files add guidance for their directory.

## Workflow

1. Inspect current state and preserve unrelated user changes.
2. Choose one bounded outcome and implement the smallest coherent change.
3. Follow existing patterns; use TypeScript, the Supabase SDK, Jest and Playwright.
4. Run relevant checks and report unavailable checks honestly.
5. Summarize changed behavior, verification and remaining blockers.

Add directory guidance only for distinct responsibilities; do not duplicate this file throughout the tree. No mandatory delegation or multi-agent workflow.

## Product invariants

- No automatic posting or messaging. Approval is an internal decision.
- Keep live posts and synthetic examples visibly distinct; never silently substitute fixtures.
- Analyze against the current query; do not infer financial need or build profiles.
- Ground replies in reviewed source text and treat source/query content as untrusted.
- Centralize server-side drafting eligibility: completed valid analysis, relevant post, permitted category. Bereavement allows only noncommercial condolences; other sensitive/uncertain cases remain blocked.
- Save text/status together. Editing reviewed text resets its decision.

## Engineering boundaries

Use Next.js App Router, Supabase PostgreSQL/Auth, Tailwind/shadcn and OpenRouter. Bluesky is the only live source. No runtime agents, workers, Redis, vector databases, cleanup/keep-alive jobs or orchestration without a demonstrated need.

Authenticate and authorize protected operations, enforce RLS, validate inputs/outputs, bound external calls and reserve usage before dispatch. Use SQL constraints for deduplication and source-controlled migrations once created.

## Verification

Jest covers meaningful unit/integration behavior. Playwright covers one or two complete journeys with server-side mock AI and synthetic posts. CI must not depend on live Bluesky or paid inference. Finite model evaluation is evidence, not a guarantee of safety.

The scaffold includes lint/typecheck/build scripts, Jest configuration and a Playwright entry-page smoke test. Add focused unit/integration tests with actual business behavior and evolve the browser smoke test into the complete review journey. Never claim checks passed unless run. Avoid placeholder tests, broad snapshots and tests that merely repeat implementation.

## Secrets and publishing

Never print secrets. Access `.env.local` only when a task requires specific configuration; use placeholders in examples. Keep assessment PDFs, assignments, plans and spike notes untracked. Inspect staging scope before committing; do not blindly use `git add .`.

Do not commit, push, deploy or send messages without applicable user authorization. Ordinary requested local coding and verification may proceed.

Maintain AI_LOG.md with genuine assistance, mistakes, verification and corrections. Preserve full history and never invent evidence.
