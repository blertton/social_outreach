# AI behavior guidance

Read root and lib/AGENTS.md guidance first.

- Separate analysis and drafting; use one configured model, versioned prompts and shared Zod schemas.
- Centralize standard/condolence/blocked eligibility on the server. Valid JSON does not establish semantic safety.
- Validate batch result IDs exactly, including omissions, duplicates and unknown IDs.
- Treat queries/posts as untrusted in both stages. No model tools or execution of output.
- Ground replies in actual text. No invented facts, implied relationships or manipulative sales pressure.
- Bereavement uses a separate noncommercial condolence prompt. Other sensitive/uncertain cases stay blocked; tone controls cannot override this.
- Omit unnecessary profile metadata from inference; avoid full-content logs.
- Select real/mock AI through server-only AI_PROVIDER=openrouter|mock. Use the real provider on the reviewer deployment.
- Evaluate contextual relevance, direct reply quality, sensitivity and schema-valid injections on synthetic examples. Real-model evaluation is explicit and billable, outside ordinary CI.
- Record actual results and corrections in AI_LOG.md, without universal safety claims.
