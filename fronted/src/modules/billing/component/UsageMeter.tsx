import { cn } from "@/lib/utils";
import { usagePercent, type Allowance } from "../usageModel";

export function UsageMeter({
  title,
  value,
  note,
}: {
  title: string;
  value: Allowance;
  note?: string;
}) {
  const percent = usagePercent(value);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.used.toLocaleString("en-US")} /{" "}
          {value.limit === null
            ? "Unlimited"
            : value.limit.toLocaleString("en-US")}
        </span>
      </div>
      {value.limit !== null && (
        <div
          role="progressbar"
          aria-label={title}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            style={{ width: `${percent}%` }}
            className={cn(
              "h-full rounded-full bg-emerald-500 transition-[width]",
              percent >= 100 && "bg-amber-500",
            )}
          />
        </div>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {value.remaining === null
          ? "Unlimited usage included"
          : `${value.remaining.toLocaleString("en-US")} remaining`}
        {note && ` · ${note}`}
      </p>
    </div>
  );
}
