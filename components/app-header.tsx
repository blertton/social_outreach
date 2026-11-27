import { GuardedLink as Link, GuardedForm } from "@/components/unsaved-changes";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

// Shared shell for signed-in pages: full width, quiet, one action.
export function AppHeader({ email }: { email?: string | null }) {
  return <header className="border-b bg-card">
    <div className="mx-auto flex h-14 max-w-360 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-6">
        <Link href="/search" className="shrink-0 font-medium">Social Outreach</Link>
        <nav aria-label="Workspace" className="hidden text-sm text-muted-foreground sm:block">
          <Link href="/search" className="transition-colors hover:text-foreground">New search</Link>
        </nav>
      </div>
      <div className="flex min-w-0 items-center gap-4">
        {email && <span className="hidden truncate text-sm text-muted-foreground md:inline">Signed in as {email}</span>}
        <GuardedForm action={signOut}><Button variant="outline" type="submit">Sign out</Button></GuardedForm>
      </div>
    </div>
  </header>;
}
