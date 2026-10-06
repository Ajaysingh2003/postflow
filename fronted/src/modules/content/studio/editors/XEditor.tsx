"use client";

import { useId, useState, type ComponentProps } from "react";
import { textLength } from "../model";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Flag,
  ImagePlus,
  ListPlus,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAccountAvatarUrl } from "@/modules/channels/component/AccountAvatar";
import { profileFor, threadItems, updateThread } from "../model";
import { Author, Counter, GrowingText, refineCurrentPost } from "./shared";
import type { EditorProps } from "./types";
import XPoll from "./XPoll";

const audiences = [
  { value: "everyone", label: "Everyone" },
  { value: "following", label: "People you follow" },
  { value: "mentionedUsers", label: "People you mention" },
  { value: "subscribers", label: "Subscribers" },
  { value: "verified", label: "Verified accounts" },
];

const disclosures = [
  {
    field: "paid_partnership",
    label: "Paid partnership",
    help: "This post promotes a brand or business.",
  },
  {
    field: "made_with_ai",
    label: "Made with AI",
    help: "This post contains synthetically generated content.",
  },
];

function ToolButton({
  help,
  ...props
}: ComponentProps<typeof Button> & { help: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 text-muted-foreground hover:text-foreground [&_svg]:size-4"
            {...props}
          />
        }
      />
      <TooltipContent side="bottom" sideOffset={4}>
        {help}
      </TooltipContent>
    </Tooltip>
  );
}

export default function XEditor({
  account,
  payload,
  onChange,
  readOnly,
  preview,
  capabilities,
  onRefine,
  onMedia,
  media,
}: EditorProps) {
  const items = threadItems(payload);
  const [disclosure, setDisclosure] = useState<number | null>(null);
  const [audience, setAudience] = useState<number | null>(null);
  const labelId = useId();
  const limit = Number(capabilities.max_text_length ?? 280);
  const avatar = getAccountAvatarUrl(account);

  function reorder(index: number, delta: number) {
    const next = [...items];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange({ thread: next });
  }


  


  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col">
        {items.map((item, index) => (
          <article className="relative pb-6" key={index}>
            {/* Seamless Thread Connector Line */}
            {index < items.length - 1 && (
              <span className="absolute left-[21px] top-[48px] bottom-0 w-0.5 bg-border/70 hidden sm:block" />
            )}

            <Author
              account={account}
              avatar={
                <Avatar key={account.id} className="size-11 shrink-0">
                  {avatar && (
                    <AvatarImage
                      src={avatar}
                      alt={account.display_name}
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {account.display_name
                      .replace(/^@/, "")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              }
            />

            <div className="pl-0 sm:pl-[55px] pt-1">
              {readOnly || preview ? (
                <div className="min-h-[72px] whitespace-pre-wrap [overflow-wrap:anywhere] py-1 text-base leading-relaxed tracking-[-0.01em]">
                  {String(item.text ?? "") || (
                    <span className="text-muted-foreground/50">
                      Your post will appear here.
                    </span>
                  )}
                </div>
              ) : (
                <GrowingText
                  aria-label={`X post ${index + 1}`}
                  placeholder={profileFor("x").placeholder}
                  value={String(item.text ?? "")}
                  onChange={(e) =>
                    onChange(
                      updateThread(payload, index, { text: e.target.value }),
                    )
                  }
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      onChange({ thread: [...items, { text: "" }] });
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
                      e.preventDefault();
                      onRefine(
                        e.currentTarget.value.substring(
                          e.currentTarget.selectionStart,
                          e.currentTarget.selectionEnd,
                        ) || undefined,
                        index,
                        e.currentTarget.selectionStart,
                        e.currentTarget.selectionEnd,
                        e.currentTarget,
                      );
                    }
                  }}
                />
              )}

              {index === 0 && media && <div className="mt-2.5">{media}</div>}

              {item.poll != null && (
                <div className="mt-2.5">
                  <XPoll
                    payload={item}
                    readOnly={readOnly || preview}
                    onChange={(value) => {
                      const next = [...items];
                      next[index] = value;
                      onChange(next.length === 1 ? next[0] : { thread: next });
                    }}
                  />
                </div>
              )}

              {/* Disclosures Tagline */}
              {(item.paid_partnership === true ||
                item.made_with_ai === true) && (
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  {[
                    item.paid_partnership && "Paid partnership",
                    item.made_with_ai && "Made with AI",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

              {/* Action Toolbar */}
              {!readOnly && !preview && (
                <div className="mt-3 flex h-8 items-center justify-between gap-2 border-t border-border/40 pt-2">
                  <div className="flex items-center gap-2">
                    {items.length > 1 && (
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        #{index + 1}
                      </span>
                    )}
                    <Counter
                      text={String(item.text ?? "")}
                      platform="x"
                      limit={limit}
                    />
                  </div>

                  <div className="flex items-center gap-0.5">
                    <ToolButton
                      help="Add a post"
                      aria-label={`Add a post after ${index + 1}`}
                      onClick={() => {
                        const next = [...items];
                        next.splice(index + 1, 0, { text: "" });
                        onChange({ thread: next });
                      }}
                    >
                      <ListPlus />
                    </ToolButton>
                    <ToolButton
                      help="Disclosures"
                      aria-label={`Disclosures for post ${index + 1}`}
                      onClick={() => setDisclosure(index)}
                    >
                      <Flag />
                    </ToolButton>
                    {index === 0 && capabilities.supports_media === true && (
                      <ToolButton
                        help="Attach media"
                        aria-label="Attach media"
                        onClick={onMedia}
                      >
                        <ImagePlus />
                      </ToolButton>
                    )}
                    <ToolButton
                      help="Refine · ⌘I"
                      aria-label={`Refine post ${index + 1}`}
                      onClick={(event) =>
                        refineCurrentPost(event.currentTarget, onRefine, index)
                      }
                    >
                      <Sparkles />
                    </ToolButton>

                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-muted-foreground hover:text-foreground [&_svg]:size-4"
                            aria-label={`More options for post ${index + 1}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setAudience(index)}>
                          <Users className="size-4" />
                          Who can reply
                          <span className="ml-auto text-xs focus-within:bg-transparent text-muted-foreground">
                            {
                              audiences.find(
                                (option) =>
                                  option.value ===
                                  (item.reply_settings || "everyone"),
                              )?.label
                            }
                          </span>
                        </DropdownMenuItem>
                        {index > 0 && (
                          <DropdownMenuItem onClick={() => reorder(index, -1)}>
                            <ArrowUp className="size-4" />
                            Move up
                          </DropdownMenuItem>
                        )}
                        {index < items.length - 1 && (
                          <DropdownMenuItem onClick={() => reorder(index, 1)}>
                            <ArrowDown className="size-4" />
                            Move down
                          </DropdownMenuItem>
                        )}
                        {!item.poll &&
                          index === 0 &&
                          capabilities.supports_polls === true && (
                            <DropdownMenuItem
                              onClick={() =>
                                onChange(
                                  updateThread(payload, index, {
                                    poll: {
                                      options: ["", ""],
                                      duration_minutes: 1440,
                                    },
                                  }),
                                )
                              }
                            >
                              <BarChart3 className="size-4" />
                              Add a poll
                            </DropdownMenuItem>
                          )}
                        {items.length > 1 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                const next = items.filter((_, i) => i !== index);
                                onChange(
                                  next.length === 1 ? next[0] : { thread: next },
                                );
                              }}
                            >
                              <Trash2 className="size-4" />
                              Remove post
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          </article>
        ))}

        {/* Add To Thread Button */}
        {!readOnly && !preview && (
          <div className="pl-0 sm:pl-[55px] pt-1">
            <Button
              variant="ghost"
              className="h-9 w-full sm:w-auto justify-start gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              onClick={() => onChange({ thread: [...items, { text: "" }] })}
            >
              <Plus className="size-3.5" />
              <span>Add to thread</span>
              <kbd className="ml-2 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                ⌘↵
              </kbd>
            </Button>
          </div>
        )}

        {/* Dialogs */}
        <Dialog
          open={audience !== null}
          onOpenChange={(open) => !open && setAudience(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Who can reply to post {(audience ?? 0) + 1}?
              </DialogTitle>
              <DialogDescription>
                Choose who can reply when this post is published on X.
              </DialogDescription>
            </DialogHeader>
            {audience !== null && (
              <div className="space-y-2 pt-2">
                <Label htmlFor={`${labelId}-audience`}>Reply audience</Label>
                <Select
                  items={audiences}
                  disabled={readOnly || preview}
                  value={String(items[audience]?.reply_settings || "everyone")}
                  onValueChange={(value) =>
                    onChange(
                      updateThread(payload, audience, {
                        reply_settings: value === "everyone" ? null : value,
                      }),
                    )
                  }
                >
                  <SelectTrigger
                    id={`${labelId}-audience`}
                    aria-label={`Reply audience for post ${audience + 1}`}
                    className="w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {audiences.map((option) => (
                      <SelectItem value={option.value} key={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog
          open={disclosure !== null}
          onOpenChange={(open) => !open && setDisclosure(null)}
        >
          <DialogContent className="p-6 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Disclosures for post {(disclosure ?? 0) + 1}
              </DialogTitle>
              <DialogDescription>
                These labels are included when publishing to X.
              </DialogDescription>
            </DialogHeader>
            <div className="divide-y divide-border/50 pt-2">
              {disclosure !== null &&
                disclosures.map(({ field, label, help }) => (
                  <div
                    key={field}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor={`${labelId}-${field}`} className="text-sm font-medium">
                        {label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{help}</p>
                    </div>
                    <Switch
                      id={`${labelId}-${field}`}
                      aria-label={label}
                      disabled={readOnly || preview}
                      checked={items[disclosure]?.[field] === true}
                      onCheckedChange={(checked) =>
                        onChange(
                          updateThread(payload, disclosure, { [field]: checked }),
                        )
                      }
                    />
                  </div>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}