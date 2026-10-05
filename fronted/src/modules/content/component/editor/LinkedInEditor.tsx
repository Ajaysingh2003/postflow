"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import {
  AtSign,
  Check,
  ChevronDown,
  FileText,
  Globe2,
  ImagePlus,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  Sparkles,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AccountAvatar, { accountName, type EditorAccount } from "./AccountAvatar";
import MediaPreview from "./MediaPreview";
import type { DraftWorkspace } from "./useDraftWorkspace";
import { fileType, uploadAsset, validateSource } from "../../assets";
import { attachmentSchema, type DraftAttachment } from "../../composerTypes";
import { MentionDropdown } from "./MentionDropdown";
import { getCaretCoordinates } from "./caretCoordinates";
import type { MentionSearchResult } from "../../server/procedures";
import LinkedInRefine from "./LinkedInRefine";

const POST_LIMIT = 3000;
const COMMENT_LIMIT = 1250;

const fb = (
  id: string,
  name: string,
  universal_name: string,
  domain: string,
  slug = universal_name,
): MentionSearchResult => ({
  id: `fb-${id}`,
  name,
  universal_name,
  profile_url: `https://www.linkedin.com/company/${slug}/`,
  avatar_url: `https://unavatar.io/domain/${domain}`,
  entity_type: "company",
});

const FALLBACK_COMPANIES: MentionSearchResult[] = [
  fb("revela", "Revela", "revela", "revela.co"),
  fb("sitekick", "Sitekick", "sitekick", "misshoneybird.com"),
  fb("sita", "SITA", "sita", "sita.aero"),
  fb("sela", "Sela | صلة", "selacompany", "sela.sa", "sela"),
  fb("sieve", "Sieve", "sieve-data", "sievedata.com"),
  fb("openai", "OpenAI", "openai", "openai.com"),
  fb("google", "Google", "google", "google.com"),
  fb("microsoft", "Microsoft", "microsoft", "microsoft.com"),
  fb("apple", "Apple", "apple", "apple.com"),
  fb("stripe", "Stripe", "stripe", "stripe.com"),
];

function getFallbackMatches(q: string): MentionSearchResult[] {
  const clean = q.toLowerCase().trim();
  if (!clean) return FALLBACK_COMPANIES.slice(0, 6);
  return FALLBACK_COMPANIES.filter(
    (c) =>
      c.name.toLowerCase().includes(clean) ||
      (c.universal_name && c.universal_name.toLowerCase().includes(clean)) ||
      (clean.length >= 3 &&
        (clean.includes(c.name.toLowerCase().slice(0, 3)) ||
          c.name.toLowerCase().includes(clean.slice(0, 3)))),
  ).slice(0, 6);
}

const VISIBILITY = [
  {
    value: "PUBLIC",
    label: "Anyone",
    hint: "Anyone on or off LinkedIn",
    Icon: Globe2,
  },
  {
    value: "CONNECTIONS",
    label: "Connections only",
    hint: "Only your 1st-degree connections",
    Icon: Users,
  },
] as const;

const PREVIEW_ACTIONS = [
  { Icon: ThumbsUp, label: "Like" },
  { Icon: MessageCircle, label: "Comment" },
  { Icon: Repeat2, label: "Repost" },
  { Icon: Send, label: "Send" },
];

const CARD =
  "rounded-2xl border-[0.5px] border-black/15 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)] dark:border-white/12 dark:bg-[#121214] dark:shadow-none";

const TOOL_BTN =
  "flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 disabled:pointer-events-none disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-white";

export type LinkedInEditorWorkspace = Pick<DraftWorkspace,
  "state" | "setContent" | "setSettings" | "uploadBusy" | "setUploadBusy" | "saving" | "replaceDraftIfCurrent"
> & { account?: EditorAccount | null };

export default function LinkedInEditor({
  workspace: w,
  preview,
  onBusy,
  onRefine,
  onMedia,
  media,
  extraTools,
  children,
  firstComment = true,
}: {
  workspace: LinkedInEditorWorkspace;
  preview: boolean;
  onBusy: (busy: boolean) => void;
  onRefine?: (text: string | undefined, start: number, end: number, anchor: HTMLElement) => void;
  onMedia?: () => void;
  media?: ReactNode;
  extraTools?: ReactNode;
  children?: ReactNode;
  firstComment?: boolean;
}) {
  const trpc = useTRPC();
  const input = useRef<HTMLInputElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const commentEditor = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [tool, setTool] = useState<"mention" | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [showComment, setShowComment] = useState(false);

  const uploadController = useRef<AbortController | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  useEffect(() => () => uploadController.current?.abort(), [w.state.localId]);
  const { state, setContent, setSettings } = w;

  // Mention typeahead state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAtPos, setMentionAtPos] = useState(0);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  const mentionsQuery = useQuery({
    ...trpc.content.searchMentions.queryOptions({
      query: mentionQuery,
      limit: 8,
    }),
    enabled: mentionActive,
  });

  const displayMentions =
    mentionsQuery.data && mentionsQuery.data.length > 0
      ? mentionsQuery.data
      : getFallbackMatches(mentionQuery);

  const charCount = state.content.length;
  const isOverLimit = charCount > POST_LIMIT;
  const isNearLimit = charCount > POST_LIMIT - 200;
  const progressRatio = Math.min(charCount / POST_LIMIT, 1);
  const visibility =
    VISIBILITY.find((v) => v.value === state.composer.visibility) ??
    VISIBILITY[0];

  useEffect(() => {
    if (editor.current) {
      editor.current.style.height = "auto";
      editor.current.style.height = `${Math.max(150, editor.current.scrollHeight)}px`;
    }
  }, [state.content]);

  useEffect(() => {
    if (commentEditor.current) {
      commentEditor.current.style.height = "auto";
      commentEditor.current.style.height = `${Math.max(64, commentEditor.current.scrollHeight)}px`;
    }
  }, [state.composer.comment]);

  async function upload(files: FileList | File[] | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const existing = state.composer.attachments;
    if (selected.length + existing.length > 9) {
      toast.error("Choose up to 9 images");
      return;
    }
    if (
      [
        ...selected.map(fileType),
        ...existing.map((a) => a.content_type),
      ].includes("application/pdf") &&
      selected.length + existing.length > 1
    ) {
      toast.error("Use one PDF carousel, or images—not both");
      return;
    }
    if (
      selected.some(
        (f) =>
          !attachmentSchema.shape.content_type.safeParse(fileType(f)).success ||
          f.size === 0,
      )
    ) {
      toast.error("Choose a JPEG, PNG, WebP, GIF, or PDF file");
      return;
    }
    try {
      selected.forEach(validateSource);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid file");
      if (input.current) input.current.value = "";
      return;
    }
    if (w.uploadBusy || uploadController.current) return;
    const controller = new AbortController();
    uploadController.current = controller;
    setFailedFiles([]);
    setUploading(true);
    w.setUploadBusy(true);
    onBusy(true);
    const uploaded: DraftAttachment[] = [];
    try {
      for (const file of selected) {
        const asset = await uploadAsset(
          file,
          "post",
          (stage) =>
            setUploadLabel(
              `${stage === "uploading" ? "Uploading" : "Checking"} ${file.name}…`,
            ),
          controller.signal,
        );
        uploaded.push({
          asset_id: asset.asset_id,
          name: asset.name,
          content_type: attachmentSchema.shape.content_type.parse(
            asset.content_type,
          ),
        });
      }
      toast.success("Media added to draft");
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailedFiles(selected.slice(uploaded.length));
        toast.error(
          error instanceof Error ? error.message : "Upload failed. Retry.",
        );
      }
    } finally {
      if (uploaded.length && !controller.signal.aborted)
        setSettings({ attachments: [...existing, ...uploaded] });
      uploadController.current = null;
      setUploadLabel("");
      setUploading(false);
      w.setUploadBusy(false);
      onBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function pick(pdf: boolean) {
    if (input.current) {
      input.current.value = "";
      input.current.accept = pdf
        ? "application/pdf"
        : "image/jpeg,image/png,image/webp,image/gif";
      input.current.multiple = !pdf;
      input.current.click();
    }
  }

  function mention() {
    if (
      !name.trim() ||
      !/^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[^\s]+$/.test(url)
    ) {
      toast.error("Enter a name and a valid LinkedIn profile or company URL");
      return;
    }
    const at = editor.current?.selectionStart ?? state.content.length;
    const text = `${at > 0 && !/\s/.test(state.content[at - 1]) ? " " : ""}@${name.trim()}`;
    if (state.content.length + text.length + 1 > POST_LIMIT) {
      toast.error("This mention would exceed the post limit");
      return;
    }
    setContent(
      state.content.slice(0, at) + text + " " + state.content.slice(at),
    );
    setSettings({
      mentions: [
        ...state.composer.mentions,
        { name: name.trim(), profile_url: url },
      ],
    });
    setTool(null);
    setName("");
    setUrl("");
    requestAnimationFrame(() => {
      editor.current?.focus();
      editor.current?.setSelectionRange(
        at + text.length + 1,
        at + text.length + 1,
      );
    });
  }

  const checkMentionTrigger = useCallback((text: string, cursorPos: number) => {
    if (cursorPos < 0) {
      setMentionActive(false);
      return;
    }
    const textBefore = text.slice(0, cursorPos);
    const match = textBefore.match(/(?:^|\s)@([^\s@]{0,35})$/);
    if (match && editor.current) {
      const query = match[1];
      const atIndex = cursorPos - query.length - 1;
      const coords = getCaretCoordinates(editor.current, atIndex);
      const top =
        (editor.current.offsetTop ?? 0) + coords.top + coords.height + 6;
      const left = (editor.current.offsetLeft ?? 0) + coords.left;

      setMentionAtPos(atIndex);
      setMentionQuery(query);
      setMentionPosition({ top, left });
      setMentionSelectedIndex(0);
      setMentionActive(true);
    } else {
      setMentionActive(false);
    }
  }, []);

  const handleCursorActivity = useCallback(() => {
    if (!editor.current) return;
    checkMentionTrigger(editor.current.value, editor.current.selectionStart);
  }, [checkMentionTrigger]);

  function handleSelectMention(item: MentionSearchResult) {
    if (!editor.current) return;
    const atPos = mentionAtPos;
    const cursor = editor.current.selectionStart;
    const mentionText = `@${item.name} `;
    const newContent =
      state.content.slice(0, atPos) + mentionText + state.content.slice(cursor);

    if (newContent.length > POST_LIMIT) {
      toast.error("This mention would exceed the post limit");
      return;
    }

    setContent(newContent);

    const exists = state.composer.mentions.some(
      (m) => m.profile_url.toLowerCase() === item.profile_url.toLowerCase(),
    );
    if (!exists) {
      setSettings({
        mentions: [
          ...state.composer.mentions,
          {
            name: item.name,
            profile_url: item.profile_url,
            avatar_url: item.avatar_url || undefined,
            entity_type: item.entity_type,
          },
        ],
      });
    }

    setMentionActive(false);

    requestAnimationFrame(() => {
      if (editor.current) {
        editor.current.focus();
        const newCursor = atPos + mentionText.length;
        editor.current.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  function handleFindOnLinkedIn(q: string) {
    const clean = q.trim().replace(/^@/, "");
    window.open(
      `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(clean)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setMentionActive(false);
    setName(clean);
    setUrl(`https://www.linkedin.com/company/${clean.toLowerCase()}`);
    setTool("mention");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (onRefine && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
      e.preventDefault();
      const { selectionStart: start, selectionEnd: end } = e.currentTarget;
      onRefine(start < end ? state.content.slice(start, end) : undefined, start, end, e.currentTarget);
      setMentionActive(false);
      return;
    }
    if (!mentionActive) return;

    const currentItems = displayMentions;
    const totalOptions = currentItems.length + (mentionQuery.trim() ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionSelectedIndex((prev) => (prev + 1) % Math.max(1, totalOptions));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionSelectedIndex(
        (prev) => (prev - 1 + totalOptions) % Math.max(1, totalOptions),
      );
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (mentionSelectedIndex === currentItems.length && mentionQuery.trim()) {
        handleFindOnLinkedIn(mentionQuery);
      } else if (currentItems[mentionSelectedIndex]) {
        handleSelectMention(currentItems[mentionSelectedIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionActive(false);
    }
  }

  function triggerMentionFromToolbar() {
    if (!editor.current) return;
    editor.current.focus();
    const pos = editor.current.selectionStart;
    const content = state.content;
    const needsSpace = pos > 0 && !/\s/.test(content[pos - 1]);
    const insertText = (needsSpace ? " " : "") + "@";
    const newContent = content.slice(0, pos) + insertText + content.slice(pos);

    setContent(newContent);
    requestAnimationFrame(() => {
      if (editor.current) {
        const newPos = pos + insertText.length;
        editor.current.setSelectionRange(newPos, newPos);
        checkMentionTrigger(newContent, newPos);
      }
    });
  }

  const counterTone = isOverLimit
    ? "text-rose-500"
    : isNearLimit
      ? "text-amber-500"
      : "text-neutral-500 dark:text-neutral-400";
  const ringTone = isOverLimit
    ? "stroke-rose-500"
    : isNearLimit
      ? "stroke-amber-500"
      : "stroke-neutral-900 dark:stroke-white";

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-4 pb-10">
      {/* Post card */}
      <div className={`relative flex flex-col ${CARD}`}>
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="shrink-0">
              <AccountAvatar account={w.account} large />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 leading-tight">
                <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-neutral-900 dark:text-neutral-50">
                  {accountName(w.account)}
                </p>
                <span className="shrink-0 text-[13px] text-neutral-400">
                  · You
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-neutral-500 dark:text-neutral-400">
                {w.account?.headline || "LinkedIn creator"}
              </p>

              <div className="mt-1.5 flex items-center gap-1 text-[12px] text-neutral-400">
                <span>{preview ? "Just now" : "Draft"}</span>
                <span aria-hidden>·</span>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={preview}
                    aria-label="Change post visibility"
                    className="group -ml-0.5 inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[12px] font-medium text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-400/50 disabled:pointer-events-none data-open:bg-neutral-100 data-open:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100 dark:data-open:bg-white/8"
                  >
                      <visibility.Icon className="size-3.5" strokeWidth={1.8} />
                      <span>{visibility.label}</span>
                      {!preview && (
                        <ChevronDown
                          className="size-3 text-neutral-400 transition-transform duration-150 group-data-open:rotate-180"
                          strokeWidth={2}
                        />
                      )}
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="start"
                    sideOffset={6}
                    className="w-[260px] rounded-xl border-[0.5px] border-black/15 bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.16)] dark:border-white/12 dark:bg-[#18181b]"
                  >
                    {VISIBILITY.map(({ value, label, hint, Icon }) => {
                      const active = state.composer.visibility === value;
                      return (
                        <DropdownMenuItem
                          key={value}
                          onClick={() => setSettings({ visibility: value })}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 text-neutral-800 outline-none data-[highlighted]:bg-neutral-100 dark:text-neutral-100 dark:data-[highlighted]:bg-white/8"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-white/8 dark:text-neutral-300">
                            <Icon className="size-4" strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-medium leading-5">
                              {label}
                            </span>
                            <span className="block text-[12px] leading-4 text-neutral-500 dark:text-neutral-400">
                              {hint}
                            </span>
                          </span>
                          {active && (
                            <Check
                              className="size-4 shrink-0 text-neutral-900 dark:text-white"
                              strokeWidth={2}
                            />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="More post options"
            className="-mr-1.5 rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-white/8 dark:hover:text-neutral-200"
          >
            <MoreHorizontal size={20} />
          </button>
        </header>

        {/* Content */}
        <div className="relative px-5 pt-1 pb-4">
          {preview ? (
            <div className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.6] text-neutral-900 dark:text-neutral-100">
              {state.content || (
                <span className="text-neutral-400">
                  Your post preview will appear here.
                </span>
              )}
            </div>
          ) : (
            <>
              <textarea
                ref={editor}
                aria-label="LinkedIn post content"
                value={state.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setContent(val);
                  checkMentionTrigger(val, e.target.selectionStart);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleCursorActivity}
                onClick={handleCursorActivity}
                placeholder="What do you want to talk about?"
                rows={5}
                className="block h-auto min-h-[150px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[15.5px] leading-[1.6] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-600"
              />

              {mentionActive && (
                <MentionDropdown
                  query={mentionQuery}
                  items={displayMentions}
                  isLoading={mentionsQuery.isLoading}
                  selectedIndex={mentionSelectedIndex}
                  onSelect={handleSelectMention}
                  onFindOnLinkedIn={handleFindOnLinkedIn}
                  onClose={() => setMentionActive(false)}
                  position={mentionPosition}
                />
              )}
            </>
          )}
        </div>

        {/* Media */}
        {media}
        {children}
        {media === undefined && !!state.composer.attachments.length && (
          <div
            className={`grid gap-2 border-t-[0.5px] border-black/10 p-3 dark:border-white/10 ${
              state.composer.attachments.length > 1
                ? "grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {state.composer.attachments.map((asset) => (
              <div
                key={asset.asset_id}
                className="overflow-hidden rounded-xl border-[0.5px] border-black/10 dark:border-white/10"
              >
                <MediaPreview
                  asset={asset}
                  onRemove={
                    preview || uploading
                      ? undefined
                      : () =>
                          setSettings({
                            attachments: state.composer.attachments.filter(
                              (a) => a.asset_id !== asset.asset_id,
                            ),
                          })
                  }
                />
              </div>
            ))}
          </div>
        )}

        {uploading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 border-t p-3 text-sm text-neutral-500"
          >
            <Loader2 size={16} className="animate-spin" />
            <span className="truncate">
              {uploadLabel || "Preparing upload…"}
            </span>
          </div>
        )}
        {!uploading && failedFiles.length > 0 && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 border-t bg-red-50 p-3 text-xs text-red-700"
          >
            <span>{failedFiles.length} file(s) couldn’t be added.</span>
            <Button
              type="button"
              variant="outline"
              className="secondary-btn"
              onClick={() => void upload(failedFiles)}
            >
              Retry upload
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Dismiss failed uploads"
              onClick={() => setFailedFiles([])}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        {/* Toolbar */}
        {!preview && (
          <div className="flex items-center justify-between rounded-b-2xl border-t-[0.5px] border-black/10 bg-neutral-50/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={uploading}
                title="Add photos"
                aria-label="Add photos"
                onClick={() => onMedia ? onMedia() : pick(false)}
                className={TOOL_BTN}
              >
                {uploading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <ImagePlus size={18} strokeWidth={1.8} />
                )}
              </button>
              <button
                type="button"
                title="Add PDF carousel"
                aria-label="Add PDF carousel"
                disabled={uploading}
                onClick={() => onMedia ? onMedia() : pick(true)}
                className={TOOL_BTN}
              >
                <FileText size={18} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                title="Mention a person or company"
                aria-label="Mention a person or company"
                disabled={state.composer.mentions.length >= 20}
                onClick={triggerMentionFromToolbar}
                className={TOOL_BTN}
              >
                <AtSign size={18} strokeWidth={1.8} />
              </button>
              {extraTools}
              {onRefine ? (
                <button
                  type="button"
                  aria-label="Refine post"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    const start = editor.current?.selectionStart ?? 0;
                    const end = editor.current?.selectionEnd ?? 0;
                    onRefine(end > start ? state.content.slice(start, end) : undefined, start, end, event.currentTarget);
                    setMentionActive(false);
                  }}
                  className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-white"
                >
                  <Sparkles size={17} strokeWidth={1.8} />
                  Refine
                  <ChevronDown size={13} />
                </button>
              ) : (
                <LinkedInRefine workspace={w} editor={editor} onOpen={() => setMentionActive(false)} />
              )}
            </div>

            <div
              className="flex items-center gap-2.5 pr-1.5"
              aria-live="polite"
            >
              <span
                className={`text-[12.5px] font-medium tabular-nums ${counterTone}`}
              >
                {charCount.toLocaleString()}
                <span className="text-neutral-400 dark:text-neutral-500">
                  {" "}
                  / {POST_LIMIT.toLocaleString()}
                </span>
              </span>
              <svg
                className="size-[18px] -rotate-90"
                viewBox="0 0 20 20"
                aria-hidden
              >
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  className="stroke-neutral-200 dark:stroke-white/12"
                  strokeWidth="2.5"
                  fill="none"
                />
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  className={`transition-[stroke-dashoffset] duration-200 ${ringTone}`}
                  strokeWidth="2.5"
                  strokeDasharray={44}
                  strokeDashoffset={44 * (1 - progressRatio)}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Preview engagement bar */}
        {preview && (
          <div
            aria-hidden="true"
            className="flex items-center justify-between border-t-[0.5px] border-black/10 px-4 py-1.5 dark:border-white/10"
          >
            {PREVIEW_ACTIONS.map(({ Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13.5px] font-medium text-neutral-500 dark:text-neutral-400"
              >
                <Icon size={18} strokeWidth={1.7} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <input
        ref={input}
        type="file"
        className="hidden"
        aria-label="Upload post media"
        onChange={(e) => void upload(e.target.files)}
      />

      {/* First comment */}
      {firstComment && (showComment || state.composer.comment ? (
        <div className={`overflow-hidden ${CARD}`}>
          <div className="flex items-center justify-between border-b-[0.5px] border-black/10 bg-[#f5f5f5] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-[13.5px] font-medium text-neutral-800 dark:text-neutral-200">
              <MessageCircle size={16} strokeWidth={1.8} />
              <span>First comment</span>
            </div>
            {!preview && (
              <button
                type="button"
                aria-label="Remove first comment"
                onClick={() => {
                  setSettings({ comment: "" });
                  setShowComment(false);
                }}
                className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 dark:hover:bg-white/8 dark:hover:text-neutral-200"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="p-4">
            <textarea
              ref={commentEditor}
              disabled={preview}
              value={state.composer.comment}
              maxLength={COMMENT_LIMIT}
              onChange={(e) => setSettings({ comment: e.target.value })}
              placeholder="Add a link, resource, or follow-up as the first reply"
              rows={2}
              className="block h-auto min-h-[64px] w-full resize-none overflow-hidden rounded-xl border-[0.5px] border-black/15 bg-white p-3 text-[14px] leading-relaxed text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none disabled:opacity-70 dark:border-white/12 dark:bg-white/[0.03] dark:text-neutral-100 dark:focus:border-white/30"
            />
            <div className="mt-2 flex items-center justify-between text-[12px] text-neutral-500 dark:text-neutral-400">
              <span>Posts right after your post goes live</span>
              <span className="tabular-nums">
                {(state.composer.comment?.length || 0).toLocaleString()} /{" "}
                {COMMENT_LIMIT.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        !preview && (
          <button
            type="button"
            onClick={() => setShowComment(true)}
            className="mx-auto flex items-center gap-2 rounded-full border-[0.5px] border-black/20 bg-white px-4 py-2 text-[13.5px] font-medium text-neutral-600 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-neutral-50 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:border-white/15 dark:bg-transparent dark:text-neutral-300 dark:shadow-none dark:hover:bg-white/5"
          >
            <MessageCircle size={16} strokeWidth={1.8} />
            Add first comment
          </button>
        )
      ))}

      {/* Mention dialog */}
      <Dialog
        open={tool === "mention"}
        onOpenChange={(open) => !open && setTool(null)}
      >
        <DialogContent className="max-w-md rounded-2xl border-[0.5px] p-6">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-semibold tracking-[-0.01em]">
              Mention a person or company
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed">
              Adds a LinkedIn mention to your post so they get notified.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mention();
            }}
            className="mt-3 space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="mention-name"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                Display name
              </label>
              <Input
                id="mention-name"
                required
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Satya Nadella"
                className="h-10 text-[14px]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="mention-url"
                className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300"
              >
                LinkedIn profile or page URL
              </label>
              <Input
                id="mention-url"
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/username"
                className="h-10 text-[14px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                className="secondary-btn rounded-lg"
                type="button"
                variant="ghost"
                onClick={() => setTool(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="primary-btn rounded-lg">
                Insert mention
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
