import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
    <Link href="/" className="mb-10 text-sm text-muted-foreground">Social Outreach</Link>
    <h1 className="text-3xl font-medium tracking-tight">Create your account</h1>
    <p className="mt-3 leading-relaxed text-muted-foreground">Prepare replies in your own private workspace. Nothing is posted automatically.</p>
    <SignupForm />
    <p className="mt-6 text-sm text-muted-foreground">Already registered? <Link href="/login" className="text-foreground underline underline-offset-4">Sign in</Link></p>
  </main>;
}
