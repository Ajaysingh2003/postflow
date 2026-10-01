"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Cloud,
  ExternalLink,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDraftWorkspace } from "./editor/useDraftWorkspace";
import LinkedInEditor from "./editor/LinkedInEditor";
import PostActions from "./editor/PostActions";

const SORTS = {
  recent: "Recently updated",
  oldest: "Oldest first",
  title: "Title A–Z",
};
type Sort = keyof typeof SORTS;

function updatedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Saved draft"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
}

export function DraftDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const w = useDraftWorkspace();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [library, setLibrary] = useState(false);
  const [preview, setPreview] = useState(false);
  const locked = busy || actionBusy || w.uploadBusy || w.saving;
  const drafts = w.drafts.data ?? [];
  const needle = search.trim().toLocaleLowerCase();
  const filtered = drafts
    .filter((draft) =>
      `${draft.title} ${draft.content}`.toLocaleLowerCase().includes(needle),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "oldest"
          ? a.updated_at.localeCompare(b.updated_at)
          : b.updated_at.localeCompare(a.updated_at),
    );
  const active = drafts.find((draft) => draft.id === w.state.draftId);
  const hasContent = Boolean(
    w.state.content.trim() || w.state.composer.attachments.length,
  );
  const status = w.saving
    ? "Saving to workspace…"
    : w.dirty
      ? "Unsaved changes"
      : active
        ? "Saved to workspace"
        : "Start a new draft";

  function change(action: () => void) {
    if (locked || pending) return;
    if (w.dirty) setPending(() => action);
    else action();
  }
  function showEditor(action: () => void) {
    change(() => {
      action();
      setLibrary(false);
      setPreview(false);
    });
  }
  function recover() {
    try {
      const text =
        sessionStorage.getItem("outlify_active_draft_session") ||
        localStorage.getItem("outlify_active_draft_session");
      if (!text) {
        toast.info("No previous local draft was found");
        return;
      }
      const value = JSON.parse(text);
      if (typeof value.content !== "string") throw new Error();
      showEditor(() => {
        w.loadDraft({ draftId: null, content: value.content });
        toast.success(
          "Local draft recovered. Save it to this workspace when ready.",
        );
      });
    } catch {
      toast.error("Could not read the previous local draft");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!locked) {
          setOpen(next);
          if (!next) setPending(null);
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(860px,90dvh)] max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-[1120px]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60 text-foreground sm:flex">
                <FileText className="size-5" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-heading text-xl leading-tight sm:text-2xl">
                  Your LinkedIn drafts
                </DialogTitle>
                <DialogDescription className="mt-1.5 text-xs sm:text-sm">
                  A place for your next idea. Write, refine, and save it for
                  later.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={locked}
              aria-label="Close drafts"
              className="shrink-0 rounded-lg"
              onClick={() => {
                setOpen(false);
                setPending(null);
              }}
            >
              <X />
            </Button>
          </div>
        </DialogHeader>

        {!w.isHydrated ? (
          <div
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
            role={w.workspaceError ? "alert" : "status"}
          >
            {w.workspaceError ? (
              <>
                <TriangleAlert className="size-6 text-destructive" />
                <h2 className="font-subheading text-base">
                  Could not load your workspace
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Retry to open your drafts. If the problem continues, sign in
                  again.
                </p>
                <Button
                  className="secondary-btn rounded-lg"
                  onClick={w.retryWorkspace}
                >
                  <RotateCcw />
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading your workspace…
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2 md:hidden">
              <Button
                variant="ghost"
                className={`flex-1 rounded-lg ${library ? "bg-muted" : ""}`}
                aria-pressed={library}
                onClick={() => setLibrary(true)}
              >
                <FileText />
                Drafts
                {drafts.length > 0 && (
                  <Badge variant="secondary">{drafts.length}</Badge>
                )}
              </Button>
              <Button
                variant="ghost"
                className={`flex-1 rounded-lg ${!library ? "bg-muted" : ""}`}
                aria-pressed={!library}
                onClick={() => setLibrary(false)}
              >
                <PencilLine />
                Editor
              </Button>
            </div>
            <div className="flex min-h-0 flex-1">
              <aside
                aria-label="Draft library"
                className={`${library ? "flex" : "hidden"} min-h-0 w-full shrink-0 flex-col border-border bg-muted/25 md:flex md:w-[290px] md:border-r lg:w-[310px]`}
              >
                <div className="shrink-0 space-y-4 px-4 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-subheading text-sm font-medium">
                      Draft library
                    </h2>
                    <Badge variant="secondary" className="tabular-nums">
                      {drafts.length}
                    </Badge>
                  </div>
                  <Button
                    disabled={locked || !!pending}
                    onClick={() =>
                      showEditor(() =>
                        w.loadDraft({ draftId: null, content: "" }),
                      )
                    }
                    className="primary-btn w-full rounded-lg"
                  >
                    <Plus />
                    New draft
                  </Button>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search drafts"
                      placeholder="Search your drafts…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 rounded-lg border border-border bg-background pr-9 pl-9 focus-visible:ring-2 focus-visible:ring-sky-200"
                    />
                    {search && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Clear draft search"
                        onClick={() => setSearch("")}
                        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md"
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-full justify-start rounded-md px-0 text-xs text-muted-foreground"
                        />
                      }
                    >
                      <ArrowDownWideNarrow className="size-3.5" />
                      {SORTS[sort]}
                      <ChevronDown className="ml-auto size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      {(Object.entries(SORTS) as [Sort, string][]).map(
                        ([key, label]) => (
                          <DropdownMenuItem
                            key={key}
                            onClick={() => setSort(key)}
                            className="focus:bg-muted"
                          >
                            <span className="flex-1">{label}</span>
                            {sort === key && <Check className="size-4" />}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 pb-4">
                  {!w.state.draftId && (
                    <Button
                      variant="ghost"
                      disabled={locked || !!pending}
                      aria-pressed
                      onClick={() => setLibrary(false)}
                      className="h-auto w-full flex-col items-start gap-1.5 whitespace-normal rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-left dark:border-sky-900 dark:bg-sky-950/40"
                    >
                      <span className="flex w-full items-center gap-2 font-subheading text-sm text-foreground">
                        <PencilLine className="size-4 text-sky-600" />
                        Current draft
                        <Circle className="ml-auto size-2 fill-sky-500 text-sky-500" />
                      </span>
                      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {w.state.content.trim() ||
                          "Your next LinkedIn post starts here."}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {hasContent
                          ? "On this device · not saved yet"
                          : "New idea"}
                      </span>
                    </Button>
                  )}
                  {w.drafts.isPending ? (
                    <div
                      aria-label="Loading saved drafts"
                      role="status"
                      className="space-y-2"
                    >
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <>
                      {w.drafts.isError && (
                        <div
                          role="alert"
                          className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5"
                        >
                          <p className="text-xs leading-5 text-destructive">
                            Could not load your saved drafts. Your current draft
                            is still here.
                          </p>
                          <Button
                            disabled={w.drafts.isFetching}
                            size="sm"
                            className="secondary-btn rounded-lg"
                            onClick={() => void w.drafts.refetch()}
                          >
                            <RotateCcw
                              className={
                                w.drafts.isFetching ? "animate-spin" : ""
                              }
                            />
                            Retry
                          </Button>
                        </div>
                      )}
                      {!w.drafts.isError && filtered.length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <FileText className="mx-auto mb-3 size-7 text-muted-foreground/50" />
                          <p className="font-subheading text-sm">
                            {needle
                              ? "No matching drafts"
                              : "Room for your ideas"}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-muted-foreground">
                            {needle
                              ? "Try a different word or clear your search."
                              : "Save your first draft and find it here on any device."}
                          </p>
                          {needle && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 rounded-lg"
                              onClick={() => setSearch("")}
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      )}
                      {filtered.map((draft) => {
                        const selected = w.state.draftId === draft.id;
                        const media = draft.composer.attachments;
                        const date = new Date(draft.updated_at);
                        return (
                          <Button
                            key={draft.id}
                            variant="ghost"
                            disabled={locked || !!pending}
                            aria-pressed={selected}
                            onClick={() =>
                              selected
                                ? setLibrary(false)
                                : showEditor(() => w.select(draft))
                            }
                            className={`h-auto w-full flex-col items-start gap-2 whitespace-normal rounded-xl border p-3.5 text-left transition-colors ${selected ? "border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/40" : "border-transparent hover:border-border hover:bg-background"}`}
                          >
                            <span className="flex w-full items-start gap-2">
                              <span className="line-clamp-2 min-w-0 flex-1 break-words font-subheading text-sm font-medium leading-5">
                                {draft.title || "Untitled draft"}
                              </span>
                              {selected && (
                                <span className="mt-1 size-2 shrink-0 rounded-full bg-sky-500" />
                              )}
                            </span>
                            <span className="line-clamp-2 w-full break-words text-xs font-normal leading-5 text-muted-foreground">
                              {draft.content ||
                                "A post built around your media."}
                            </span>
                            <span className="flex w-full items-center gap-2 text-[11px] font-normal text-muted-foreground">
                              <time
                                dateTime={
                                  Number.isNaN(date.getTime())
                                    ? undefined
                                    : date.toISOString()
                                }
                              >
                                {updatedLabel(draft.updated_at)}
                              </time>
                              {media.length > 0 && (
                                <span className="ml-auto inline-flex items-center gap-1">
                                  {media[0].content_type ===
                                  "application/pdf" ? (
                                    <FileText className="size-3" />
                                  ) : (
                                    <ImageIcon className="size-3" />
                                  )}
                                  {media[0].content_type === "application/pdf"
                                    ? "Carousel"
                                    : `${media.length} image${media.length > 1 ? "s" : ""}`}
                                </span>
                              )}
                              {selected && w.dirty && (
                                <span className="ml-auto text-amber-700 dark:text-amber-400">
                                  Edited
                                </span>
                              )}
                            </span>
                          </Button>
                        );
                      })}
                    </>
                  )}
                </div>
                <div className="shrink-0 border-t border-border px-4 py-3">
                  <Button
                    variant="ghost"
                    disabled={locked || !!pending}
                    onClick={recover}
                    className="h-auto w-full justify-start gap-2 rounded-lg px-1 py-1.5 text-xs text-muted-foreground"
                  >
                    <History className="size-3.5" />
                    Recover a previous local draft
                  </Button>
                </div>
              </aside>

              <section
                aria-label="Draft editor"
                className={`${library ? "hidden" : "flex"} relative min-h-0 min-w-0 flex-1 flex-col md:flex`}
              >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                  <div className="min-w-0">
                    <h2 className="truncate font-subheading text-sm font-medium">
                      {active?.title || "Untitled draft"}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {preview
                        ? "See how your post will look on LinkedIn."
                        : "Turn a rough thought into your next post."}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 items-center rounded-lg border border-border bg-muted/40 p-1"
                    role="group"
                    aria-label="Editor view"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      aria-label="Write draft"
                      aria-pressed={!preview}
                      onClick={() => setPreview(false)}
                      className={`h-7 rounded-md px-2.5 text-xs ${!preview ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >
                      <PencilLine className="size-3.5" />
                      <span className="hidden sm:inline">Write</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={locked}
                      aria-label="Preview draft"
                      aria-pressed={preview}
                      onClick={() => setPreview(true)}
                      className={`h-7 rounded-md px-2.5 text-xs ${preview ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                    >
                      <Eye className="size-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </Button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/35 px-4 pt-6 pb-28 sm:px-7 sm:pt-8">
                  <LinkedInEditor
                    key={w.state.localId}
                    workspace={w}
                    preview={preview}
                    onBusy={setBusy}
                  />
                </div>
                <PostActions
                  key={w.state.localId}
                  workspace={w}
                  preview={preview}
                  onPreview={() => setPreview(!preview)}
                  disabled={locked || !!pending}
                  onBusy={setActionBusy}
                  onNew={() =>
                    showEditor(() =>
                      w.loadDraft({ draftId: null, content: "" }),
                    )
                  }
                />
              </section>
            </div>
          </>
        )}

        {pending && (
          <div
            role="alert"
            className="shrink-0 border-t border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900 dark:bg-amber-950/40"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-subheading text-sm text-foreground">
                  Keep your changes before switching?
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save this draft to your workspace, or discard these edits.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={locked}
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => setPending(null)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={locked}
                  className="secondary-btn rounded-lg"
                  onClick={() => {
                    pending();
                    setPending(null);
                  }}
                >
                  Discard changes
                </Button>
                <Button
                  disabled={locked}
                  className="primary-btn rounded-lg"
                  onClick={async () => {
                    if (await w.save()) {
                      pending();
                      setPending(null);
                    }
                  }}
                >
                  {w.saving ? <Loader2 className="animate-spin" /> : <Save />}
                  Save & continue
                </Button>
              </div>
            </div>
          </div>
        )}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border bg-background px-5 py-4 sm:px-7">
          <div
            role="status"
            aria-live="polite"
            className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
          >
            {w.saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : w.dirty ? (
              <Circle className="size-2 fill-amber-500 text-amber-500" />
            ) : active ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <Cloud className="size-4" />
            )}
            <span>
              {w.isHydrated
                ? status
                : w.workspaceError
                  ? "Workspace unavailable"
                  : "Loading workspace…"}
              <span className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
                {w.dirty
                  ? "Save to continue on any device."
                  : "Drafts are private to your workspace."}
              </span>
            </span>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              onClick={() => {
                setOpen(false);
                setPending(null);
                router.push("/dashboard/content/generator");
              }}
              disabled={locked || !!pending || !w.isHydrated}
              className="secondary-btn flex-1 rounded-lg sm:flex-none"
            >
              <ExternalLink />
              <span className="sm:hidden">Full editor</span>
              <span className="hidden sm:inline">Open full editor</span>
            </Button>
            <Button
              onClick={() => void w.save()}
              disabled={
                locked ||
                !!pending ||
                !w.isHydrated ||
                !hasContent ||
                w.state.content.length > 3000
              }
              className="primary-btn flex-1 rounded-lg sm:flex-none"
            >
              {w.saving ? <Loader2 className="animate-spin" /> : <Save />}Save
              draft
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
