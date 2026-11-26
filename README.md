# Social Outreach

Find public conversations and prepare thoughtful replies for human review. Nothing is sent automatically.

## Status

Next.js foundation with TypeScript, Tailwind/shadcn, Jest and Playwright configuration. The entry page is intentionally a scaffold. Search, authentication, persistence and AI inference are not implemented yet; no API keys are needed to open it.

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

Jest is configured with Next.js's transformer and Testing Library. Add focused unit tests under `tests/unit/**/*.test.ts` or `.test.tsx` as business behavior is built. There are no unit tests yet; `npm test` will report that. To verify runner startup without claiming test coverage:

```sh
npm test -- --runInBand --passWithNoTests
```

Playwright currently contains one entry-page smoke test, not the full product journey:

```sh
npx playwright install chromium
npm run test:e2e
```

It starts its own Next.js server at http://127.0.0.1:3100. The reserved server-side `AI_PROVIDER=mock` setting will select deterministic inference when the AI layer is implemented; that client does not exist yet. Browser interception alone cannot mock server-to-server inference.

Dedicated-database integration tests and explicit billable model evaluation will be added with persistence and AI. They do not have scripts yet. Ordinary automated tests must not require live Bluesky or paid inference.

## Working with coding agents

Start with [AGENTS.md](AGENTS.md), then applicable guidance:

- [UI and routes](app/AGENTS.md)
- [Shared logic](lib/AGENTS.md)
- [AI behavior](lib/ai/AGENTS.md)
- [Tests](tests/AGENTS.md)

Give an agent one bounded task with an observable outcome. Inspect existing code, implement the smallest coherent change, run relevant checks and report evidence and remaining blockers. Finish the complete saved-review journey before optional features.

## Intended stack and journey

Next.js App Router, TypeScript, Tailwind/shadcn, Supabase PostgreSQL/Auth using its SDK, and one inexpensive OpenRouter model. The Supabase and inference integrations will arrive with their features.

Sign in → search → inspect source and contextual analysis → explicitly generate → edit → approve/reject → save and reopen.

Live Bluesky and Sample data stay visibly separate. Replies are grounded in source text. No personal profiling or vulnerability-based scoring. Approval is an internal saved decision; nothing posts externally.

## Secrets and development notes

Never copy `.env.local` values into source, logs or documentation. Add a placeholder-only `.env.example` when actual integration variables are known. This scaffold does not access those keys.

Changes stay local unless committing or pushing is explicitly requested. Optional machine-local notes are not required to build a fresh clone. Record genuine AI assistance, mistakes and corrections in [AI_LOG.md](AI_LOG.md), which belongs in the submitted repository.

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Jest setup](https://nextjs.org/docs/app/guides/testing/jest)
- [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next)

Before submission, add verified integration setup, actual environment variables, model choice, assumptions, limitations and manual content-deletion instructions. Prepare the maximum five-minute demo and one-page write-up, and preserve meaningful commit history.
