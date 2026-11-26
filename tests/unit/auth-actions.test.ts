jest.mock("server-only", () => ({}));
jest.mock("@/lib/db/server", () => ({ createClient: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn((url) => { throw new Error(`redirect:${url}`); }) }));

import { createClient } from "@/lib/db/server";
import { signIn, signUp, signOut } from "@/app/login/actions";

const auth = { signInWithPassword: jest.fn(), signUp: jest.fn(), signOut: jest.fn() };
function form(email = "reviewer@example.test", password = "fixture-password") {
  const data = new FormData(); data.set("email", email); data.set("password", password); return data;
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(createClient).mockResolvedValue({ auth } as unknown as Awaited<ReturnType<typeof createClient>>);
});

test("invalid login never reaches Supabase", async () => {
  expect((await signIn({ error: "" }, form("invalid"))).error).toContain("valid email");
  expect(createClient).not.toHaveBeenCalled();
});
test("login uses Supabase and redirects only on success", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: null });
  await expect(signIn({ error: "" }, form())).rejects.toThrow("redirect:/search");
  expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "reviewer@example.test", password: "fixture-password" });
});
test("login error does not disclose provider details", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { status: 400, message: "private provider detail" } });
  expect((await signIn({ error: "" }, form())).error).toBe("Unable to sign in. Check your email and password.");
});
test("Supabase throttling produces a useful message", async () => {
  auth.signInWithPassword.mockResolvedValue({ error: { status: 429 } });
  expect((await signIn({ error: "" }, form())).error).toContain("Too many attempts");
});
test("signup without a session requires email confirmation and does not grant access", async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  const state = await signUp({ error: "", message: "" }, form());
  expect(state.error).toBe(""); expect(state.message).toContain("Check your email");
});
test("signup with a Supabase-issued session redirects to the workspace", async () => {
  auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
  await expect(signUp({ error: "", message: "" }, form())).rejects.toThrow("redirect:/search");
});
test("signup errors do not enumerate existing accounts", async () => {
  auth.signUp.mockResolvedValue({ data: null, error: { message: "User already registered" } });
  expect((await signUp({ error: "", message: "" }, form())).error).not.toContain("already registered");
});
test("provider outage fails without exposing the exception", async () => {
  jest.mocked(createClient).mockRejectedValue(new Error("sensitive connection detail"));
  expect((await signIn({ error: "" }, form())).error).toContain("temporarily unavailable");
});
test("signout clears this Supabase session before redirecting", async () => {
  auth.signOut.mockResolvedValue({ error: null });
  await expect(signOut()).rejects.toThrow("redirect:/login");
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
