import { requireReviewer } from "@/lib/auth/session";
import { AppHeader } from "@/components/app-header";
import { SearchForm } from "./search-form";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ query?: string | string[]; source?: string | string[] }> }) {
  const { user } = await requireReviewer();
  const params = await searchParams;
  const initialQuery = typeof params.query === "string" && params.query.length <= 300 ? params.query : "";
  const initialSource = params.source === "fixtures" ? "fixtures" : "bluesky";
  return <>
    <AppHeader email={user.email} />
    <main className="mx-auto max-w-360 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-3xl font-medium tracking-tight">Your review workspace</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Find public posts about life events and prepare careful replies that a person reviews. Live Bluesky posts and synthetic samples stay clearly labelled.</p>
      <SearchForm key={`${initialSource}:${initialQuery}`} initialQuery={initialQuery} initialSource={initialSource} />
    </main>
  </>;
}
