"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { credentialsSchema, signupSchema } from "@/lib/auth/credentials";

export async function signIn(_previous: { error: string }, formData: FormData) {
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error) return { error: error.status === 429 ? "Too many attempts. Wait a moment and try again." : "Unable to sign in. Check your email and password." };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect("/search");
}

export async function signOut() {
  const client = await createClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  redirect("/login");
}

export async function signUp(_previous: { error: string; message: string }, formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(), password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters.", message: "" };
  let signedIn = false;
  try {
    const client = await createClient();
    const { data, error } = await client.auth.signUp(parsed.data);
    if (error) return { error: "Unable to create an account. Please try again later or sign in if you already have one.", message: "" };
    signedIn = Boolean(data.session);
  } catch {
    return { error: "Account creation is temporarily unavailable. Please try again.", message: "" };
  }
  if (signedIn) redirect("/search");
  return { error: "", message: "Check your email to confirm your account, then return here to sign in." };
}
