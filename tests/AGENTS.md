# Testing guidance

Read the root AGENTS.md first. Jest and Playwright are configured; the initial browser test checks the entry page only. Add unit tests under tests/unit and grow browser coverage into the real journey as functionality arrives. Integration tests require separate configuration and a dedicated database when persistence is implemented.

- Use Jest, not a second competing unit runner. Follow Next.js's documented Jest setup during scaffolding.
- Unit checks cover contextual relevance, normalization/labels, drafting eligibility, review transitions, output validation and external failures.
- Dedicated-database integration checks cover dedupe, foreign keys, ownership/RLS, persistence and atomic quota reservation. Never destructively test reviewer data.
- Use one or two Playwright journeys with synthetic posts, real test persistence and deterministic server-side mock AI. Browser interception does not mock server-to-server OpenRouter calls.
- Cover edit/approve/save/reload, rejection and sensitive/failure behavior. Prefer accessible selectors; avoid arbitrary sleeps and live API dependencies.
- Keep real-model evaluation separate, with synthetic examples and direct human scoring of reply quality.
- No placeholder tests, broad snapshots or implementation-mirroring assertions. Report actual commands/outcomes.
