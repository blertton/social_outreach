"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "./actions";
import { useFormReady } from "@/lib/auth/use-form-ready";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  const ready = useFormReady();
  return (
    <form action={action} className="mt-8"><fieldset disabled={!ready} className="grid gap-5">
      <div className="grid gap-2">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
          className="h-11 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024}
          className="h-11 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-11 w-full">{pending ? "Signing in…" : "Sign in"}</Button>
    </fieldset></form>
  );
}
