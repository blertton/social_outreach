# Shared logic guidance

Read the root AGENTS.md first.

- Keep source adapters, AI functions and database queries small. Use a plain source map, not a plugin framework.
- Filter source/author labels before persistence or inference. Keep synthetic identifiers separate from live identifiers.
- Store analysis per search result using its immutable reviewed text; do not share query-dependent relevance across searches.
- Use session-aware Supabase access, RLS and SQL uniqueness/foreign-key constraints.
- External calls need bounded inputs, deadlines and understandable errors. Failed analysis is different from irrelevance.
- Keep keys server-side and reserve usage atomically before billable attempts.
- Use Jest for boundary behavior; dedicated-database integration checks verify constraints/RLS beyond mocks.
