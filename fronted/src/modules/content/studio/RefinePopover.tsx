"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Copy,
  Flame,
  Lightbulb,
  ListStart,
  Loader2,
  MessageCircleHeart,
  Minimize2,
  Rocket,
  Settings,
  Smile,
  TextAlignStart,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REFINE_COMMANDS,
  readRefinePreferences,
  refinementChanges,
  type RefinePreferences,
} from "./refinement";
import { textLength } from "./model";
import "./refine.css";

const icons = [
  CheckCheck,
  WandSparkles,
  Flame,
  Minimize2,
  Undo2,
  Lightbulb,
  TextAlignStart,
  MessageCircleHeart,
  ListStart,
  Smile,
  Rocket,
];
const languages = [
  { value: "", label: "Detect automatically" },
  ...[
    "American English",
    "British English",
    "Hindi",
    "Spanish",
    "French",
    "German",
    "Portuguese",
    "Japanese",
  ].map((value) => ({ value, label: value })),
];
export type RefineResult = {
  text: string;
  apply: (mode: "replace" | "insert") => boolean;
};
export type RefineRequest = {
  command: string;
  custom: string;
  preferences: RefinePreferences;
  previous?: string;
  followup?: string;
};

export default function RefinePopover({
  anchor,
  source,
  platform,
  accountName,
  preferencesKey,
  onClose,
  onGenerate,
}: {
  anchor: HTMLElement | null;
  source: string;
  platform: string;
  accountName: string;
  preferencesKey: string;
  onClose: () => void;
  onGenerate: (
    request: RefineRequest,
    signal: AbortSignal,
  ) => Promise<RefineResult>;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [view, setView] = useState<"menu" | "settings" | "result">("menu");
  const [preferences, setPreferences] = useState<RefinePreferences>(() => {
    try {
      return readRefinePreferences(localStorage.getItem(preferencesKey));
    } catch {
      return readRefinePreferences(null);
    }
  });
  const [result, setResult] = useState<RefineResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [followup, setFollowup] = useState("");
  const [last, setLast] = useState<RefineRequest | null>(null);
  const controller = useRef<AbortController | null>(null);
  const responseFocus = useRef<HTMLDivElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (view === "result" && !busy && result && !error)
      responseFocus.current?.focus();
  }, [view, busy, result, error]);
  const filtered = REFINE_COMMANDS.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase()),
  );
  const changes = refinementChanges(source, result?.text ?? "");
  const label =
    REFINE_COMMANDS.find((item) => item.id === last?.command)?.label ??
    last?.custom ??
    "Refine";

  async function generate(request: RefineRequest) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setLast(request);
    setView("result");
    try {
      const next = await onGenerate(request, abort.signal);
      if (!abort.signal.aborted) {
        setResult(next);
        setFollowup("");
      }
    } catch (err) {
      if (!abort.signal.aborted)
        setError(
          err instanceof Error
            ? err.message
            : "Could not refine your text. Please retry.",
        );
    } finally {
      if (controller.current === abort) controller.current = null;
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function run(command: string, custom = "") {
    if (!source.trim()) return;
    setResult(null);
    void generate({ command, custom, preferences });
  }
  function apply(mode: "replace" | "insert") {
    if (!busy && result?.apply(mode)) onClose();
  }
  function savePreferences() {
    try {
      localStorage.setItem(preferencesKey, JSON.stringify(preferences));
      setView("menu");
    } catch {
      toast.error("Could not save your refine settings on this device.");
    }
  }
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <PopoverContent
        anchor={anchor}
        align="end"
        className="refine-popover"
        aria-label="Refine"
        finalFocus={() => anchor}
        onKeyDown={(event) => {
          if (view !== "result" || busy) return;
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            apply("replace");
          } else if (event.shiftKey && event.key === "Enter") {
            event.preventDefault();
            apply("insert");
          } else if (
            event.key.toLowerCase() === "r" &&
            !(
              event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLTextAreaElement
            ) &&
            last
          ) {
            event.preventDefault();
            void generate(last);
          }
        }}
      >
        {view === "menu" ? (
          <>
            <div className="refine-search">
              <Input
                autoFocus
                aria-label="Search or type a custom prompt"
                placeholder="Search or type a custom prompt…"
                maxLength={1000}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive(
                      (i) =>
                        (i +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          Math.max(1, filtered.length)) %
                        Math.max(1, filtered.length),
                    );
                  }
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    if (filtered[active]) run(filtered[active].id);
                    else if (query.trim()) run("custom", query.trim());
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="AI Refine Settings"
                onClick={() => setView("settings")}
              >
                <Settings size={18} />
              </Button>
            </div>
            {!source.trim() && (
              <p className="refine-empty">
                Write something in your draft to refine it.
              </p>
            )}
            <div className="refine-commands" aria-label="Refine commands">
              {filtered.map((item, index) => {
                const Icon = icons[REFINE_COMMANDS.indexOf(item)];
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={`refine-command ${index === active ? "is-active" : ""}`}
                    disabled={!source.trim()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => run(item.id)}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Button>
                );
              })}
              {query.trim() && (
                <Button
                  variant="ghost"
                  className="refine-command refine-custom"
                  disabled={!source.trim()}
                  onClick={() => run("custom", query.trim())}
                >
                  <WandSparkles size={18} />
                  <span>Run custom prompt: {query.trim()}</span>
                  <ArrowRight size={15} />
                </Button>
              )}
            </div>
          </>
        ) : view === "settings" ? (
          <>
            <div className="refine-heading">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to refine commands"
                onClick={() => setView("menu")}
              >
                <ArrowLeft size={16} />
              </Button>
              <h3>AI Refine Settings</h3>
            </div>
            <div className="refine-settings">
              <p>Customize these commands to fit your tone and style.</p>
              {REFINE_COMMANDS.map((item) => (
                <div className="refine-setting" key={item.id}>
                  <Label htmlFor={`refine-${item.id}`}>{item.label}</Label>
                  <Textarea
                    id={`refine-${item.id}`}
                    placeholder="Write extra instructions here…"
                    maxLength={1000}
                    value={preferences.commands[item.id] ?? ""}
                    onChange={(event) =>
                      setPreferences((p) => ({
                        ...p,
                        commands: {
                          ...p.commands,
                          [item.id]: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
              ))}
              <p className="refine-account">{accountName} specific settings</p>
              <Label>Always reply in this language</Label>
              <Select
                items={languages}
                value={preferences.language}
                onValueChange={(value) =>
                  setPreferences((p) => ({ ...p, language: value ?? "" }))
                }
              >
                <SelectTrigger
                  aria-label="Refine response language"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="refine-settings-footer">
              <Button onClick={savePreferences}>Save settings</Button>
            </div>
          </>
        ) : (
          <>
            <div className="refine-heading">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Back to refine commands"
                disabled={busy}
                onClick={() => {
                  setView("menu");
                  setError("");
                }}
              >
                <ArrowLeft size={16} />
              </Button>
              <h3>{label}</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                aria-label="Close refine"
                onClick={onClose}
              >
                <X size={16} />
              </Button>
            </div>
            {busy ? (
              <div className="refine-loading" role="status">
                <Loader2 size={18} className="animate-spin" />
                Refining your text…
              </div>
            ) : error ? (
              <p className="refine-error" role="alert">
                {error}
              </p>
            ) : (
              result && (
                <>
                  <div
                    className="refine-result"
                    ref={responseFocus}
                    aria-label="Refined text"
                    tabIndex={0}
                  >
                    {changes.map((part, index) =>
                      part.added ? (
                        <mark key={index}>{part.text}</mark>
                      ) : (
                        part.text
                      ),
                    )}
                  </div>
                  <div
                    className="refine-count"
                    aria-label="Character count before and after"
                  >
                    {textLength(source, platform)}
                    <ArrowRight size={13} />
                    {textLength(result.text, platform)}
                  </div>
                </>
              )
            )}
            <div className="refine-actions">
              <Button
                className="refine-replace"
                size="sm"
                disabled={busy || !result || !!error}
                onClick={() => apply("replace")}
              >
                Replace <kbd>⌘ ↵</kbd>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !result || !!error}
                onClick={() => apply("insert")}
              >
                Insert <kbd>⇧ ↵</kbd>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !last}
                onClick={() => last && void generate(last)}
              >
                Retry <kbd>R</kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy || !result || !!error}
                aria-label="Copy refined text"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result!.text);
                    toast.success("Refined text copied");
                  } catch {
                    toast.error("Could not copy the refined text.");
                  }
                }}
              >
                <Copy size={16} />
              </Button>
            </div>
            <form
              className="refine-followup"
              onSubmit={(event) => {
                event.preventDefault();
                if (followup.trim() && result && last && !busy)
                  void generate({
                    ...last,
                    preferences,
                    previous: result.text,
                    followup: followup.trim(),
                  });
              }}
            >
              <Input
                aria-label="Refine this response"
                placeholder="Refine this response…"
                value={followup}
                maxLength={1000}
                disabled={busy || !result || !!error}
                onChange={(event) => setFollowup(event.target.value)}
              />
              {followup.trim() && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Submit follow-up refinement"
                  disabled={busy || !result || !!error}
                  type="submit"
                >
                  <ArrowRight size={18} />
                </Button>
              )}
            </form>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
