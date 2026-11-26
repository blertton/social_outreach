import { getSupabaseConfig } from "@/lib/db/config";

const publicKey = "sb_publishable_test_key";
const jwt = (role: string) => [
  Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
  Buffer.from(JSON.stringify({ role })).toString("base64url"),
  "test_signature",
].join(".");

beforeEach(() => {
  jest.replaceProperty(process, "env", {
    NODE_ENV: "test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
  });
});
afterEach(() => jest.restoreAllMocks());

test.each([publicKey, jwt("anon")])("accepts public-key formats", (key) => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  expect(getSupabaseConfig().key).toBe(key);
});

test("supports the legacy anon environment variable", () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon");
  expect(getSupabaseConfig().key).toBe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
});

test.each(["sb_secret_test", jwt("service_role"), jwt("authenticated"), "bad.key.signature", "arbitrary", ""])(
  "rejects privileged/malformed keys without echoing them", (key) => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
    expect(() => getSupabaseConfig()).toThrow("public publishable/anon key");
    try { getSupabaseConfig(); } catch (error) {
      if (key) expect((error as Error).message).not.toContain(key);
    }
  },
);

test.each(["http://example.supabase.co", "ftp://localhost", "https://user:password@example.supabase.co", "invalid"])(
  "rejects unsafe URLs", (url) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    expect(() => getSupabaseConfig()).toThrow();
  },
);

test.each(["http://localhost:54321", "http://127.0.0.1:54321", "http://[::1]:54321"])(
  "allows HTTP loopback for local development", (url) => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    expect(getSupabaseConfig().url).toBe(url);
  },
);

test("does not silently replace an invalid configured publishable key", () => {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_secret_test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt("anon");
  expect(() => getSupabaseConfig()).toThrow();
});
