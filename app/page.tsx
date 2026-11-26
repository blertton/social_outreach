export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">Social listening · Human review</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Social Outreach</h1>
      <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
        Find meaningful conversations. Prepare thoughtful replies. Keep a person in control.
      </p>
      <section aria-labelledby="status-heading" className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 id="status-heading" className="font-semibold">The foundation is ready</h2>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Search, analysis and draft review are still being built. Nothing is sent automatically.
        </p>
      </section>
    </main>
  );
}
