"use client";

import {
  Component,
  Suspense,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  QueryErrorResetBoundary,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronRight,
  Fingerprint,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import {
  BRAND_CHANNELS,
  VOICE_TRAITS,
  brandProgress,
  brandSchema,
  brandValues,
  type BrandDraft,
} from "../personaTypes";

/* -------------------------------------------------------------------------- */
/*  Config                                                                    */
/* -------------------------------------------------------------------------- */

type Section = "identity" | "voice" | "samples" | "channels";

const SECTIONS = [
  {
    id: "identity",
    label: "Brand & audience",
    icon: Fingerprint,
    caption: "The person behind the posts",
    title: "Tell your story.",
    description:
      "Give Draftva the context to write about your work without guessing who you are.",
    fields: [
      "display_name",
      "role",
      "bio",
      "niche",
      "audience",
      "expertise",
      "goals",
      "values",
    ],
  },
  {
    id: "voice",
    label: "Voice & style",
    icon: SlidersHorizontal,
    caption: "Words that feel like you",
    title: "Make it sound like you.",
    description:
      "Set your everyday voice. A specific request can change the tone of a draft while keeping your brand’s context.",
    fields: [
      "voice_traits",
      "style_guide",
      "writing_rules",
      "output_language",
      "preferred_formats",
      "calls_to_action",
      "restricted_topics",
    ],
  },
  {
    id: "samples",
    label: "Writing samples",
    icon: BookOpen,
    caption: "Show, don’t just tell",
    title: "Your voice, in your own words.",
    description:
      "Add up to five posts you wrote. Draftva uses them as style references across channels, without copying them into new posts.",
    fields: ["sample_posts"],
  },
  {
    id: "channels",
    label: "Channel preferences",
    icon: Globe2,
    caption: "One brand, different rhythms",
    title: "A little nuance for each channel.",
    description:
      "Add optional guidance for each platform. Your brand profile applies everywhere; platform limits and community rules still take priority.",
    fields: ["platform_instructions"],
  },
] as const satisfies ReadonlyArray<{
  id: Section;
  label: string;
  icon: typeof Fingerprint;
  caption: string;
  title: string;
  description: string;
  fields: ReadonlyArray<keyof BrandDraft>;
}>;

const LIMITS = {
  item: 240,
  traits: 8,
  samples: 5,
  sample: 3000,
  channel: 1000,
} as const;

const modalClass =
  "flex h-[min(810px,calc(100dvh-2rem))] w-[min(1080px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-2xl bg-background p-0 text-foreground sm:max-w-none";
const fieldClass =
  "rounded-lg border-border/80 bg-background text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-500/30";

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const sectionOfField = (field: string): Section =>
  SECTIONS.find((s) => (s.fields as readonly string[]).includes(field))?.id ??
  "identity";

/* -------------------------------------------------------------------------- */
/*  Chrome: header, loading, error boundary                                   */
/* -------------------------------------------------------------------------- */

function Header({
  close,
  busy = false,
}: {
  close: () => void;
  busy?: boolean;
}) {
  return (
    <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-500 dark:border-violet-500/20 dark:bg-violet-500/10">
          <Fingerprint size={20} />
        </span>
        <div className="min-w-0">
          <DialogTitle className="font-heading text-xl font-semibold">
            Your brand profile
          </DialogTitle>
          <DialogDescription className="mt-0.5 truncate text-xs">
            Help Draftva understand your story, audience, and voice.
          </DialogDescription>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        aria-label="Close brand profile"
        onClick={close}
      >
        <X size={17} />
      </Button>
    </DialogHeader>
  );
}

export function BrandProfileSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading brand profile"
      className="flex flex-1 flex-col gap-6 p-5 sm:grid sm:grid-cols-[224px_1fr] sm:p-0"
    >
      <div className="space-y-3 sm:border-r sm:border-border/70 sm:bg-muted/15 sm:p-4">
        <Skeleton className="hidden h-32 rounded-xl sm:block" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
      <div className="space-y-6 sm:p-8">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-16" />
        <Skeleton className="h-32" />
        <span className="sr-only">Loading your saved brand profile</span>
      </div>
    </div>
  );
}

function LoadingDialog({
  close,
  error,
  retry,
}: {
  close: () => void;
  error?: Error;
  retry?: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className={modalClass} showCloseButton={false}>
        <Header close={close} />
        {error ? (
          <div
            role="alert"
            className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <AlertCircle className="size-6 text-muted-foreground" />
            </span>
            <h2 className="font-heading text-xl">Your profile couldn’t load</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {error.message}
            </p>
            <div className="mt-2 flex gap-2">
              <Button className="secondary-btn" onClick={close}>
                Close
              </Button>
              <Button className="primary-btn" onClick={retry}>
                <RefreshCw size={14} />
                Try again
              </Button>
            </div>
          </div>
        ) : (
          <BrandProfileSkeleton />
        )}
      </DialogContent>
    </Dialog>
  );
}

class BrandBoundary extends Component<
  { children: ReactNode; retry: () => void; close: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <LoadingDialog
        close={this.props.close}
        error={this.state.error}
        retry={() => {
          this.props.retry();
          this.setState({ error: null });
        }}
      />
    ) : (
      this.props.children
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Field primitives                                                          */
/* -------------------------------------------------------------------------- */

export function BrandTextField({
  name,
  label,
  hint,
  value,
  onChange,
  max,
  multiline = false,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const id = `brand-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const nearLimit = value.length >= max * 0.9;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <span
          className={cx(
            "text-[10px] tabular-nums",
            nearLimit
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {value.length.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          rows={4}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className={cx(fieldClass, "min-h-28 resize-y p-3 leading-6")}
        />
      ) : (
        <Input
          id={id}
          value={value}
          maxLength={max}
          placeholder={placeholder}
          aria-describedby={hintId}
          onChange={(e) => onChange(e.target.value)}
          className={fieldClass}
        />
      )}
    </div>
  );
}

/** Chip-style list input: Enter (or blur) adds an item, Backspace removes the last. */
function ChipListField({
  name,
  label,
  hint,
  value,
  max,
  onChange,
  placeholder = "Type and press Enter",
}: {
  name: string;
  label: string;
  hint?: string;
  value: string[];
  max: number;
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const uid = useId();
  const id = `brand-${name}`;
  const hintId = `${uid}-hint`;
  const [text, setText] = useState("");
  const full = value.length >= max;

  function commit(raw: string) {
    const parts = raw
      .split("\n")
      .map((part) => part.trim().slice(0, LIMITS.item))
      .filter(Boolean);
    if (!parts.length) return;
    const seen = new Set(value.map((item) => item.toLowerCase()));
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (seen.has(part.toLowerCase())) continue;
      seen.add(part.toLowerCase());
      next.push(part);
    }
    onChange(next);
    setText("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit(text);
    } else if (event.key === "Backspace" && !text && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <span
          className={cx(
            "text-[10px] tabular-nums",
            full
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {value.length} / {max}
        </span>
      </div>
      {hint && (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
      <div
        className={cx(
          "flex flex-wrap gap-1.5 rounded-lg border border-border/80 bg-background p-2 transition-shadow focus-within:ring-2 focus-within:ring-emerald-200 dark:focus-within:ring-emerald-500/30",
        )}
      >
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex max-w-full items-center gap-1 rounded-md border border-border/70 bg-muted/40 py-1 pl-2.5 pr-1 text-xs"
          >
            <span className="break-words">{item}</span>
            <button
              type="button"
              aria-label={`Remove ${item}`}
              className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onChange(value.filter((v) => v !== item))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          maxLength={LIMITS.item}
          disabled={full}
          placeholder={
            full ? `Limit of ${max} reached` : value.length ? "Add another" : placeholder
          }
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(text)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (pasted.includes("\n")) {
              e.preventDefault();
              commit(`${text}${pasted}`);
            }
          }}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section bodies                                                            */
/* -------------------------------------------------------------------------- */

export function BrandFields({
  section,
  draft,
  change,
}: {
  section: Section;
  draft: BrandDraft;
  change: (draft: BrandDraft) => void;
}) {
  const text = (
    name: "display_name" | "role" | "bio" | "niche" | "audience" | "style_guide" | "writing_rules" | "output_language",
    label: string,
    max: number,
    options: { hint?: string; multiline?: boolean; placeholder?: string } = {},
  ) => (
    <BrandTextField
      name={name}
      label={label}
      value={String(draft[name] ?? "")}
      onChange={(value) => change({ ...draft, [name]: value })}
      max={max}
      {...options}
    />
  );

  const list = (
    name:
      | "expertise"
      | "goals"
      | "values"
      | "preferred_formats"
      | "calls_to_action"
      | "restricted_topics",
    label: string,
    hint: string,
    placeholder: string,
    max = 10,
  ) => (
    <ChipListField
      name={name}
      label={label}
      hint={hint}
      placeholder={placeholder}
      value={draft[name]}
      max={max}
      onChange={(items) => change({ ...draft, [name]: items })}
    />
  );

  if (section === "identity")
    return (
      <div className="space-y-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("display_name", "Name or brand", 120, {
            placeholder: "e.g. Jamie Parker",
          })}
          {text("role", "What you do", 240, {
            placeholder: "e.g. Founder, designer, independent writer",
          })}
        </div>
        {text("bio", "Your story", 2000, {
          hint: "Your background, work, and experiences the AI can reference. Include only details you want used in your content.",
          multiline: true,
          placeholder: "I’m building… Before this, I… What I’ve learned is…",
        })}
        {text("niche", "Your focus", 240, {
          placeholder: "e.g. Building useful software and sharing the process",
        })}
        {text("audience", "Who you’re writing for", 1500, {
          hint: "Who are they, what do they care about, and how do you help?",
          multiline: true,
          placeholder: "I write for… They struggle with… I help them…",
        })}
        {list(
          "expertise",
          "Topics you know",
          "Your areas of expertise and recurring content themes.",
          "e.g. Product design",
        )}
        {list(
          "goals",
          "What your content should do",
          "For example: teach practical skills, share your progress, build trust.",
          "e.g. Share progress openly",
        )}
        {list(
          "values",
          "What you stand for",
          "Beliefs and principles you want your writing to reflect.",
          "e.g. Clarity over cleverness",
        )}
      </div>
    );

  if (section === "voice") {
    const presets = VOICE_TRAITS as readonly string[];
    const custom = draft.voice_traits.filter((t) => !presets.includes(t));
    const traitsFull = draft.voice_traits.length >= LIMITS.traits;
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <Label className="text-xs font-medium">Your everyday tone</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {draft.voice_traits.length} / {LIMITS.traits}
            </span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Choose a few traits that feel natural. Add your own below.
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Voice traits">
            {VOICE_TRAITS.map((trait) => {
              const active = draft.voice_traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  aria-pressed={active}
                  disabled={!active && traitsFull}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40",
                    active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                      : "border-border/80 text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                  )}
                  onClick={() =>
                    change({
                      ...draft,
                      voice_traits: active
                        ? draft.voice_traits.filter((v) => v !== trait)
                        : [...draft.voice_traits, trait],
                    })
                  }
                >
                  {active && <Check size={12} />}
                  {trait}
                </button>
              );
            })}
          </div>
          <ChipListField
            name="custom_voice_traits"
            label="Your own traits"
            hint="Anything the presets miss."
            placeholder="e.g. Dry wit"
            value={custom}
            max={Math.max(custom.length, LIMITS.traits - (draft.voice_traits.length - custom.length))}
            onChange={(items) =>
              change({
                ...draft,
                voice_traits: [
                  ...draft.voice_traits.filter((t) => presets.includes(t)),
                  ...items,
                ],
              })
            }
          />
        </div>
        {text("style_guide", "How your writing flows", 1500, {
          hint: "Sentence length, vocabulary, point of view, emoji, and formatting.",
          multiline: true,
          placeholder:
            "Short sentences. First person. Plain language. A little humor, without sounding forced.",
        })}
        {text("writing_rules", "Your writing dos and don’ts", 1500, {
          hint: "Examples: no exaggerated claims, no buzzwords, never open with a rhetorical question.",
          multiline: true,
        })}
        {text("output_language", "Default language", 80, {
          hint: "Leave blank to follow the language of your request.",
          placeholder: "e.g. English, Hindi, Spanish",
        })}
        {list(
          "preferred_formats",
          "Formats you enjoy",
          "For example: personal lessons, short observations, how-to threads.",
          "e.g. Short observations",
        )}
        {list(
          "calls_to_action",
          "How you like to finish",
          "For example: ask a thoughtful question, offer a practical next step.",
          "e.g. Ask a thoughtful question",
        )}
        {list(
          "restricted_topics",
          "Topics and claims to avoid",
          "Sensitive subjects, phrases, or claims that don’t belong in your content.",
          "e.g. Income guarantees",
          20,
        )}
      </div>
    );
  }

  if (section === "samples")
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-xs leading-5 text-violet-800 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
          Choose posts that feel most like you. A mix of short and longer pieces
          helps Draftva understand your rhythm. No connected account is needed.
        </div>

        {draft.sample_posts.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <BookOpen className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">A few words go a long way.</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
              Paste an original post, caption, or short piece of writing to get
              started.
            </p>
          </div>
        )}

        {draft.sample_posts.map((sample, index) => (
          <div
            key={index}
            className="rounded-xl border border-border/70 p-4 transition-colors focus-within:border-border"
          >
            <div className="mb-2 flex items-center justify-between">
              <Label htmlFor={`brand-sample-${index}`} className="text-xs font-medium">
                Sample {index + 1}
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground hover:text-red-600"
                aria-label={`Remove sample ${index + 1}`}
                onClick={() =>
                  change({
                    ...draft,
                    sample_posts: draft.sample_posts.filter((_, at) => at !== index),
                  })
                }
              >
                <Trash2 size={13} />
              </Button>
            </div>
            <Textarea
              id={`brand-sample-${index}`}
              value={sample}
              maxLength={LIMITS.sample}
              rows={6}
              className={cx(fieldClass, "min-h-36 resize-y p-3 leading-6")}
              placeholder="Paste something you wrote…"
              onChange={(e) =>
                change({
                  ...draft,
                  sample_posts: draft.sample_posts.map((value, at) =>
                    at === index ? e.target.value : value,
                  ),
                })
              }
            />
            <p className="mt-2 text-right text-[10px] tabular-nums text-muted-foreground">
              {sample.length.toLocaleString()} / {LIMITS.sample.toLocaleString()}
            </p>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="secondary-btn"
            disabled={draft.sample_posts.length >= LIMITS.samples}
            onClick={() =>
              change({ ...draft, sample_posts: [...draft.sample_posts, ""] })
            }
          >
            <Plus size={14} />
            Add writing sample
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {draft.sample_posts.length} of {LIMITS.samples} samples · Used as
            references, without training a custom model.
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {BRAND_CHANNELS.map((channel) => (
        <div key={channel.id} className="rounded-xl border border-border/70 p-4">
          <BrandTextField
            name={`channel-${channel.id}`}
            label={channel.name}
            hint={channel.hint}
            value={draft.platform_instructions[channel.id] ?? ""}
            max={LIMITS.channel}
            multiline
            placeholder="Use the brand defaults, or add a little guidance…"
            onChange={(value) =>
              change({
                ...draft,
                platform_instructions: {
                  ...draft.platform_instructions,
                  [channel.id]: value,
                },
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                    */
/* -------------------------------------------------------------------------- */

function BrandEditor({
  workspaceId,
  workspaceName,
  setOpen,
}: {
  workspaceId: string;
  workspaceName: string;
  setOpen: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const input = { workspaceId };
  const query = useSuspenseQuery(trpc.persona.brand.queryOptions(input));
  const save = useMutation(trpc.persona.saveBrand.mutationOptions());

  const [edit, setEdit] = useState<{
    draft: BrandDraft;
    updatedAt: string | null;
  } | null>(null);
  const [section, setSection] = useState<Section>("identity");
  const [confirmation, setConfirmation] = useState<"close" | "reload" | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseline = brandValues(query.data);
  const draft = edit?.draft ?? baseline;
  const canEdit = query.data.can_edit;
  const dirty = edit !== null && JSON.stringify(draft) !== JSON.stringify(baseline);
  const progress = brandProgress(draft);
  const current = SECTIONS.find((item) => item.id === section)!;

  const dirtySections = new Set<Section>(
    dirty
      ? SECTIONS.filter((s) =>
          s.fields.some(
            (f) => JSON.stringify(draft[f]) !== JSON.stringify(baseline[f]),
          ),
        ).map((s) => s.id)
      : [],
  );

  function close() {
    if (save.isPending) return;
    if (dirty) setConfirmation("close");
    else setOpen(false);
  }

  function change(next: BrandDraft) {
    setEdit({
      draft: next,
      updatedAt: edit ? edit.updatedAt : query.data.updated_at,
    });
    setSaved(false);
    setError(null);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!dirty || save.isPending || !canEdit) return;

    const checked = brandSchema.safeParse(draft);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      const field = String(issue.path[0] ?? "");
      setSection(sectionOfField(field));
      setError(
        `${issue.path.join(" ").replaceAll("_", " ")}: ${issue.message}`,
      );
      return;
    }

    setError(null);
    try {
      const result = await save.mutateAsync({
        workspaceId,
        profile: checked.data,
        expectedUpdatedAt: edit ? edit.updatedAt : query.data.updated_at,
      });
      cache.setQueryData(trpc.persona.brand.queryKey(input), result);
      setEdit(null);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save your brand profile. Your edits are still here.",
      );
    }
  }

  const status = saved
    ? "Saved · Ready for your next AI draft"
    : dirty
      ? `Unsaved changes in ${dirtySections.size} ${dirtySections.size === 1 ? "section" : "sections"}`
      : "Applies to every channel in this workspace";

  return (
    <>
      <Dialog
        open
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        <DialogContent className={modalClass} showCloseButton={false}>
          <Header close={close} busy={save.isPending} />
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* Sidebar / tab strip */}
            <nav
              aria-label="Brand profile sections"
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 bg-muted/15 p-2.5 sm:w-56 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4"
            >
              <div className="mb-3 hidden rounded-xl border border-border/60 bg-background p-3.5 sm:block">
                <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  Workspace brand
                </span>
                <p className="mt-1 truncate text-sm font-medium">
                  {draft.display_name || workspaceName}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {draft.role || "Your next chapter starts here"}
                </p>
                <div
                  role="img"
                  className="mt-3 flex items-center gap-1"
                  aria-label={`${progress.completed} of ${progress.total} profile details added`}
                >
                  {Array.from({ length: progress.total }, (_, i) => (
                    <span
                      key={i}
                      className={cx(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        i < progress.completed ? "bg-emerald-400" : "bg-muted",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {progress.completed === progress.total
                    ? "A strong foundation for your writing"
                    : `${progress.completed} of ${progress.total} details added`}
                </p>
              </div>

              {SECTIONS.map((item) => {
                const active = section === item.id;
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    disabled={save.isPending}
                    onClick={() => setSection(item.id)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "h-10 shrink-0 justify-start gap-2.5 rounded-lg px-3 text-xs",
                      active
                        ? "border border-border/60 bg-background text-foreground shadow-xs"
                        : "text-muted-foreground",
                    )}
                  >
                    <item.icon size={15} />
                    {item.label}
                    {dirtySections.has(item.id) && (
                      <>
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full bg-amber-400"
                        />
                        <span className="sr-only">(unsaved changes)</span>
                      </>
                    )}
                    {active && (
                      <ChevronRight className="ml-auto hidden size-3 sm:block" />
                    )}
                  </Button>
                );
              })}

              <div className="mt-auto hidden px-3 pb-2 pt-8 text-[11px] leading-5 text-muted-foreground sm:block">
                {/* <Sparkles className="mb-2 size-4 text-violet-400" /> */}
                Your saved profile is used automatically when Draftva writes or
                refines a post.
              </div>
            </nav>

            {/* Form */}
            <form
              onSubmit={(event) => void submit(event)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                <div className="mx-auto max-w-2xl">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-violet-500">
                    {current.caption}
                  </p>
                  <h2 className="mt-2 font-heading text-2xl font-medium tracking-tight">
                    {current.title}
                  </h2>
                  <p className="mb-7 mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
                    {current.description}
                  </p>

                  {!canEdit && (
                    <p className="mb-5 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      You can view this profile. An owner, admin, or editor can
                      update it.
                    </p>
                  )}

                  <fieldset
                    disabled={save.isPending || !canEdit}
                    className="min-w-0 border-0 p-0"
                  >
                    <legend className="sr-only">{current.label}</legend>
                    <BrandFields section={section} draft={draft} change={change} />
                  </fieldset>
                </div>
              </div>

              <footer className="shrink-0 border-t border-border/70 bg-muted/10 px-5 py-4 sm:px-8">
                {error && (
                  <div
                    role="alert"
                    className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    <span className="min-w-0 flex-1">{error}</span>
                    {save.error?.data?.code === "CONFLICT" && (
                      <Button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setConfirmation("reload")}
                      >
                        Reload saved profile
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    role="status"
                    aria-live="polite"
                    className={cx(
                      "mr-auto flex items-center gap-1.5 text-[11px]",
                      saved
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {saved && <Check size={12} />}
                    {status}
                  </p>
                  <Button
                    type="button"
                    className="secondary-btn"
                    disabled={save.isPending}
                    onClick={close}
                  >
                    {dirty ? "Cancel" : "Done"}
                  </Button>
                  <Button
                    type="submit"
                    className="primary-btn"
                    disabled={!dirty || save.isPending || !canEdit}
                  >
                    {save.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    {save.isPending ? "Saving…" : "Save profile"}
                  </Button>
                </div>
              </footer>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm discard / reload */}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(next) => {
          if (!next) setConfirmation(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation === "reload"
                ? "Reload the saved profile?"
                : "Discard your changes?"}
            </DialogTitle>
            <DialogDescription>
              {confirmation === "reload"
                ? "Your unsaved edits will be discarded and replaced with the latest saved brand profile."
                : "You have unsaved brand profile details. Keep editing to save them, or discard this edit."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex justify-end gap-2">
            <Button className="secondary-btn" onClick={() => setConfirmation(null)}>
              Keep editing
            </Button>
            <Button
              className="primary-btn"
              onClick={() => {
                const reload = confirmation === "reload";
                setConfirmation(null);
                if (reload) {
                  setEdit(null);
                  setError(null);
                  void query.refetch();
                } else setOpen(false);
              }}
            >
              {confirmation === "reload" ? "Discard and reload" : "Discard changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Entry points                                                              */
/* -------------------------------------------------------------------------- */

function WorkspaceBrand({ setOpen }: { setOpen: (open: boolean) => void }) {
  const trpc = useTRPC();
  const { data: workspace } = useSuspenseQuery(
    trpc.workspace.current.queryOptions(),
  );
  return (
    <BrandEditor
      key={workspace.id}
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      setOpen={setOpen}
    />
  );
}

export function PersonaDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  if (!open) return null;
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <BrandBoundary retry={reset} close={() => setOpen(false)}>
          <Suspense fallback={<LoadingDialog close={() => setOpen(false)} />}>
            <WorkspaceBrand setOpen={setOpen} />
          </Suspense>
        </BrandBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}