# Database workflow

Use versioned SQL migrations for every schema, permission, RLS and database-function change. Do not paste schema changes into the dashboard SQL Editor.

The Supabase CLI is a project dev dependency. Version 3 uses config.jsonc and requires an explicit --remote flag for hosted database commands. Local config settings do not automatically change hosted settings.

1. Run `npm run db:login` in your own terminal and finish authentication.
2. Run `npm run db:link -- --project-ref YOUR_PROJECT_REF` using the ref from the dashboard URL/project settings. Do not put access tokens or database passwords in committed files or command history.
3. Create a migration with `npm run db:migration -- descriptive_name`; review the SQL in migrations/.
4. Preview hosted changes with `npm run db:push:preview`, then apply reviewed changes with `npm run db:push`.

Versioned migrations define quotas, review records, trusted search ingestion, draft-transition corrections, atomic analysis-batch saving and owner-scoped draft review saves. Preview pending migrations before applying them. Do not run database reset against hosted reviewer data.

RLS limits users to their own records. Composite foreign keys enforce ownership/source consistency; ordinary users cannot insert or modify source/analysis records. The server-only privileged client saves provider-fetched source records after session/quota checks through save_search. The user's ID comes from verified Auth, never the request body. That RPC is not executable by anonymous/authenticated clients and rolls back failed saves. Authenticated users can update only their own draft text/status; a trigger maintains review timestamps and clears decisions after edits. No privileged credential is stored in schema/type files.

Run `npm run test:integration` with Docker Desktop running to test the migrations in a disposable PostgreSQL container. It checks quota concurrency, ownership/RLS, protected AI fields, atomic batch saves, deduplication, draft transitions, draft review saves and deletion cascades without touching the linked project. Fixed limits can only be changed through a reviewed migration, not by a request parameter. External-call routes must use the server gate before dispatch.

`save_analysis_batch` is callable only by the privileged role. It validates ownership and evidence for every result, saves at most five together and never overwrites completed analysis. The app verifies the session and reserves one AI allowance before inference.

The draft trigger preserves an explicit changed decision when text/status are saved together, and clears stale review metadata for text-only edits. The app saves reviews through `save_draft_review`, which runs as the signed-in user (RLS and column grants still apply): a text change first resets the draft to `draft`, then the requested decision is applied. That makes "edit an approved reply and approve it again" record a fresh approval instead of being ambiguous. Never disable the stale-review reset to work around it. Drafts record their `kind` (`standard` or `condolence`); users cannot change it.

Version config.jsonc and migrations; keep generated connection metadata, .temp and credentials ignored. Access to the Data API with a public key does not authorize CLI migration operations; the CLI requires separate account authorization.

For local database testing, install a supported container runtime and start the local Supabase stack. Do not assume local settings match the hosted project without checking.
