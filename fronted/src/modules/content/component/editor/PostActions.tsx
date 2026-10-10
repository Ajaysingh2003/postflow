"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import {
  CalendarDays,
  Check,
  Copy,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Plus,
  Save,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PublishDialog, { type PublicationSnapshot } from "./PublishDialog";
import { accountName } from "./AccountAvatar";
import type { DraftWorkspace } from "./useDraftWorkspace";

export default function PostActions({
  workspace: w,
  preview,
  onPreview,
  disabled = false,
  onBusy,
  onDrafts,
  onNew,
}: {
  workspace: DraftWorkspace;
  preview: boolean;
  onPreview: () => void;
  disabled?: boolean;
  onBusy: (busy: boolean) => void;
  onDrafts?: () => void;
  onNew?: () => void;
}) {
  const trpc = useTRPC();
  const client = useQueryClient();
  const scope = useSuspenseQuery(trpc.workspace.current.queryOptions());
  const [snapshot, setSnapshot] = useState<PublicationSnapshot | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const schedule = useMutation({
    ...trpc.content.schedule.mutationOptions(),
    retry: false,
  });
  const scheduledDraft = useRef<string | null>(null);
  const flight = useRef(false);
  const working = publishing || scheduling;
  const locked = disabled || working || w.saving || w.uploadBusy;
  const hasPost = Boolean(
    w.state.content.trim() || w.state.composer.attachments.length,
  );
  const valid = hasPost && w.state.content.length <= 3000;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    onBusy(working);
    return () => onBusy(false);
  }, [working, onBusy]);

  function publish() {
    if (locked || !scope.data) return;
    setSnapshot({
      content: w.state.content,
      composer: structuredClone(w.state.composer),
      localId: w.state.localId,
      workspaceId: scope.data.id,
      storageKey: `draftva_publication:${scope.data.id}:${w.state.localId}`,
    });
    void w.accounts.refetch();
  }
  async function schedulePost() {
    if (locked || flight.current || scheduledDraft.current) return;
    const when = new Date(date);
    if (!date || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setScheduleError("Choose a valid date and time in the future.");
      return;
    }
    if (!w.account || w.account.status !== "connected") {
      setScheduleError("Connect a LinkedIn account before scheduling.");
      return;
    }
    flight.current = true;
    setScheduling(true);
    setScheduleError(null);
    try {
      const draft = await w.save();
      if (!draft) {
        setScheduleError(
          "Could not save your draft. Try saving again before scheduling.",
        );
        return;
      }
      const saved = await schedule.mutateAsync({
        post_id: draft.id,
        scheduled_for: when.toISOString(),
        timezone,
        media: draft.composer.attachments.map((asset) => ({
          asset_id: asset.asset_id,
        })),
      });
      scheduledDraft.current = saved.id;
      void client.invalidateQueries(trpc.content.schedules.queryFilter());
      setScheduleOpen(false);
      toast.success("Publishing reminder scheduled");
    } catch (error) {
      setScheduleError(
        error instanceof Error
          ? error.message
          : "Could not schedule. Your saved draft is still available.",
      );
    } finally {
      flight.current = false;
      setScheduling(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(w.state.content);
      toast.success("Post text copied");
    } catch {
      toast.error("Could not copy your post. Check clipboard permissions.");
    }
  }

  return (
    <>
      <nav
        aria-label="Post actions"
        className="absolute bottom-5 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/95 p-1.5 shadow-[0_3px_10px_-4px_rgba(0,0,0,0.15),0_12px_36px_-12px_rgba(0,0,0,0.2)] backdrop-blur-md sm:gap-2 sm:p-2"
      >
        <TooltipProvider delay={250}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Save draft"
                  disabled={locked || !valid}
                  onClick={() => void w.save()}
                  className="rounded-full sm:size-9"
                />
              }
            >
              {w.saving ? (
                <Loader2 className="animate-spin" />
              ) : !w.dirty && w.state.draftId ? (
                <Check />
              ) : (
                <Save />
              )}
            </TooltipTrigger>
            <TooltipContent>Save draft</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={preview ? "Edit post" : "Preview post"}
                  aria-pressed={preview}
                  disabled={locked}
                  onClick={onPreview}
                  className={`rounded-full sm:size-9 ${preview ? "bg-muted" : ""}`}
                />
              }
            >
              {preview ? <PencilLine /> : <Eye />}
            </TooltipTrigger>
            <TooltipContent>
              {preview ? "Edit post" : "Preview post"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Schedule post"
                  disabled={locked || !valid || !w.account}
                  onClick={() => {
                    setScheduleError(null);
                    scheduledDraft.current = null;
                    setScheduleOpen(true);
                  }}
                  className="rounded-full sm:size-9"
                />
              }
            >
              <CalendarDays />
            </TooltipTrigger>
            <TooltipContent>Schedule a publishing reminder</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={locked}
                aria-label="More post actions"
                className="rounded-full sm:size-9"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            side="top"
            sideOffset={12}
            className="w-52 rounded-xl"
          >
            <DropdownMenuItem
              disabled={!w.state.content.trim()}
              onClick={() => void copy()}
              className="focus:bg-muted"
            >
              <Copy />
              Copy post text
            </DropdownMenuItem>
            {onDrafts && (
              <DropdownMenuItem onClick={onDrafts} className="focus:bg-muted">
                <FileText />
                Your drafts
              </DropdownMenuItem>
            )}
            {onNew && (
              <DropdownMenuItem onClick={onNew} className="focus:bg-muted">
                <Plus />
                New draft
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden />
        <Button
          disabled={
            locked ||
            !w.state.content.trim() ||
            w.state.content.length > 3000 ||
            !scope.data
          }
          onClick={publish}
          className="primary-btn rounded-full !px-3 sm:!px-4"
        >
          <Send className="size-4" />
          <span>Publish</span>
        </Button>
      </nav>
      {snapshot && (
        <PublishDialog
          workspace={w}
          snapshot={snapshot}
          onClose={() => setSnapshot(null)}
          onBusy={setPublishing}
        />
      )}
      <Dialog
        open={scheduleOpen}
        onOpenChange={(open) =>
          !scheduling && !w.saving && setScheduleOpen(open)
        }
      >
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl p-6 sm:max-w-md"
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
                <CalendarDays className="size-5" />
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close scheduling dialog"
                disabled={scheduling || w.saving}
                onClick={() => setScheduleOpen(false)}
              >
                <X />
              </Button>
            </div>
            <DialogTitle className="mt-3 font-heading text-2xl">
              Schedule your post
            </DialogTitle>
            <DialogDescription>
              Choose when to publish as {accountName(w.account)}. We’ll remind
              you to review and publish through LinkedIn.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void schedulePost();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label
                htmlFor={`schedule-date-${w.state.localId}`}
                className="font-subheading"
              >
                Date and time
              </Label>
              <Input
                id={`schedule-date-${w.state.localId}`}
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                disabled={scheduling || w.saving}
                required
                className="h-11 rounded-lg border border-border bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Your timezone: {timezone}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
              This schedules a reminder. It does not automatically publish your
              post.
            </div>
            {scheduleError && (
              <p role="alert" className="text-sm leading-6 text-destructive">
                {scheduleError}
              </p>
            )}
            <Button
              type="submit"
              disabled={scheduling || w.saving || !date}
              className="primary-btn w-full rounded-lg"
            >
              {scheduling || w.saving ? (
                <Loader2 className="animate-spin" />
              ) : (
                <CalendarDays />
              )}
              {scheduling ? "Scheduling…" : "Save & schedule reminder"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
