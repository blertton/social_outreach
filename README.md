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

Jest uses Next.js's transformer and Testing Library. Unit tests cover Supabase public-key validation, privileged-key rejection, HTTPS requirements and local loopback exceptions. Add business tests as features are built.

```sh
npm test -- --runInBand
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

Next.js App Router, TypeScript, Tailwind/shadcn, Supabase PostgreSQL/Auth using its SDK, and one inexpensive OpenRouter model. Supabase client helpers and CLI setup are present; application login/session refresh, tables, RLS policies and inference remain to be implemented.

Sign in → search → inspect source and contextual analysis → explicitly generate → edit → approve/reject → save and reopen.

Live Bluesky and Sample data stay visibly separate. Replies are grounded in source text. No personal profiling or vulnerability-based scoring. Approval is an internal saved decision; nothing posts externally.

## Secrets and development notes

Copy `.env.example` to `.env` and replace placeholders with your project URL and public publishable key. `.env` is the single local configuration file and is ignored by Git. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable: Next.js embeds public variables in browser bundles. Runtime validation cannot undo exposure of a wrongly configured public variable.

Run `npm run db:check` for a read-only Auth/Data API connectivity probe. The expected missing-table response confirms reachability, not table permissions, RLS, login or writes. The starter page and deterministic unit tests do not require real credentials. OpenRouter variables are reserved for the future inference feature.

For migrations, follow [the database workflow](supabase/README.md): log in to the CLI, link the intended project, create versioned SQL in `supabase/migrations/`, preview with `npm run db:push:preview` and apply reviewed changes with `npm run db:push`. No schema changes through the dashboard SQL Editor. Local CLI settings do not automatically configure the hosted project. No application migrations have been applied yet.

Changes stay local unless committing or pushing is explicitly requested. Optional machine-local notes are not required to build a fresh clone. Record genuine AI assistance, mistakes and corrections in [AI_LOG.md](AI_LOG.md), which belongs in the submitted repository.

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js Jest setup](https://nextjs.org/docs/app/guides/testing/jest)
- [shadcn/ui setup](https://ui.shadcn.com/docs/installation/next)

Before submission, add verified integration setup, actual environment variables, model choice, assumptions, limitations and manual content-deletion instructions. Prepare the maximum five-minute demo and one-page write-up, and preserve meaningful commit history.
