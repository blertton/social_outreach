"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signUp } from "@/app/login/actions";
import { useFormReady } from "@/lib/auth/use-form-ready";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, { error: "", message: "" });
  const ready = useFormReady();
  return <form action={action} className="mt-8"><fieldset disabled={!ready} className="grid gap-5">
    <div className="grid gap-2"><label htmlFor="email" className="text-sm font-medium">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" required maxLength={254}
        className="h-11 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
    <div className="grid gap-2"><label htmlFor="password" className="text-sm font-medium">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={1024} aria-describedby="password-help"
        className="h-11 rounded-lg border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      <p id="password-help" className="text-sm text-muted-foreground">At least 8 characters</p></div>
    {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
    {state.message && <p role="status" className="text-sm leading-relaxed">{state.message}</p>}
    <Button type="submit" disabled={pending || Boolean(state.message)} className="h-11 w-full">{pending ? "Creating account…" : "Create account"}</Button>
  </fieldset></form>;
}
