import { AlertCircle, Loader2 } from "lucide-react";

// Shared controls kept separate from the retired posts page.
export const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15";
export const panel = "rounded-xl border border-border bg-background p-5";

export function Status({value}: {value: string}) {
  const color = value === "published" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : value === "failed" ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground";
  return <span className={`rounded-md px-2 py-1 text-[11px] font-medium capitalize ${color}`}>{value.replaceAll("_", " ")}</span>;
}
export function Notice({message}: {message: string}) {
  return <div role="status" className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground"><AlertCircle className="mt-0.5 size-4 shrink-0" />{message}</div>;
}
export function Loading() {
  return <div className="flex justify-center p-12" role="status"><Loader2 className="size-5 animate-spin" /><span className="sr-only">Loading</span></div>;
}
