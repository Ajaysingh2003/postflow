"use client";

import { useState } from "react";
import { Globe2, Link2, MessageCircle, Share2, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EditorProps } from "../../studio/editors/types";
import { EDITOR_TOOL, EditorNotice, SocialEditorToolbar, SocialPostCard, SocialPostText } from "./SocialEditor";
import { editorMedia, safePostLink, socialEditorIssues } from "./socialEditorModel";

export default function FacebookEditor({ account, payload, onChange, capabilities, preview, readOnly, onRefine, onMedia, media, mediaIds, mediaAssets }: EditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const locked = preview || readOnly;
  const text = String(payload.text ?? "");
  const link = String(payload.link ?? "");
  const url = safePostLink(link);
  const attachments = editorMedia(payload, mediaIds, mediaAssets);
  const issues = socialEditorIssues("facebook", payload, attachments, capabilities);

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-3">
      <SocialPostCard account={account} subtitle={<><span>{locked ? "Page post" : "Draft"}</span><span aria-hidden>·</span><Globe2 className="size-3" /><span>Public</span></>}>
        <SocialPostText text={text} label="Facebook post" placeholder="Share an update with your Page…" locked={locked} onChange={(value) => onChange({ ...payload, text: value })} onRefine={onRefine} />

        {!locked && (linkOpen || link) && (
          <div className="mx-5 mb-4 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor={`facebook-link-${account.id}`} className="text-xs">Post link</Label>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove post link" onClick={() => {
                const next = { ...payload };
                delete next.link;
                onChange(next);
                setLinkOpen(false);
              }}><X size={14} /></Button>
            </div>
            <Input id={`facebook-link-${account.id}`} aria-label="Facebook post link" type="url" placeholder="https://example.com/article" value={link} onChange={(event) => onChange({ ...payload, link: event.target.value })} className="h-9 bg-background text-sm" aria-invalid={!!link && !url} />
            <p className="text-[11px] leading-relaxed text-muted-foreground">Share an article, product, or resource with your Page.</p>
          </div>
        )}
        {url && attachments.count === 0 && (
          <a href={url.href} target="_blank" rel="noopener noreferrer" className="mx-5 mb-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground"><Link2 size={18} /></span>
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{url.hostname.replace(/^www\./, "")}</span><span className="block truncate text-xs text-muted-foreground">{url.href}</span></span>
          </a>
        )}
        {attachments.count > 0 && <div className="px-5">{media}</div>}
        {issues.map((issue) => <EditorNotice key={issue}>{issue}</EditorNotice>)}
        {!locked && (
          <SocialEditorToolbar text={text} platform="facebook" limit={Number(capabilities.max_text_length ?? 63206)} capabilities={capabilities} onRefine={onRefine} onMedia={onMedia} tools={
            capabilities.supports_links !== false ? <Button type="button" variant="ghost" className={EDITOR_TOOL} aria-label="Add a post link" aria-expanded={!!(linkOpen || link)} onClick={() => setLinkOpen(true)}><Link2 size={17} />Link</Button> : null
          } />
        )}
        {locked && (
          <div aria-hidden className="flex items-center justify-around border-t border-border px-4 py-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-2"><ThumbsUp size={17} />Like</span>
            <span className="flex items-center gap-2"><MessageCircle size={17} />Comment</span>
            <span className="flex items-center gap-2"><Share2 size={17} />Share</span>
          </div>
        )}
      </SocialPostCard>
      {!locked && <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">Publishing to a Page · Choose the Page above before scheduling.</p>}
    </div>
  );
}
