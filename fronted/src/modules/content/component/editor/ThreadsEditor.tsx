"use client";

import { ArrowDown, ArrowUp, Copy, Heart, MessageCircle, MoreHorizontal, Plus, Repeat2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { EditorProps } from "../../studio/editors/types";
import { threadItems } from "../../studio/model";
import { EditorNotice, SocialEditorToolbar, SocialPostCard, SocialPostText } from "./SocialEditor";
import { editorMedia, socialEditorIssues } from "./socialEditorModel";

export default function ThreadsEditor({ account, payload, onChange, capabilities, preview, readOnly, onRefine, onMedia, media, mediaIds, mediaAssets }: EditorProps) {
  const locked = preview || readOnly;
  const items = threadItems(payload);
  const canThread = capabilities.supports_threads === true;
  const handle = account.account_metadata.username ?? account.account_metadata.handle;
  const issues = socialEditorIssues("threads", payload, editorMedia(payload, mediaIds, mediaAssets), capabilities);
  function setItems(next: typeof items) {
    if (next.length > 1) onChange({ ...payload, thread: next });
    else {
      const single = { ...payload, ...next[0] };
      delete single.thread;
      onChange(single);
    }
  }
  function move(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setItems(next);
  }
  return (
    <div className="mx-auto w-full max-w-[600px] space-y-3">
      {items.map((item, index) => {
        const text = String(item.text ?? "");
        return (
          <div key={index} className="relative">
            {index > 0 && <span aria-hidden className="absolute -top-3 left-[42px] h-3 w-px bg-border" />}
            <SocialPostCard account={account} subtitle={<><span>{handle ? `@${String(handle).replace(/^@/, "")}` : "Threads"}</span><span aria-hidden>·</span><span>{locked ? "Post" : "Draft"}{items.length > 1 ? ` ${index + 1} of ${items.length}` : ""}</span></>} headerAction={!locked ? (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="rounded-lg text-muted-foreground" aria-label={`More options for Threads post ${index + 1}`}><MoreHorizontal size={19} /></Button>} />
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled={!text} onClick={async () => { try { await navigator.clipboard.writeText(text); toast.success("Post copied"); } catch { toast.error("Could not copy this post."); } }}><Copy size={15} />Copy post text</DropdownMenuItem>
                  {canThread && <DropdownMenuItem onClick={() => { const next = [...items]; next.splice(index + 1, 0, { text: "" }); setItems(next); }}><Plus size={15} />Add a post after this</DropdownMenuItem>}
                  {canThread && index > 0 && <DropdownMenuItem onClick={() => move(index, -1)}><ArrowUp size={15} />Move up</DropdownMenuItem>}
                  {canThread && index < items.length - 1 && <DropdownMenuItem onClick={() => move(index, 1)}><ArrowDown size={15} />Move down</DropdownMenuItem>}
                  {items.length > 1 && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => setItems(items.filter((_, i) => i !== index))}><Trash2 size={15} />Remove post</DropdownMenuItem></>}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined}>
              <SocialPostText text={text} label={`Threads post ${index + 1}`} placeholder="What’s new?" locked={locked} index={index} onRefine={onRefine} onChange={(value) => setItems(items.map((post, i) => i === index ? { ...post, text: value } : post))} className="min-h-[120px]" />
              {index === 0 && media && <div className="px-5">{media}</div>}
              {!locked && <SocialEditorToolbar text={text} platform="threads" limit={Number(capabilities.max_text_length ?? 500)} capabilities={index === 0 ? capabilities : { ...capabilities, supports_media: false }} onRefine={onRefine} onMedia={onMedia} index={index} />}
              {locked && <div aria-hidden className="flex items-center gap-4 border-t border-border/60 px-5 py-3 text-muted-foreground"><Heart size={19} /><MessageCircle size={19} /><Repeat2 size={19} /><Send size={18} /></div>}
            </SocialPostCard>
          </div>
        );
      })}
      {issues.map((issue) => <EditorNotice key={issue}>{issue}</EditorNotice>)}
      {!locked && canThread && <Button type="button" variant="ghost" className="rounded-lg text-xs text-muted-foreground" onClick={() => setItems([...items, { text: "" }])}><Plus size={15} />Add to thread</Button>}
    </div>
  );
}
