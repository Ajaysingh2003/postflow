import { cn } from "@/lib/utils";
import { usagePercent, type Allowance } from "../usageModel";
export function UsageCircle({
  title,
  value,
  note,
}: {
  title: string;
  value: Allowance;
  note: string;
}) {
  const unlimited = value.limit === null;
  const percent = usagePercent(value);
  const format = (amount: number) => amount.toLocaleString("en-US");
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col items-center rounded-xl border border-border/70 bg-card px-3 py-5 text-center"
    >
      <h3 className="text-xs font-semibold">{title}</h3>
      <div className="relative my-4 size-24 shrink-0">
        <svg
          viewBox="0 0 128 128"
          className="size-full -rotate-90"
          role={unlimited ? undefined : "progressbar"}
          aria-hidden={unlimited || undefined}
          aria-label={unlimited ? undefined : `${title} used`}
          aria-valuemin={unlimited ? undefined : 0}
          aria-valuemax={unlimited ? undefined : 100}
          aria-valuenow={unlimited ? undefined : percent}
          aria-valuetext={
            unlimited
              ? undefined
              : `${format(value.used)} of ${format(value.limit!)} used`
          }
        >
          <circle
            cx="64"
            cy="64"
            r="55"
            fill="none"
            strokeWidth="8"
            className="stroke-muted"
          />
          {!unlimited && (
            <circle
              cx="64"
              cy="64"
              r="55"
              fill="none"
              strokeWidth="8"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={100 - percent}
              strokeLinecap={percent === 0 ? "butt" : "round"}
              className={cn(
                "stroke-blue-500 transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none",
                percent >= 100 && "stroke-amber-500",
              )}
            />
          )}
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="font-heading text-2xl font-semibold tabular-nums">
            {unlimited ? "∞" : `${Math.round(percent)}%`}
          </span>
          <span className="mt-1 text-[10px] text-muted-foreground">
            {unlimited ? "unlimited" : "used"}
          </span>
        </div>
      </div>
      <p className="text-sm font-semibold tabular-nums">
        {format(value.used)}
        {unlimited ? " used" : ` / ${format(value.limit!)}`}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {unlimited ? "Unlimited" : `${format(value.remaining ?? 0)} remaining`}
      </p>
      <p className="mt-3 text-[10px] leading-4 text-muted-foreground">{note}</p>
    </section>
  );
}
