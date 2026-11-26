const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  if (!url || !key) throw new Error("Set the Supabase URL and public publishable/anon key in .env.");
  const projectUrl = new URL(url);
  if (projectUrl.protocol !== "https:" && projectUrl.hostname !== "127.0.0.1" && projectUrl.hostname !== "localhost") {
    throw new Error("Hosted Supabase connections must use HTTPS.");
  }
  // The API root exposes an OpenAPI document and may require a secret key.
  // Probe a deliberately nonexistent table instead: PGRST205 confirms that
  // the public-key request reached PostgREST, without reading or writing data.
  for (const [label, path] of [
    ["Auth settings", "/auth/v1/settings"],
    ["Data API", "/rest/v1/__social_outreach_connection_probe__?select=id&limit=0"],
  ]) {
    const response = await fetch(new URL(path, projectUrl), {
      headers: { apikey: key, ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (label === "Data API" && response.status === 404) {
      const body = await response.json().catch(() => null);
      if (body?.code === "PGRST205") {
        console.log("Data API: reachable with public key (expected missing-table probe).");
        continue;
      }
    }
    if (!response.ok) throw new Error(`${label} check returned HTTP ${response.status}.`);
    console.log(`${label}: reachable (HTTP ${response.status}).`);
  }
  console.log("Read-only connectivity verified. This does not test table access, RLS or migrations.");
}

main().catch((error) => {
  // Never print request objects, headers, environment values or response bodies.
  console.error(error instanceof Error && (!key || !error.message.includes(key)) ? error.message : "Supabase check failed.");
  process.exitCode = 1;
});
