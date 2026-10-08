import Link from "next/link";
import { Sparkles } from "lucide-react";
import { aiExhausted, usageReset, type PlanUsage } from "../usageModel";
import { UsageMeter } from "./UsageMeter";

export function AiUsageNotice({
  usage,
  loading,
  error,
  onRetry,
}: {
  usage?: PlanUsage;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div
        role="status"
        aria-label="Loading AI allowance"
        className="mb-4 h-20 animate-pulse rounded-xl bg-muted"
      />
    );
  if (!usage || error)
    return (
      <div
        role="alert"
        className="mb-4 rounded-xl border border-border bg-card p-3 text-xs leading-5"
      >
        {error
          ? "We couldn’t check your AI allowance."
          : "Checking your AI allowance."}
        <button
          type="button"
          onClick={onRetry}
          className="secondary-btn mt-2 !text-xs"
        >
          Try again
        </button>
      </div>
    );
  const exhausted = aiExhausted(usage);
  return (
    <section
      aria-label="AI allowance"
      role={exhausted ? "alert" : undefined}
      className="mb-4 rounded-xl border border-border bg-card p-3"
    >
      {exhausted ? (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-amber-600" />
            Your AI credits are used up
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Your workspace’s allowance resets {usageReset(usage.cycle_end)}{" "}
            (UTC). You can keep writing. Publishing follows your post allowance.
          </p>
          <Link href="/settings/billing" className="primary-btn mt-3 !text-xs">
            View plan & usage
          </Link>
        </>
      ) : (
        <>
          <UsageMeter
            title="AI credits"
            value={usage.ai_credits}
            note={`Resets ${usageReset(usage.cycle_end)} (UTC)`}
          />
          <Link
            href="/settings/billing"
            className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4"
          >
            View usage
          </Link>
        </>
      )}
    </section>
  );
}
