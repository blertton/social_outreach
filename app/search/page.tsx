import { requireReviewer } from "@/lib/auth/session";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { SearchForm } from "./search-form";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ query?: string | string[]; source?: string | string[] }> }) {
  const { user } = await requireReviewer();
  const params = await searchParams;
  const initialQuery = typeof params.query === "string" && params.query.length <= 300 ? params.query : "";
  const initialSource = params.source === "fixtures" ? "fixtures" : "bluesky";
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div><p className="font-semibold">Social Outreach</p><p className="mt-1 text-sm text-muted-foreground">Signed in as {user.email}</p></div>
        <form action={signOut}><Button variant="outline" type="submit">Sign out</Button></form>
      </header>
      <section className="py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Your review workspace</h1>
        <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">Find public conversations about life events, or explore clearly labelled synthetic examples.</p>
        <SearchForm key={`${initialSource}:${initialQuery}`} initialQuery={initialQuery} initialSource={initialSource} />
      </section>
    </main>
  );
}
