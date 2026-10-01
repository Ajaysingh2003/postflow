"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SOURCE_ACCEPT } from "../assets";
import type { SourceAsset } from "../assets";
import { useAssetQueue } from "../hooks/useAssetQueue";
import { AssetCards, PendingAssetCards } from "./AssetCards";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Clock3,
  Lightbulb,
  Megaphone,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { useComposer } from "../context/ComposerContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { DraftArtifactCard } from "./DraftArtifactCard";
import { CommandDialog } from "./CommandDialog";
import { DEFAULT_COMMANDS, getCommandIcon, type CommandItem } from "../types";
import GenerateAvatar from "@/modules/user/component/GenerateAvartar";
import { PersonaDialog } from "./PersonaDialog";

const SHIMMER_BASE = "#8a929c";

/** Gray text with a light highlight sweeping left to right. */
function Shimmer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.backgroundImage = "none";
      el.style.setProperty("color", SHIMMER_BASE);
      el.style.setProperty("-webkit-text-fill-color", SHIMMER_BASE);
      return undefined;
    }

    const animation = el.animate(
      [{ backgroundPosition: "200% 0" }, { backgroundPosition: "0% 0" }],
      { duration: 2400, iterations: Infinity, easing: "linear" },
    );
    return () => animation.cancel();
  }, []);

  return (
    <span
      ref={ref}
      className="bg-[linear-gradient(90deg,#8a929c_0%,#8a929c_38%,#d5d9df_50%,#8a929c_62%,#8a929c_100%)] bg-[length:200%_100%] bg-clip-text text-transparent [-webkit-text-fill-color:transparent]"
    >
      {children}
    </span>
  );
}

type Run = ReturnType<typeof useAgentChat>["runs"][number];
type Rating = "up" | "down";

const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-lg text-[#7d858f] transition-colors hover:bg-black/[0.05] hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:pointer-events-none disabled:opacity-40";

const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(16,24,40,0.05),0_0_0_0.5px_rgba(16,24,40,0.1)]";

function statusLabel(run: Run) {
  if (run.text || run.artifact) return "Writing your draft…";
  if (run.activities.length > 0) return "Working on it…";
  return "Thinking…";
}

function TraceRow({
  active = false,
  detail,
  children,
}: {
  icon: LucideIcon;
  active?: boolean;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-h-7 items-center gap-2.5 text-[14px] text-[#7d858f]">
      <span className="flex size-5 shrink-0 items-center justify-center">
        {active ? (
          <span className="size-1.5 animate-pulse rounded-full bg-sky-400" />
        ) : (
          <Check className="size-4 stroke-[1.8] text-[#a3aab3]" />
        )}
      </span>
      <span className="min-w-0 truncate">
        {active ? <Shimmer>{children}</Shimmer> : children}
      </span>
      {detail ? (
        <span className="min-w-0 truncate text-[#aab0b8]">{detail}</span>
      ) : null}
    </li>
  );
}

function StatusRow({ label }: { label: string }) {
  return (
    <li className="flex min-h-7 items-center gap-2.5 text-[15px]">
      <Sparkles className="size-4 shrink-0 stroke-[1.7] text-sky-400" />
      <Shimmer>{label}</Shimmer>
    </li>
  );
}

export function ComposerSidecar({
  onClose,
  styleOwner,
}: {
  onClose?: () => void;
  styleOwner?: string;
}) {
  const trpc = useTRPC();
  const { state, replaceDraftIfCurrent, isHydrated } = useComposer();
  const workspace = useQuery(trpc.workspace.current.queryOptions());
  const account = useQuery(
    trpc.workspace.getLinkedInConnection.queryOptions({
      connectionId: state.composer.connection_id ?? undefined,
    }),
  );
  const accountName = [account.data?.first_name, account.data?.last_name]
    .filter(Boolean)
    .join(" ");
  const writingStyleOwner =
    styleOwner ||
    accountName ||
    account.data?.public_identifier ||
    workspace.data?.name ||
    "Workspace";
  const query = useQuery(trpc.content.getCommands.queryOptions());
  const scope = `${workspace.data?.id ?? "loading"}:${state.localId}:${account.data?.id ?? "no-account"}`;
  const agent = useAgentChat(state, scope);
  const files = useAssetQueue(scope);
  const fileInput = useRef<HTMLInputElement>(null);
  const contextReady = isHydrated && !account.isPending && !!workspace.data;

  const [openPersona, setOpenPersona] = useState(false);

  const [input, setInput] = useState("");
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [editing, setEditing] = useState<CommandItem | null>(null);
  // UI-only for now — wire to a tRPC mutation when you want to store feedback.
  const [ratings, setRatings] = useState<Record<string, Rating>>({});

  const scroll = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (follow.current && scroll.current) {
      scroll.current.scrollTop = scroll.current.scrollHeight;
    }
  }, [agent.runs]);

  // Grow the textarea with its content, up to ~6 lines.
  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 156)}px`;
  }, [input]);

  async function send(prompt = input, previousAssets?: SourceAsset[]) {
    if (
      !contextReady ||
      agent.busy ||
      files.busy ||
      files.queue.some((item) => item.stage === "failed")
    )
      return;
    if (!prompt.trim() && files.assets.length)
      prompt = "Write a LinkedIn post based on these attached files.";
    if (prompt.trim().length < 3) return;
    const assets = previousAssets ?? files.assets;
    if (!previousAssets) {
      files.clear();
      setInput("");
    }
    follow.current = true;
    await agent.send(prompt, assets);
  }

  function rate(id: Run["id"], value: Rating) {
    const key = String(id);
    setRatings((prev) => {
      const next = { ...prev };
      if (next[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function openCommands(command: CommandItem | null) {
    setEditing(command);
    setCommandsOpen(true);
  }

  const commandsList =
    (query.data as CommandItem[] | undefined) ?? DEFAULT_COMMANDS;

  const dockClass = [
    "rounded-2xl bg-white px-4 pb-3 pt-3.5 transition-shadow duration-300",
    agent.busy
      ? "shadow-[0_0_0_0.5px_rgba(16,24,40,0.14),0_-8px_28px_-10px_rgba(56,189,248,0.4),0_1px_2px_rgba(16,24,40,0.05)]"
      : "shadow-[0_0_0_0.5px_rgba(16,24,40,0.12),0_1px_2px_rgba(16,24,40,0.05)] focus-within:shadow-[0_0_0_1px_rgba(56,189,248,0.55),0_4px_14px_rgba(56,189,248,0.12)]",
  ].join(" ");

  return (
    <aside className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#fafafa] text-[15px] text-[#23272c] antialiased">
      {openPersona && (
        <PersonaDialog open={openPersona} setOpen={setOpenPersona} />
      )}

      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b-[0.5px] border-black/10 px-3.5">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close assistant"
              className={ICON_BUTTON}
            >
              <X className="size-[18px] stroke-[1.6]" />
            </button>
          )}
          <h2 className="font-heading text-[16px] font-semibold tracking-tight text-neutral-900">
            Assistant
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Send feedback"
            title="Feedback"
            className={ICON_BUTTON}
          >
            <Megaphone className="size-[18px] stroke-[1.6]" />
          </button>
          <button
            type="button"
            onClick={() => openCommands(null)}
            aria-label="Manage writing commands"
            title="Commands"
            className={ICON_BUTTON}
          >
            <SlidersHorizontal className="size-[18px] stroke-[1.6]" />
          </button>
          <button
            type="button"
            aria-label="History"
            title="History"
            className={ICON_BUTTON}
          >
            <Clock3 className="size-[18px] stroke-[1.6]" />
          </button>
          <button
            type="button"
            disabled={agent.busy}
            onClick={() => agent.clear()}
            className="secondary-btn ml-1 !min-h-8 !rounded-lg !px-3 !text-[14px] disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-4 stroke-[2]" />
            New
          </button>
        </div>
      </header>

      {/* Conversation */}
      <div
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el) {
            follow.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }
        }}
        aria-label="Assistant work feed"
        aria-busy={agent.busy}
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6 [mask-image:linear-gradient(to_bottom,transparent,#000_16px)] [scrollbar-color:rgba(0,0,0,0.14)_transparent] [scrollbar-width:thin]"
      >
        {agent.runs.length === 0 ? (
          <div className="flex min-h-full flex-col justify-end">
            <div className="mb-6 px-1">
              <h3 className="font-heading text-[22px] font-semibold leading-tight tracking-tight text-neutral-900">
                What are we writing?
              </h3>
              <p className="font-subheading mt-1.5 text-[15px] leading-relaxed text-[#7d858f]">
                Pick a command or describe what you need.
              </p>
            </div>

            <ul className="space-y-2">
              {commandsList.map((cmd) => {
                const Icon =
                  typeof cmd.icon === "string"
                    ? getCommandIcon(cmd.icon)
                    : cmd.icon;
                return (
                  <li
                    key={cmd.id || cmd.label}
                    className={`group flex items-center rounded-xl bg-white pr-1.5 transition-all hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(16,24,40,0.08),0_0_0_0.5px_rgba(16,24,40,0.12)] ${CARD_SHADOW}`}
                  >
                    <button
                      type="button"
                      disabled={!contextReady}
                      onClick={() => void send(cmd.prompt)}
                      className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 text-left text-[15px] font-medium text-[#2f3640] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 disabled:opacity-40"
                    >
                      <Icon className="size-[18px] shrink-0 stroke-[1.6] text-[#7d858f]" />
                      <span className="truncate">{cmd.label}</span>
                      {cmd.isCustom && (
                        <span
                          className="size-1.5 shrink-0 rounded-full bg-sky-400"
                          title="Custom command"
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${cmd.label}`}
                      onClick={() => openCommands(cmd)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-0 transition hover:bg-black/[0.06] hover:text-neutral-700 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={() => openCommands(null)}
              className="mt-3 px-1 text-left text-[14px] text-[#8a929c] transition-colors hover:text-neutral-900"
            >
              Add and edit commands
            </button>
          </div>
        ) : (
          <div className="space-y-9">
            {agent.runs.map((run, index) => {
              const isLast = index === agent.runs.length - 1;
              const running = run.status === "running";
              const hasContent = Boolean(run.text || run.artifact);
              const hasTrace = run.activities.length > 0;
              const status = running ? (
                <StatusRow label={statusLabel(run)} />
              ) : null;
              const rated = ratings[String(run.id)];

              return (
                <article key={run.id} className="space-y-5">
                  {/* You */}
                  <div className="flex justify-end">
                    <div className="max-w-[88%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#eceef1] px-4 py-2.5 text-[15px] leading-[1.6] text-[#1d2126]">
                      {run.prompt}
                      {run.attachments.length > 0 && (
                        <AssetCards assets={run.attachments} />
                      )}
                    </div>
                  </div>

                  {/* Assistant */}
                  <div className="space-y-4">
                    {(hasTrace || (status && !hasContent)) && (
                      <ul className="space-y-1">
                        {hasTrace && (
                          <li className="flex min-h-7 items-center gap-2.5 text-[14px] text-[#7d858f]">
                            <Lightbulb className="size-5 shrink-0 stroke-[1.5] p-0.5" />
                            <span className="font-subheading">Thought</span>
                          </li>
                        )}
                        {run.activities.map((activity) => (
                          <TraceRow
                            key={activity.id}
                            icon={Lightbulb}
                            active={running && activity.status === "running"}
                            detail={activity.detail || undefined}
                          >
                            {activity.label}
                          </TraceRow>
                        ))}
                        {!hasContent && status}
                      </ul>
                    )}

                    {run.artifact &&
                      run.status !== "failed" &&
                      run.status !== "cancelled" && (
                        <DraftArtifactCard
                          artifact={run.artifact}
                          content={state.content}
                          ready={run.status === "succeeded"}
                          replace={(expected, next) =>
                            replaceDraftIfCurrent(state.localId, expected, next)
                          }
                        />
                      )}

                    {run.text && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.7] text-[#23272c]">
                        {run.text}
                      </p>
                    )}

                    {hasContent && status && <ul>{status}</ul>}

                    {(run.error || run.status === "cancelled") && (
                      <div
                        role={run.error ? "alert" : "status"}
                        className="rounded-xl bg-rose-50/70 px-4 py-3 text-[14.5px] leading-[1.55] text-rose-900 shadow-[0_0_0_0.5px_rgba(225,29,72,0.25)]"
                      >
                        <p className="flex items-start gap-2.5">
                          <AlertCircle className="mt-0.5 size-4 shrink-0" />
                          <span>
                            {run.error || "Stopped. Your draft is unchanged."}
                          </span>
                        </p>
                        <button
                          type="button"
                          disabled={agent.busy}
                          onClick={() => void send(run.prompt, run.attachments)}
                          className="secondary-btn mt-3 !min-h-8 !rounded-lg !px-3 !text-[13.5px] disabled:opacity-40"
                        >
                          <RotateCcw className="size-3.5" />
                          Retry with current draft
                        </button>
                      </div>
                    )}

                    {run.status === "succeeded" && hasContent && (
                      <div className="-ml-2 flex items-center gap-0.5">
                        {isLast && (
                          <button
                            type="button"
                            aria-label="Regenerate response"
                            title="Regenerate"
                            disabled={agent.busy}
                            onClick={() =>
                              void send(run.prompt, run.attachments)
                            }
                            className={ICON_BUTTON}
                          >
                            <RefreshCw className="size-4 stroke-[1.6]" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label="Good response"
                          aria-pressed={rated === "up"}
                          onClick={() => rate(run.id, "up")}
                          className={`${ICON_BUTTON} aria-pressed:bg-sky-50 aria-pressed:text-sky-600`}
                        >
                          <ThumbsUp className="size-4 stroke-[1.6]" />
                        </button>
                        <button
                          type="button"
                          aria-label="Bad response"
                          aria-pressed={rated === "down"}
                          onClick={() => rate(run.id, "down")}
                          className={`${ICON_BUTTON} aria-pressed:bg-black/[0.06] aria-pressed:text-neutral-900`}
                        >
                          <ThumbsDown className="size-4 stroke-[1.6]" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {agent.busy ? "Assistant is working" : "Assistant is ready"}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className={dockClass}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files"))
              event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (!agent.busy) {
              try {
                files.add(Array.from(event.dataTransfer.files));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not add files",
                );
              }
            }
          }}
        >
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={SOURCE_ACCEPT}
            className="hidden"
            aria-label="Choose assistant reference files"
            onChange={(event) => {
              try {
                files.add(Array.from(event.target.files ?? []));
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not add files",
                );
              }
              event.target.value = "";
            }}
          />
          {files.queue.length > 0 && (
            <PendingAssetCards
              items={files.queue}
              onRemove={files.remove}
              onRetry={files.retry}
            />
          )}
          <textarea
            ref={field}
            rows={1}
            value={input}
            maxLength={10000}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(event) => {
              const pasted = Array.from(event.clipboardData.files);
              if (pasted.length) {
                event.preventDefault();
                if (!agent.busy) {
                  try {
                    files.add(pasted);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Could not add files",
                    );
                  }
                }
              }
            }}
            placeholder="Ask anything, or type / for commands"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
            className="block max-h-40 min-h-7 w-full resize-none bg-transparent text-[15px] leading-7 text-[#23272c] placeholder:text-[#a3a9b1] focus:outline-none"
          />

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setOpenPersona(true);
                }}
                type="button"
                aria-label="Open LinkedIn persona settings"
                className="flex h-8 items-center gap-2 rounded-lg pl-1 pr-2 text-[14px] text-[#7d858f] transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <GenerateAvatar isCircle={true} seed={writingStyleOwner} />

                <span>
                  <span className="font-medium text-[#23272c]">
                    {writingStyleOwner}
                  </span>
                  &apos;s style
                </span>
              </button>
              <button
                type="button"
                aria-label="Attach media"
                title="Attach images, PDFs, documents, text, audio, or video (up to 5 files)"
                disabled={
                  agent.busy || !contextReady || files.queue.length >= 5
                }
                onClick={() => fileInput.current?.click()}
                className={ICON_BUTTON}
              >
                <Paperclip className="size-[18px] stroke-[1.6]" />
              </button>
            </div>

            {agent.busy ? (
              <button
                type="button"
                onClick={agent.stop}
                aria-label="Stop assistant"
                className="secondary-btn !size-9 !min-h-9 !justify-center !rounded-full !p-0"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : !input.trim() && !files.queue.length ? (
              <button
                type="button"
                aria-label="Voice dictation"
                title="Voice dictation"
                className="secondary-btn !size-9 !min-h-9 !justify-center !rounded-full !p-0"
              >
                <Mic className="size-4 stroke-[1.7]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  !contextReady ||
                  files.busy ||
                  files.queue.some((item) => item.stage === "failed") ||
                  (input.trim().length < 3 &&
                    !(files.assets.length && !input.trim()))
                }
                aria-label="Send to writing assistant"
                className="primary-btn !size-9 !min-h-9 !justify-center !rounded-full !p-0 disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowUp className="size-4 stroke-[2.6]" />
              </button>
            )}
          </div>
        </form>
      </div>

      <CommandDialog
        open={commandsOpen}
        setOpen={setCommandsOpen}
        command={editing}
      />
    </aside>
  );
}
