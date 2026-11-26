# Database workflow

Use versioned SQL migrations for every schema, permission, RLS and database-function change. Do not paste schema changes into the dashboard SQL Editor.

The Supabase CLI is a project dev dependency. Version 3 uses config.jsonc and requires an explicit --remote flag for hosted database commands. Local config settings do not automatically change hosted settings.

1. Run `npm run db:login` in your own terminal and finish authentication.
2. Run `npm run db:link -- --project-ref YOUR_PROJECT_REF` using the ref from the dashboard URL/project settings. Do not put access tokens or database passwords in committed files or command history.
3. Create a migration with `npm run db:migration -- descriptive_name`; review the SQL in migrations/.
4. Preview hosted changes with `npm run db:push:preview`, then apply reviewed changes with `npm run db:push`.

The first prepared migration adds usage counters and the atomic reserve_usage function. It has not been applied to the hosted project. Product tables/ownership policies are still pending. Do not run database reset against hosted reviewer data.

Run `npm run test:integration` with Docker Desktop running to test that migration in a disposable PostgreSQL container. It checks anonymous/direct-write denial, row isolation, daily limits and concurrent reservations without touching the linked project. Fixed limits can only be changed through a reviewed migration, not by a request parameter. No application route is protected until it uses the server gate before external work.

Version config.jsonc and migrations; keep generated connection metadata, .temp and credentials ignored. Access to the Data API with a public key does not authorize CLI migration operations; the CLI requires separate account authorization.

For local database testing, install a supported container runtime and start the local Supabase stack. Do not assume local settings match the hosted project without checking.
