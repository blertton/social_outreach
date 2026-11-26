import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

// Proxy refreshes sessions before rendering; pages may read but not write cookies.
export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) cookieStore.set(name, value, options);
        } catch {
          // Read-only Server Component context; proxy already refreshes cookies.
        }
      },
    },
  });
}
