import { SettingsLink } from "@/modules/settings/SettingsProvider";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  aiExhausted,
  usagePercent,
  usageReset,
  type PlanUsage,
} from "@/modules/billing/usageModel";

export function HomeAiUsageCard({ usage }: { usage: PlanUsage }) {
  const credits = usage.ai_credits;
  const unlimited = credits.limit === null;
  const exhausted = aiExhausted(usage);
  const percent = usagePercent(credits);
  const format = (value: number) => value.toLocaleString("en-US");

  return (
    <section
      aria-label="Workspace AI usage"
      className="flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-xs"
    >
      <div className="flex items-start gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">
            AI usage
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Your monthly writing allowance
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-center gap-6 py-6">
        <div className="relative size-32 shrink-0">
          <svg
            viewBox="0 0 128 128"
            className="size-full -rotate-90"
            role={unlimited ? undefined : "progressbar"}
            aria-hidden={unlimited || undefined}
            aria-label={unlimited ? undefined : "AI credits used"}
            aria-valuemin={unlimited ? undefined : 0}
            aria-valuemax={unlimited ? undefined : 100}
            aria-valuenow={unlimited ? undefined : percent}
            aria-valuetext={
              unlimited
                ? undefined
                : `${format(credits.used)} of ${format(credits.limit!)} credits used`
            }
          >
            <circle
              cx="64"
              cy="64"
              r="55"
              fill="none"
              strokeWidth="9"
              className="stroke-muted"
            />
            {!unlimited && (
              <circle
                cx="64"
                cy="64"
                r="55"
                fill="none"
                strokeWidth="9"
                strokeLinecap={percent === 0 ? "butt" : "round"}
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - percent}
                className={cn(
                  "stroke-blue-500 transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
                  exhausted && "stroke-amber-500",
                )}
              />
            )}
          </svg>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="font-heading text-3xl font-semibold tabular-nums tracking-tight">
              {unlimited ? "∞" : `${Math.round(percent)}%`}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              {unlimited ? "unlimited" : "used"}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1 basis-28">
          <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight">
            {unlimited ? "Unlimited" : format(credits.remaining ?? 0)}
            {!unlimited && <span className="sr-only"> remaining</span>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {unlimited ? "AI credits included" : "credits remaining"}
          </p>
          <p className="mt-3 text-xs tabular-nums text-muted-foreground">
            {format(credits.used)}
            {unlimited ? " credits used" : ` / ${format(credits.limit!)} used`}
          </p>
        </div>
      </div>

      {exhausted && (
        <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs leading-5 text-amber-800 dark:text-amber-300">
          <span className="font-medium">AI allowance used up.</span> Your
          credits renew next cycle. You can still write and publish.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <p className="text-[11px] leading-5 text-muted-foreground">
          Resets {usageReset(usage.cycle_end)}
          <span className="ml-1">(UTC)</span>
        </p>
        <Button
          asChild
          variant="outline"
          className="secondary-btn dark:!bg-card dark:!bg-none dark:!text-foreground rounded-lg !text-xs"
        >
          <SettingsLink section="billing">
            {exhausted ? "View plans" : "Plan & usage"}
            <ArrowUpRight className="size-3.5" />
          </SettingsLink>
        </Button>
      </div>
    </section>
  );
}
