# Database workflow

Use versioned SQL migrations for every schema, permission, RLS and database-function change. Do not paste schema changes into the dashboard SQL Editor.

The Supabase CLI is a project dev dependency. Version 3 uses config.jsonc and requires an explicit --remote flag for hosted database commands. Local config settings do not automatically change hosted settings.

1. Run `npm run db:login` in your own terminal and finish authentication.
2. Run `npm run db:link -- --project-ref YOUR_PROJECT_REF` using the ref from the dashboard URL/project settings. Do not put access tokens or database passwords in committed files or command history.
3. Create a migration with `npm run db:migration -- descriptive_name`; review the SQL in migrations/.
4. Preview hosted changes with `npm run db:push:preview`, then apply reviewed changes with `npm run db:push`.

No application schema migration has been created or applied yet. An empty migration directory is intentional until table/ownership rules are implemented. Do not run database reset against hosted reviewer data.

Version config.jsonc and migrations; keep generated connection metadata, .temp and credentials ignored. Access to the Data API with a public key does not authorize CLI migration operations; the CLI requires separate account authorization.

For local database testing, install a supported container runtime and start the local Supabase stack. Do not assume local settings match the hosted project without checking.
