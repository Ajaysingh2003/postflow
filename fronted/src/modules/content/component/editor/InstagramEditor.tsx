"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, Film, Hash, Heart, ImagePlus, Images, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EditorProps } from "../../studio/editors/types";
import { EDITOR_TOOL, EditorNotice, SocialEditorToolbar, SocialPostCard, SocialPostText } from "./SocialEditor";
import { captionHashtags, editorMedia, instagramFormat, reorderEditorMedia, replaceCaptionHashtags, socialEditorIssues } from "./socialEditorModel";

const formats = [
  { value: "IMAGE", label: "Photo", Icon: ImagePlus },
  { value: "CAROUSEL", label: "Carousel", Icon: Images },
  { value: "REELS", label: "Reel", Icon: Film },
];

function HashtagEditor({ caption, limit, onChange }: { caption: string; limit: number; onChange: (text: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState("");
  const next = replaceCaptionHashtags(caption, tags);
  const tooLong = next !== null && [...next].length > limit;
  return (
    <Popover open={open} onOpenChange={(value) => {
      if (value) setTags(captionHashtags(caption).join(" "));
      setOpen(value);
    }}>
      <PopoverTrigger render={<Button type="button" variant="ghost" className={EDITOR_TOOL} aria-label="Edit caption hashtags"><Hash size={17} />Hashtags</Button>} />
      <PopoverContent align="start" className="w-80 space-y-3 p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-medium">Caption hashtags</p><Button variant="ghost" size="icon-xs" aria-label="Close hashtag editor" onClick={() => setOpen(false)}><X size={14} /></Button></div>
        <Label htmlFor={id} className="text-xs">Separate tags with spaces</Label>
        <Input id={id} value={tags} maxLength={limit} placeholder="#design #behindthescenes" onChange={(event) => setTags(event.target.value)} aria-invalid={next === null || tooLong} className="rounded-lg" />
        <p className="text-xs leading-relaxed text-muted-foreground">Tags are added to the end of your caption. Duplicates are removed.</p>
        {(next === null || tooLong) && <p role="alert" className="text-xs text-destructive">{tooLong ? "These tags would exceed the caption limit." : "Use letters, numbers, and underscores in hashtags."}</p>}
        <Button size="sm" className="w-full rounded-lg" disabled={next === null || tooLong} onClick={() => { if (next !== null) { onChange(next); setOpen(false); } }}>Apply hashtags</Button>
      </PopoverContent>
    </Popover>
  );
}

export default function InstagramEditor({ account, payload, onChange, capabilities, preview, readOnly, onRefine, onMedia, media, mediaIds, mediaAssets, onMediaOrderChange }: EditorProps) {
  const locked = preview || readOnly;
  const caption = String(payload.caption ?? "");
  const attachments = editorMedia(payload, mediaIds, mediaAssets);
  const format = instagramFormat(payload, attachments);
  const selected = formats.find((item) => item.value === format)!;
  const issues = socialEditorIssues("instagram", payload, attachments, capabilities);
  const hashtags = captionHashtags(caption);
  const limit = Number(capabilities.max_text_length ?? 2200);

  return (
    <div className="mx-auto w-full max-w-[600px] space-y-3">
      {!locked && (
        <Tabs value={format} onValueChange={(value) => onChange({ ...payload, media_type: value })}>
          <TabsList aria-label="Instagram post format" className="h-10 w-full rounded-xl border border-border bg-muted/35 p-1">
            {formats.filter((item) => item.value !== "REELS" || capabilities.supports_video !== false).map(({ value, label, Icon }) => <TabsTrigger key={value} value={value} className="rounded-lg text-xs"><Icon size={15} />{label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}
      <SocialPostCard account={account} subtitle={<><span>{locked ? selected.label : "Draft"}</span><span aria-hidden>·</span><span>Instagram</span></>} headerAction={
        !locked && attachments.count > 0 ? <Button variant="ghost" size="sm" className="rounded-lg text-xs text-muted-foreground" aria-label="Edit Instagram attachments" onClick={() => onMedia()}>{attachments.count} {attachments.count === 1 ? "attachment" : "attachments"}<ChevronDown size={13} /></Button> : undefined
      }>
        {attachments.count > 0 ? (
          <div className="border-y border-border/60 px-4 pt-1" aria-label="Instagram media">{media}</div>
        ) : (
          <div className="mx-5 mb-4 flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-5 text-center">
            <selected.Icon className="size-7 text-muted-foreground/60" strokeWidth={1.4} />
            <p className="text-sm font-medium">{format === "REELS" ? "Add your video" : format === "CAROUSEL" ? "Add your carousel" : "Add your photo"}</p>
            <p className="max-w-[250px] text-xs leading-relaxed text-muted-foreground">{format === "REELS" ? "One video with a caption." : format === "CAROUSEL" ? `Choose 2–${Number(capabilities.max_media_count ?? 10)} photos or videos. Attachment order is slide order.` : "Your image will appear here."}</p>
            {!locked && capabilities.supports_media === true && <Button variant="outline" size="sm" className="mt-1 rounded-lg text-xs" onClick={() => onMedia()}><ImagePlus size={15} />{format === "REELS" ? "Choose video" : "Choose media"}</Button>}
          </div>
        )}
        {locked && attachments.count > 0 && <div aria-hidden className="flex items-center gap-4 px-5 pb-3 text-muted-foreground"><Heart size={21} /><MessageCircle size={21} /><Send size={20} /><Bookmark size={20} className="ml-auto" /></div>}
        {!locked && <div className="flex items-center justify-between px-5 pb-2 text-xs text-muted-foreground"><span>Caption</span><span>{hashtags.length} {hashtags.length === 1 ? "hashtag" : "hashtags"}</span></div>}
        <SocialPostText text={caption} label="Instagram caption" placeholder="Write a caption…" locked={locked} onChange={(value) => onChange({ ...payload, caption: value })} onRefine={onRefine} className="min-h-[130px]" />
        {!locked && issues.map((issue) => <EditorNotice key={issue}>{issue}</EditorNotice>)}
        {!locked && <SocialEditorToolbar text={caption} platform="instagram" limit={limit} capabilities={capabilities} onRefine={onRefine} onMedia={onMedia} tools={<>
          <HashtagEditor caption={caption} limit={limit} onChange={(value) => onChange({ ...payload, caption: value })} />
          {format === "CAROUSEL" && mediaIds && mediaIds.length > 1 && onMediaOrderChange && (
            <Popover>
              <PopoverTrigger render={<Button variant="ghost" className={EDITOR_TOOL} aria-label="Reorder carousel slides"><Images size={17} />Slide order</Button>} />
              <PopoverContent align="end" className="w-80 space-y-3">
                <p className="text-sm font-medium">Carousel slide order</p>
                <ol className="space-y-2">
                  {mediaIds.map((id, index) => <li key={id} className="flex items-center gap-2 text-xs"><span className="w-5 text-muted-foreground">{index + 1}.</span><span className="min-w-0 flex-1 truncate">{String(mediaAssets?.find((asset) => asset.id === id)?.original_filename ?? `Slide ${index + 1}`)}</span><Button variant="ghost" size="icon-xs" disabled={index === 0} aria-label={`Move slide ${index + 1} up`} onClick={() => onMediaOrderChange(reorderEditorMedia(mediaIds, index, -1))}><ArrowUp size={14} /></Button><Button variant="ghost" size="icon-xs" disabled={index === mediaIds.length - 1} aria-label={`Move slide ${index + 1} down`} onClick={() => onMediaOrderChange(reorderEditorMedia(mediaIds, index, 1))}><ArrowDown size={14} /></Button></li>)}
                </ol>
              </PopoverContent>
            </Popover>
          )}
        </>} />}
      </SocialPostCard>
    </div>
  );
}
