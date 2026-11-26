"use client";
import Link from "next/link";
export default function SearchError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-2xl font-semibold">Could not load this search</h1>
    <p className="my-4">Your saved work has not been deleted. Please try again.</p>
    <button onClick={reset} className="mr-5 underline">Try again</button><Link href="/search" className="underline">New search</Link></main>;
}
