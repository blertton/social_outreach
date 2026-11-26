# UI and route guidance

Read the root AGENTS.md first. This directory contains the Next.js App Router application.

- Prefer server components; use client components for actual interaction.
- Keep source text beside the editor. Show source mode, analysis reasons, unsaved changes and persisted review status.
- Distinguish loading, empty, uncertain, filtered and failed results. Preserve saved work on errors.
- Use accessible labels, keyboard-friendly controls and established Tailwind/shadcn patterns.
- Routes validate inputs, session and record ownership. UI controls are not authorization or sensitivity boundaries.
- Call shared logic rather than duplicating prompts, eligibility or persistence rules.
- Browser parameters cannot select mock AI or bypass limits.
- Verify meaningful changes through the review journey; do not add browser tests for every cosmetic adjustment.
