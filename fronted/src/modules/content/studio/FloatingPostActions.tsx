"use client";
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
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

type Props = {
  busy: boolean;
  saving: boolean;
  saved: boolean;
  editable: boolean;
  preview: boolean;
  hasPost: boolean;
  canPublish: boolean;
  status?: string;
  externalUrl?: string | null;
  onSave: () => void;
  onPreview: () => void;
  onSchedule: () => void;
  onPublish: () => void;
  onCopy: () => void;
  onDrafts: () => void;
  onNew: () => void;
  onDuplicate: () => void;
};

export default function FloatingPostActions({
  busy,
  saving,
  saved,
  editable,
  preview,
  hasPost,
  canPublish,
  status,
  externalUrl,
  onSave,
  onPreview,
  onSchedule,
  onPublish,
  onCopy,
  onDrafts,
  onNew,
  onDuplicate,
}: Props) {
  if (!editable)
    return (
      <nav
        aria-label="Post actions"
        data-studio-floating="true"
        className="absolute bottom-5 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-background/95 p-2 shadow-[0_3px_10px_-4px_rgba(0,0,0,0.15),0_12px_36px_-12px_rgba(0,0,0,0.2)] backdrop-blur-md"
      >
        <span className="px-2 text-xs capitalize text-muted-foreground">
          {status}
        </span>
        {externalUrl && (
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
          >
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View original post"
              title="View original post"
            >
              <ExternalLink />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Copy post text"
          title="Copy post text"
          onClick={onCopy}
          className="rounded-full"
        >
          <Copy />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Your drafts"
          title="Your drafts"
          onClick={onDrafts}
          className="rounded-full"
        >
          <FileText />
        </Button>
        <Button
          onClick={onDuplicate}
          disabled={busy}
          className="primary-btn rounded-full !px-3"
        >
          <Copy />
          Copy to draft
        </Button>
      </nav>
    );
  return (
    <nav
      aria-label="Post actions"
      data-studio-floating="true"
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
                disabled={busy || !hasPost}
                onClick={onSave}
                className="rounded-full sm:size-9"
              />
            }
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : saved ? (
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
                disabled={busy}
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
                disabled={busy || !hasPost || !canPublish}
                onClick={onSchedule}
                className="rounded-full sm:size-9"
              />
            }
          >
            <CalendarDays />
          </TooltipTrigger>
          <TooltipContent>Schedule post</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
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
            disabled={!hasPost}
            onClick={onCopy}
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
        disabled={busy || !hasPost || !canPublish}
        onClick={onPublish}
        className="primary-btn rounded-full !px-3 sm:!px-4"
      >
        <Send className="size-4" />
        <span>Publish</span>
      </Button>
    </nav>
  );
}
