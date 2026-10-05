"use client";

import type { ReactNode } from "react";
import { ChevronDown, ImagePlus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getAccountAvatarUrl } from "@/modules/channels/component/AccountAvatar";
import { Counter, GrowingText, refineCurrentPost } from "../../studio/editors/shared";
import type { EditorProps } from "../../studio/editors/types";
import { cn } from "@/lib/utils";

export const EDITOR_TEXT = "text-[15.5px] md:text-[15.5px] leading-[1.6] tracking-[-0.01em] text-foreground";
export const EDITOR_TOOL = "h-9 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground";

export function SocialPostCard({ account, subtitle, headerAction, children, className }: Pick<EditorProps, "account"> & {
  subtitle: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const avatar = getAccountAvatarUrl(account);
  return (
    <article className={cn("overflow-hidden rounded-2xl border-[0.5px] border-black/15 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10)] dark:border-white/12 dark:shadow-none", className)}>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar key={account.id} className="size-11 shrink-0">
            {avatar && <AvatarImage src={avatar} alt={account.display_name} referrerPolicy="no-referrer" />}
            <AvatarFallback className="text-sm font-semibold">{account.display_name.replace(/^@/, "").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{account.display_name.replace(/\s*\(@[^)]+\)$/, "")}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {headerAction}
      </header>
      {children}
    </article>
  );
}

export function SocialPostText({ text, label, placeholder, locked, onChange, onRefine, index = 0, className }: {
  text: string;
  label: string;
  placeholder: string;
  locked: boolean;
  onChange: (text: string) => void;
  onRefine: EditorProps["onRefine"];
  index?: number;
  className?: string;
}) {
  return locked ? (
    <div className={cn("min-h-[140px] whitespace-pre-wrap break-words px-5 pb-5 pt-1", EDITOR_TEXT, className)}>
      {text || <span className="text-muted-foreground/60">{placeholder}</span>}
    </div>
  ) : (
    <div className="px-5 pb-5 pt-1">
      <GrowingText
        aria-label={label}
        placeholder={placeholder}
        value={text}
        className={cn("min-h-[150px] w-full resize-none overflow-hidden bg-transparent p-0 placeholder:text-muted-foreground/60 dark:bg-transparent", EDITOR_TEXT, className)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
            event.preventDefault();
            const { selectionStart: start, selectionEnd: end, value } = event.currentTarget;
            onRefine(end > start ? value.slice(start, end) : undefined, index, start, end, event.currentTarget);
          }
        }}
      />
    </div>
  );
}

export function SocialEditorToolbar({ text, platform, limit, capabilities, onRefine, onMedia, tools, index = 0 }: {
  text: string;
  platform: string;
  limit: number;
  capabilities: EditorProps["capabilities"];
  onRefine: EditorProps["onRefine"];
  onMedia: () => void;
  tools?: ReactNode;
  index?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/25 px-3 py-2 [&>span]:text-xs">
      <div className="flex flex-wrap items-center gap-0.5">
        {capabilities.supports_media === true && (
          <Button type="button" variant="ghost" size="icon" className="rounded-lg text-muted-foreground" aria-label="Attach media" title="Add photos or video" onClick={onMedia}><ImagePlus size={18} /></Button>
        )}
        {tools}
        <Button type="button" variant="ghost" className={EDITOR_TOOL} aria-label={index ? `Refine post ${index + 1}` : "Refine post"} onMouseDown={(event) => event.preventDefault()} onClick={(event) => refineCurrentPost(event.currentTarget, onRefine, index)}>
          <Sparkles size={17} />Refine<ChevronDown size={13} />
        </Button>
      </div>
      <Counter text={text} platform={platform} limit={limit} counting={capabilities.text_length_type} />
    </div>
  );
}

export function EditorNotice({ children }: { children: ReactNode }) {
  return <p role="status" className="px-5 pb-4 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}
