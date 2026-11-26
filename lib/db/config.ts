import { z } from "zod";

function isPublicKey(value: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const payload = value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    // Role-format guard only. Supabase verifies the signature; this decode
    // must never be used as an authorization check.
    return JSON.parse(atob(payload)).role === "anon";
  } catch {
    return false;
  }
}

const publicConfigSchema = z.object({
  url: z.url().refine((value) => {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return !url.username && !url.password &&
      (url.protocol === "https:" || (local && url.protocol === "http:"));
  }),
  key: z.string().refine(isPublicKey),
});

export function getSupabaseConfig() {
  const result = publicConfigSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.success) {
    throw new Error("Set an HTTPS Supabase URL (HTTP allowed only on loopback) and a public publishable/anon key in .env.");
  }
  return result.data;
}
