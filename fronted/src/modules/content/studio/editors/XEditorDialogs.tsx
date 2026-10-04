"use client";

import { useId } from "react";
import {
  AtSign,
  BadgeCheck,
  Check,
  Globe,
  Star,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                               Reply audience                               */
/* -------------------------------------------------------------------------- */

type Audience = {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const audiences: Audience[] = [
  { value: "everyone", label: "Everyone", description: "Anyone on X can reply", icon: Globe },
  { value: "following", label: "Accounts you follow", description: "Only accounts this X account follows can reply", icon: UserCheck },
  { value: "mentionedUsers", label: "Only accounts you mention", description: "Only accounts mentioned in this post can reply", icon: AtSign },
  { value: "verified", label: "Verified accounts", description: "Only verified accounts can reply", icon: BadgeCheck },
  { value: "subscribers", label: "Subscribers", description: "Only people subscribed to this X account can reply", icon: Star },
];

export function ReplyAudienceDialog({
  open,
  postNumber,
  value,
  disabled,
  onSelect,
  onClose,
}: {
  open: boolean;
  postNumber: number;
  value: string;
  disabled?: boolean;
  /** Called with "everyone" | "following" | ... Close is handled here. */
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-[0.5px] p-0 sm:max-w-md">
        <DialogHeader className="px-6 pb-4 pt-6 pr-12 text-left">
          <DialogTitle className="font-sans text-[17px] font-semibold tracking-[-0.015em]">
            Who can reply{postNumber > 1 ? ` to post ${postNumber}` : ""}?
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">
            Choose who can reply to this post. This does not change who can see it.
          </DialogDescription>
        </DialogHeader>

        <div
          role="radiogroup"
          aria-label="Reply audience"
          className="space-y-2 px-6 pb-6"
        >
          {audiences.map(({ value: option, label, description, icon: Icon }) => {
            const selected = option === value;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  onSelect(option);
                  onClose();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border-[0.5px] px-3.5 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "border-sky-500 bg-sky-500/[0.05] ring-1 ring-sky-500"
                    : "border-border hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    selected
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium leading-tight">{label}</span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {description}
                  </span>
                </span>
                {selected && (
                  <Check className="size-4 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2.25} />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Disclosures                                 */
/* -------------------------------------------------------------------------- */

const disclosures = [
  {
    field: "paid_partnership",
    label: "Paid partnership",
    help: "This post promotes a brand or business.",
  },
  {
    field: "made_with_ai",
    label: "Made with AI",
    help: "This post contains synthetically generated content.",
  },
] as const;

export function DisclosureDialog({
  open,
  postNumber,
  item,
  disabled,
  onChange,
  onClose,
}: {
  open: boolean;
  postNumber: number;
  item?: Record<string, unknown>;
  disabled?: boolean;
  onChange: (patch: Record<string, boolean>) => void;
  onClose: () => void;
}) {
  const id = useId();

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl border-[0.5px] p-0 sm:max-w-md">
        <DialogHeader className="px-6 pb-4 pt-6 pr-12 text-left">
          <DialogTitle className="font-sans text-[17px] font-semibold tracking-[-0.015em]">
            Disclosures{postNumber > 1 ? ` for post ${postNumber}` : ""}
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed">
            These labels are included when publishing to X.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-6 pb-6">
          {disclosures.map(({ field, label, help }) => (
            <div
              key={field}
              className="flex items-center justify-between gap-4 rounded-xl border-[0.5px] border-border px-3.5 py-3"
            >
              <div className="min-w-0">
                <Label htmlFor={`${id}-${field}`} className="text-[13.5px] font-medium">
                  {label}
                </Label>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{help}</p>
              </div>
              <Switch
                id={`${id}-${field}`}
                className="primary-switch shrink-0"
                aria-label={label}
                disabled={disabled}
                checked={item?.[field] === true}
                onCheckedChange={(checked) => onChange({ [field]: checked })}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}







import { BarChart3, Clock, Plus, Trash2, X } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


type Poll = { options: string[]; duration_minutes: number };
type PollItem = Record<string, unknown> & { poll?: Poll | null };

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;
const OPTION_LIMIT = 25;

const durations = [
  { value: "5", label: "5 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "360", label: "6 hours" },
  { value: "1440", label: "1 day" },
  { value: "4320", label: "3 days" },
  { value: "10080", label: "7 days" },
];

function durationLabel(minutes: number) {
  return durations.find((d) => d.value === String(minutes))?.label ?? `${minutes} minutes`;
}

export default function XPoll({
  payload,
  readOnly,
  onChange,
}: {
  payload: PollItem;
  readOnly?: boolean;
  onChange: (value: PollItem) => void;
}) {
  const poll: Poll = payload.poll ?? { options: ["", ""], duration_minutes: 1440 };
  const options = poll.options;

  const update = (patch: Partial<Poll>) => onChange({ ...payload, poll: { ...poll, ...patch } });

  /* ----------------------------- Read-only view ----------------------------- */
  if (readOnly) {
    return (
      <div className="mt-3 space-y-2">
        {options.map((option, i) => (
          <div
            key={i}
            className="rounded-full border-[0.5px] border-border px-4 py-2 text-[13.5px]"
          >
            {option || <span className="text-muted-foreground">Choice {i + 1}</span>}
          </div>
        ))}
        <p className="flex items-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
          <BarChart3 className="size-3.5" strokeWidth={1.75} />
          Poll · {durationLabel(poll.duration_minutes)}
        </p>
      </div>
    );
  }

  /* ------------------------------- Editor view ------------------------------ */
  const durationItems = durations.some((d) => d.value === String(poll.duration_minutes))
    ? durations
    : [...durations, { value: String(poll.duration_minutes), label: durationLabel(poll.duration_minutes) }];

  return (
    <div className="mt-3 overflow-hidden rounded-xl border-[0.5px] border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="flex items-center gap-2 text-[12.5px] font-medium">
          <BarChart3 className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          Poll
          <span className="font-normal text-muted-foreground tabular-nums">
            {options.length} of {MAX_OPTIONS} choices
          </span>
        </p>
        <button
          type="button"
          onClick={() => onChange({ ...payload, poll: null })}
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
          Remove poll
        </button>
      </div>

      {/* Choices */}
      <div className="space-y-2 border-t-[0.5px] border-border px-4 py-3">
        {options.map((option, i) => {
          const nearLimit = option.length >= OPTION_LIMIT;
          return (
            <div key={i} className="flex items-center gap-2">
              <label
                className={cn(
                  "flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg border-[0.5px] border-border bg-background px-3 transition-colors",
                  "focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-400/20",
                  "dark:focus-within:border-white/30 dark:focus-within:ring-white/10",
                )}
              >
                <span className="size-3.5 shrink-0 rounded-full border-[1.5px] border-muted-foreground/40" />
                <input
                  value={option}
                  maxLength={OPTION_LIMIT}
                  placeholder={`Choice ${i + 1}`}
                  aria-label={`Poll choice ${i + 1}`}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    update({ options: next });
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
                />
                <span
                  className={cn(
                    "shrink-0 text-[11px] tabular-nums",
                    nearLimit ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {option.length}/{OPTION_LIMIT}
                </span>
              </label>

              {options.length > MIN_OPTIONS ? (
                <button
                  type="button"
                  aria-label={`Remove choice ${i + 1}`}
                  onClick={() => update({ options: options.filter((_, idx) => idx !== i) })}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </button>
              ) : (
                <span className="size-8 shrink-0" />
              )}
            </div>
          );
        })}

        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => update({ options: [...options, ""] })}
            className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border-[0.5px] border-dashed border-border text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            Add choice
          </button>
        )}
      </div>

      {/* Footer: duration */}
      <div className="flex items-center justify-between gap-3 border-t-[0.5px] border-border bg-primary px-4 py-2.5">
        <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Clock className="size-3.5" strokeWidth={1.75} />
          Poll length
        </p>
        <Select
          items={durationItems}
          value={String(poll.duration_minutes)}
          onValueChange={(value) => update({ duration_minutes: Number(value) })}
        >
          <SelectTrigger aria-label="Poll length" className="h-8 w-36 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durationItems.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}