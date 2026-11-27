import Link from "next/link";

const steps = [
  { title: "Search", text: "Enter your own keywords or hashtags for public Bluesky posts, or use clearly labelled sample data." },
  { title: "Analyze", text: "Check a post against your search when you choose to. The words each assessment relies on are highlighted." },
  { title: "Reply", text: "Generate a draft grounded in the post. Bereavement gets a condolence only; other sensitive posts get no draft." },
  { title: "Approve", text: "Edit, approve or reject. Approval records your decision; you post the reply yourself." },
];

export default function HomePage() {
  return <main className="mx-auto grid min-h-svh max-w-360 content-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:px-8">
    <div className="max-w-2xl">
      <h1 className="text-sm text-muted-foreground">Social Outreach</h1>
      <p className="mt-4 text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">Find people sharing life changes, and reply with care</p>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
        A review desk for public posts about new babies, first homes, new businesses and loss. A person reads every post and approves every reply.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/login" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85">Sign in</Link>
        <Link href="/signup" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">Create an account</Link>
      </div>
    </div>
    <section aria-labelledby="how-heading" className="rounded-xl border bg-card p-5 shadow-xs sm:p-8">
      <h2 id="how-heading" className="font-medium">How it works</h2>
      <ol className="mt-6 grid gap-6">
        {steps.map((step, index) => <li key={step.title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
          <span aria-hidden className="text-sm tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <div><p className="font-medium">{step.title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p></div>
        </li>)}
      </ol>
      <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">Nothing is sent automatically.</p>
    </section>
  </main>;
}
