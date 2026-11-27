import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <Link href="/" className="mb-10 text-sm text-muted-foreground hover:text-foreground">Social Outreach</Link>
      <h1 className="text-3xl font-medium tracking-tight">Sign in to your workspace</h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">Find conversations and prepare replies for human review.</p>
      <LoginForm />
      <p className="mt-6 text-sm text-muted-foreground">Need an account? <Link href="/signup" className="text-foreground underline underline-offset-4">Create an account</Link></p>
    </main>
  );
}
