"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Loader2,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useAiAllowance, useRefreshUsage } from "@/modules/billing/useAiAllowance";
import { AiUsageNotice } from "@/modules/billing/component/AiUsageNotice";
import { useTRPC } from "@/trpc/client";
import type {
  Account,
  Feature,
  Payload,
  SubredditProfile,
} from "@/modules/studio/types";
import { applyWritingOutput, featureDefaults, profileFor } from "./model";

export type RefineContext = {
  text?: string;
  index: number;
  start?: number;
  end?: number;
};
type Preferences = {
  instructions: string;
  language: string;
  voice: string;
  commands: Record<string, string>;
};
const refinements = [
  "Fix grammar",
  "Improve writing",
  "Make it punchier",
  "Condense",
  "Rephrase / mix it up",
  "Expand & elaborate",
  "Improve structure & spacing",
  "Rewrite in a positive tone",
];

function loadPreferences(key: string): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    if (value && typeof value.instructions === "string")
      return {
        instructions: value.instructions,
        language: value.language ?? "",
        voice: value.voice ?? "",
        commands: value.commands ?? {},
      };
  } catch {
    /* Use the account's defaults when storage is unavailable. */
  }
  return { instructions: "", language: "", voice: "", commands: {} };
}

function ResultValue({
  value,
  onChoose,
  label = "",
}: {
  value: unknown;
  onChoose?: (value: string, field: string) => void;
  label?: string;
}) {
  if (value == null) return null;
  if (typeof value === "string")
    return (
      <div className="space-y-1">
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-xs leading-loose text-foreground">
          {value}
        </p>
        {onChoose &&
          [
            "hooks",
            "titles",
            "alternatives",
            "replies",
            "quote_posts",
            "variants",
          ].includes(label) && (
            <button
              className="flex items-center gap-1.25 border border-border rounded p-1.5 px-2 text-[10px] mt-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              onClick={() => onChoose(value, label)}
            >
              Use this <ArrowUpRight size={13} />
            </button>
          )}
      </div>
    );
  if (Array.isArray(value))
    return (
      <div className="flex flex-col gap-5">
        {value.map((item, i) => (
          <ResultValue key={i} value={item} label={label} onChoose={onChoose} />
        ))}
      </div>
    );
  if (typeof value === "object")
    return (
      <div className="flex flex-col gap-5 [&_h4]:text-[10px] [&_h4]:capitalize [&_h4]:text-muted-foreground [&_h4]:mb-1.5 [&_h4]:font-semibold">
        {Object.entries(value).map(([key, item]) => (
          <div key={key}>
            <h4>{key.replaceAll("_", " ")}</h4>
            <ResultValue value={item} label={key} onChoose={onChoose} />
          </div>
        ))}
      </div>
    );
  return (
    <p>{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</p>
  );
}

export default function WritingAssistant({
  account,
  workspaceId,
  payload,
  revision,
  editable,
  refine,
  onApply,
  onClose,
  subreddit,
}: {
  account: Account;
  workspaceId: string;
  payload: Payload;
  revision: string;
  editable: boolean;
  refine: RefineContext;
  onApply: (value: Payload, revision: string, context: RefineContext) => void;
  onClose: () => void;
  subreddit?: SubredditProfile;
}) {
  const trpc = useTRPC();
  const allowance = useAiAllowance(workspaceId);
  const refreshUsage = useRefreshUsage();
  const features = useQuery(trpc.studio.features.queryOptions());
  const voices = useQuery(
    trpc.studio.resource.queryOptions({ kind: "voices" }),
  );
  const [selected, setSelected] = useState<Feature | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [command, setCommand] = useState("");
  const [textEdited, setTextEdited] = useState(false);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState(false);
  const prefKey = `draftva:writing-preferences:${workspaceId}:${account.id}`;
  const [preferences, setPreferences] = useState(() =>
    loadPreferences(prefKey),
  );
  const [result, setResult] = useState<{
    output: Payload;
    revision: string;
    context: RefineContext;
    issues: { message: string; severity: string }[];
  } | null>(null);
  const run = useMutation(trpc.studio.runFeature.mutationOptions({onSettled: () => {void refreshUsage();}}));
  const platformFeatures = (features.data ?? []).filter(
    (feature) =>
      feature.platforms.includes(account.platform) ||
      feature.platforms.includes("*"),
  );
  const profile = profileFor(account.platform);
  const stale = result && result.revision !== revision;
  function updatePreferences(next: Preferences) {
    setPreferences(next);
    try {
      localStorage.setItem(prefKey, JSON.stringify(next));
    } catch {
      /* Preferences still apply in the current session. */
    }
  }
  function choose(feature: Feature, chosenCommand = "") {
    setSelected(feature);
    setResult(null);
    run.reset();
    setCommand(chosenCommand);
    setTextEdited(false);
    const defaults = featureDefaults(feature, payload, account.platform);
    if (feature.id === "rewrite_with_tone") {
      if (refine.text) defaults.text = refine.text;
      else if (Array.isArray(payload.thread))
        defaults.text = String(
          (payload.thread[refine.index] as Payload)?.text ?? "",
        );
      defaults.tone =
        chosenCommand || "Keep my voice, improve clarity, and avoid clichés";
    }
    if (feature.id === "reddit_flair_suggestion" && subreddit)
      defaults.available_flairs = subreddit.available_flairs
        .map((flair) => flair.text)
        .join("\n");
    setValues(defaults);
  }
  async function submit() {
    if (!selected || allowance.blocked || run.isPending) return;
    const input: Payload = {};
    for (const [name, property] of Object.entries(
      selected.input_schema.properties ?? {},
    )) {
      const field =
        property.anyOf?.find((item) => item.type !== "null") ?? property;
      const raw = values[name];
      if (raw === undefined || !raw.trim()) {
        if (property.default !== undefined) input[name] = property.default;
        else if (field.default !== undefined) input[name] = field.default;
        continue;
      }
      input[name] = ["integer", "number"].includes(field.type ?? "")
        ? Number(raw)
        : field.type === "boolean"
          ? raw === "true"
          : field.type === "array"
            ? raw
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            : raw;
    }
    const expected = revision;
    const context = { ...refine };
    if (selected.id === "rewrite_with_tone" && !textEdited) {
      const text =
        refine.text ??
        (Array.isArray(payload.thread)
          ? String((payload.thread[refine.index] as Payload)?.text ?? "")
          : String(payload[profileFor(account.platform).textKey] ?? ""));
      input.text = text;
      setValues({ ...values, text });
    }
    setResult(null);
    try {
      const data = await run.mutateAsync({
        feature: selected.id,
        platform: account.platform,
        input_data: input,
        connected_account_id: account.id,
        validation_context: payload,
        voice_profile_id: preferences.voice || undefined,
        writing_instructions: [
          preferences.instructions,
          preferences.commands[command],
        ]
          .filter(Boolean)
          .join("\n")
          .slice(0, 2000),
        output_language: preferences.language,
      });
      setResult({
        output: data.output,
        revision: expected,
        context,
        issues: data.validation_issues ?? [],
      });
    } catch {
      /* The request error is rendered alongside the form. */
    }
  }
  function apply(output: Payload) {
    if (result && !stale && editable)
      onApply(output, result.revision, result.context);
  }
  return (
    <aside
      className="h-full flex flex-col min-h-0 text-xs bg-muted/15 border-l border-border w-[315px] shrink-0"
      aria-label={`${profile.name} writing assistant`}
    >
      <header className="h-12 px-4 flex items-center justify-between border-b border-border text-[11px] shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={15} />
          <strong>{profile.name} assistant</strong>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Assistant settings"
            onClick={() => setSettings(!settings)}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Close assistant"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
      </header>
      <div className="overflow-y-auto min-h-0 flex-1 p-4 sm:p-5 pb-6">
        <div className="flex items-center gap-1.75 text-muted-foreground text-[10px] overflow-hidden whitespace-nowrap truncate mb-7.5">
          <span className="size-[5px] rounded-full bg-foreground shrink-0" />
          {account.display_name}
        </div>
        <AiUsageNotice usage={allowance.data} loading={allowance.isPending} error={!!allowance.error} onRetry={() => void allowance.refetch()} />
        {settings ? (
          <section className="flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.75 [&_label]:text-[10px] [&_label]:text-muted-foreground [&_input]:w-full [&_input]:border [&_input]:border-border [&_input]:rounded-[7px] [&_input]:p-2.5 [&_input]:text-[11px] [&_input]:bg-background [&_input]:text-foreground [&_input]:leading-relaxed [&_input]:outline-none focus-within:[&_input]:ring-1 focus-within:[&_input]:ring-ring [&_textarea]:w-full [&_textarea]:border [&_textarea]:border-border [&_textarea]:rounded-[7px] [&_textarea]:p-2.5 [&_textarea]:text-[11px] [&_textarea]:bg-background [&_textarea]:text-foreground [&_textarea]:leading-relaxed [&_textarea]:outline-none [&_textarea]:resize-y focus-within:[&_textarea]:ring-1 focus-within:[&_textarea]:ring-ring [&_select]:w-full [&_select]:border [&_select]:border-border [&_select]:rounded-[7px] [&_select]:p-2.5 [&_select]:text-[11px] [&_select]:bg-background [&_select]:text-foreground [&_select]:leading-relaxed [&_select]:outline-none focus-within:[&_select]:ring-1 focus-within:[&_select]:ring-ring">
            <button className="inline-flex items-center gap-1.5 text-muted-foreground text-[10px] mb-6 hover:text-foreground cursor-pointer transition-colors" onClick={() => setSettings(false)}>
              <ArrowLeft size={14} />
              Back to writing
            </button>
            <h2 className="font-serif text-[22px] font-medium tracking-tight leading-snug">Make it sound like you</h2>
            <p className="text-muted-foreground text-[11px] leading-relaxed -mt-1">Writing preferences stay with this account.</p>
            <label>
              Voice profile
              <select
                value={preferences.voice}
                onChange={(e) =>
                  updatePreferences({ ...preferences, voice: e.target.value })
                }
              >
                <option value="">Use platform defaults</option>
                {(Array.isArray(voices.data) ? voices.data : []).map(
                  (voice) => (
                    <option value={String(voice.id)} key={String(voice.id)}>
                      {String(voice.name ?? voice.tone_description)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Always write in
              <input
                placeholder="Auto-detect language"
                maxLength={80}
                value={preferences.language}
                onChange={(e) =>
                  updatePreferences({
                    ...preferences,
                    language: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Your writing instructions
              <textarea
                rows={4}
                maxLength={1200}
                placeholder="Keep my sentences direct. Avoid corporate language…"
                value={preferences.instructions}
                onChange={(e) =>
                  updatePreferences({
                    ...preferences,
                    instructions: e.target.value,
                  })
                }
              />
            </label>
            {["Condense", "Make it punchier", "Improve writing"].map((name) => (
              <label key={name}>
                {name}
                <textarea
                  rows={2}
                  maxLength={600}
                  placeholder="Extra instructions for this command…"
                  value={preferences.commands[name] ?? ""}
                  onChange={(e) =>
                    updatePreferences({
                      ...preferences,
                      commands: {
                        ...preferences.commands,
                        [name]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
          </section>
        ) : selected ? (
          <>
            <button
              className="inline-flex items-center gap-1.5 text-muted-foreground text-[10px] mb-6 hover:text-foreground cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={run.isPending}
              onClick={() => {
                setSelected(null);
                setResult(null);
              }}
            >
              <ArrowLeft size={14} />
              All commands
            </button>
            <h2 className="font-serif text-[22px] font-medium tracking-tight leading-snug">{command || selected.name}</h2>
            <p className="text-[11px] leading-[1.85] text-muted-foreground my-2.5 mb-4.5">
              {selected.description}
            </p>
            {refine.text && (
              <p className="p-2.5 rounded-md bg-muted text-[10px] text-muted-foreground leading-relaxed mb-3.5">
                Working on your selected text.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:gap-1.75 [&_label]:text-[10px] [&_label]:text-muted-foreground [&_input]:w-full [&_input]:border [&_input]:border-border [&_input]:rounded-[7px] [&_input]:p-2.5 [&_input]:text-[11px] [&_input]:bg-background [&_input]:text-foreground [&_input]:leading-relaxed [&_input]:outline-none focus-within:[&_input]:ring-1 focus-within:[&_input]:ring-ring [&_textarea]:w-full [&_textarea]:border [&_textarea]:border-border [&_textarea]:rounded-[7px] [&_textarea]:p-2.5 [&_textarea]:text-[11px] [&_textarea]:bg-background [&_textarea]:text-foreground [&_textarea]:leading-relaxed [&_textarea]:outline-none [&_textarea]:resize-y focus-within:[&_textarea]:ring-1 focus-within:[&_textarea]:ring-ring [&_select]:w-full [&_select]:border [&_select]:border-border [&_select]:rounded-[7px] [&_select]:p-2.5 [&_select]:text-[11px] [&_select]:bg-background [&_select]:text-foreground [&_select]:leading-relaxed [&_select]:outline-none focus-within:[&_select]:ring-1 focus-within:[&_select]:ring-ring"
            >
              {Object.entries(selected.input_schema.properties ?? {}).map(
                ([name, property]) => {
                  const field =
                    property.anyOf?.find((item) => item.type !== "null") ??
                    property;
                  const required =
                    selected.input_schema.required?.includes(name);
                  const label = property.title ?? name.replaceAll("_", " ");
                  return (
                    <label key={name}>
                      {label}
                      {required && <span> *</span>}
                      {field.type === "boolean" ? (
                        <select
                          value={values[name] ?? String(field.default ?? false)}
                          onChange={(e) =>
                            setValues({ ...values, [name]: e.target.value })
                          }
                        >
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : field.enum ? (
                        <select
                          required={required}
                          value={values[name] ?? ""}
                          onChange={(e) =>
                            setValues({ ...values, [name]: e.target.value })
                          }
                        >
                          <option value="">Choose…</option>
                          {field.enum.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : ["integer", "number"].includes(field.type ?? "") ? (
                        <input
                          type="number"
                          min={field.minimum}
                          max={field.maximum}
                          required={required}
                          value={values[name] ?? ""}
                          onChange={(e) =>
                            setValues({ ...values, [name]: e.target.value })
                          }
                        />
                      ) : (
                        <textarea
                          rows={name === "text" || name === "draft" ? 5 : 2}
                          required={required}
                          minLength={field.minLength}
                          maxLength={field.maxLength}
                          placeholder={
                            field.type === "array"
                              ? "One item per line"
                              : field.description
                          }
                          value={values[name] ?? ""}
                          onChange={(e) => {
                            setValues({ ...values, [name]: e.target.value });
                            if (name === "text") setTextEdited(true);
                          }}
                        />
                      )}
                    </label>
                  );
                },
              )}
              <button
                className="primary-btn mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={run.isPending || allowance.blocked || account.status === "disabled"}
              >
                {run.isPending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Writing…
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Write it
                  </>
                )}
              </button>
            </form>
            {run.error && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap" role="alert">
                {run.error.message}
              </p>
            )}
            {result && (
              <section className="mt-7 border-t border-border pt-5">
                <div className="flex items-center gap-1.75 text-[11px] text-muted-foreground mb-5">
                  <Check size={14} />
                  <strong>Your result</strong>
                </div>
                <ResultValue
                  value={result.output}
                  onChoose={
                    editable &&
                    !stale &&
                    !result.issues.some((issue) => issue.severity === "error")
                      ? (value, field) =>
                          apply(
                            field === "titles"
                              ? {
                                  title: value,
                                  body: String(payload.body ?? ""),
                                }
                              : { rewritten_text: value },
                          )
                      : undefined
                  }
                />
                {result.issues.map((issue, i) => (
                  <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap" key={i}>
                    {issue.message}
                  </p>
                ))}
                {stale ? (
                  <p className="p-2.5 rounded-md bg-muted text-[10px] text-muted-foreground leading-relaxed mb-3.5">
                    The draft changed. Generate again to apply to the current
                    version.
                  </p>
                ) : editable &&
                  applyWritingOutput(
                    result.output,
                    payload,
                    account.platform,
                  ) &&
                  !result.issues.some((issue) => issue.severity === "error") ? (
                  <button
                    className="primary-btn mt-5 disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={() => apply(result.output)}
                  >
                    Use in editor
                    <ArrowUpRight size={14} />
                  </button>
                ) : (
                  <p className="text-[11px] leading-[1.85] text-muted-foreground my-2.5 mb-4.5">
                    Use this as a reference while shaping your post.
                  </p>
                )}
              </section>
            )}
          </>
        ) : (
          <>
            <h2 className="font-serif text-[22px] font-medium tracking-tight leading-snug">What are we writing?</h2>
            <p className="text-[11px] leading-[1.85] text-muted-foreground my-2.5 mb-4.5">{profile.help}</p>
            <input
              className="w-full border border-border p-2.5 rounded-[7px] bg-transparent text-[11px] mb-3 outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground placeholder:text-muted-foreground/60"
              aria-label="Search writing commands"
              placeholder="Search a command…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col gap-1.25 [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:text-left [&_button]:gap-2 [&_button]:border [&_button]:border-border/80 [&_button]:rounded-md [&_button]:p-2.5 [&_button]:bg-background [&_button]:text-[11px] [&_button]:leading-snug hover:[&_button]:bg-muted [&_button]:transition-colors [&_button]:cursor-pointer [&_svg]:opacity-30 [&_svg]:shrink-0">
              {platformFeatures
                .filter(
                  (feature) =>
                    feature.id !== "rewrite_with_tone" &&
                    !feature.platforms.includes("*") &&
                    `${feature.name} ${feature.description}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                )
                .map((feature) => (
                  <button key={feature.id} onClick={() => choose(feature)}>
                    <span>{feature.name}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
            </div>
            <h3 className="text-[10px] text-muted-foreground mt-6 mb-2.5 font-medium">Refine your draft</h3>
            <div className="flex flex-col gap-1.25 [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:text-left [&_button]:gap-2 [&_button]:border [&_button]:border-border/80 [&_button]:rounded-md [&_button]:p-2.5 [&_button]:bg-background [&_button]:text-[11px] [&_button]:leading-snug hover:[&_button]:bg-muted [&_button]:transition-colors [&_button]:cursor-pointer [&_svg]:opacity-30 [&_svg]:shrink-0">
              {refinements
                .filter((name) =>
                  name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((name) => (
                  <button
                    key={name}
                    onClick={() => {
                      const feature = platformFeatures.find(
                        (item) => item.id === "rewrite_with_tone",
                      );
                      if (feature) choose(feature, name);
                    }}
                  >
                    <span>{name}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
            </div>
            <h3 className="text-[10px] text-muted-foreground mt-6 mb-2.5 font-medium">Across channels</h3>
            <div className="flex flex-col gap-1.25 [&_button]:flex [&_button]:items-center [&_button]:justify-between [&_button]:text-left [&_button]:gap-2 [&_button]:border [&_button]:border-border/80 [&_button]:rounded-md [&_button]:p-2.5 [&_button]:bg-background [&_button]:text-[11px] [&_button]:leading-snug hover:[&_button]:bg-muted [&_button]:transition-colors [&_button]:cursor-pointer [&_svg]:opacity-30 [&_svg]:shrink-0">
              {platformFeatures
                .filter(
                  (feature) =>
                    feature.platforms.includes("*") &&
                    feature.id !== "rewrite_with_tone" &&
                    feature.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((feature) => (
                  <button key={feature.id} onClick={() => choose(feature)}>
                    <span>{feature.name}</span>
                    <ChevronRight size={14} />
                  </button>
                ))}
            </div>
            {features.isPending && (
              <p className="text-[11px] leading-[1.85] text-muted-foreground my-2.5 mb-4.5">Loading commands…</p>
            )}
            {features.error && (
              <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">{features.error.message}</p>
            )}
          </>
        )}
      </div>
      <footer className="flex items-center justify-between gap-2.5 border-t border-border p-3 px-4 text-[9px] text-muted-foreground leading-relaxed shrink-0">
        <span>Suggestions stay in your draft until you apply them.</span>
        <button
          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          aria-label="Open writing preferences"
          onClick={() => setSettings(true)}
        >
          <Settings2 size={14} />
        </button>
      </footer>
    </aside>
  );
}
