import { cn } from "cn"

// Quiet neutral pill. Colour appears only as a small status dot, and only when it
// carries meaning (good, caution, problem); everything else stays neutral.
const dots = {
  positive: "bg-emerald-600 dark:bg-emerald-400",
  caution: "bg-amber-500 dark:bg-amber-400",
  negative: "bg-red-600 dark:bg-red-400",
  neutral: "bg-muted-foreground/60",
} as const

function Badge({ className, dot, children, ...props }: React.ComponentProps<"span"> & { dot?: keyof typeof dots }) {
  return <span data-slot="badge" className={cn("inline-flex w-fit shrink-0 items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs font-medium whitespace-nowrap", className)} {...props}>
    {dot && <span aria-hidden className={cn("size-1.5 rounded-full", dots[dot])} />}
    {children}
  </span>
}

export { Badge }
