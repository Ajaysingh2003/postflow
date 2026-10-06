"use client";
import {
  Globe2,
  Plus,
  ImagePlus,
  BarChart3,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { profileFor, threadItems } from "../model";
import { Author, GrowingText, Counter, refineCurrentPost } from "./shared";
import LinkedInPoll from "./LinkedInPoll";
import type { EditorProps } from "./types";

export default function LinkedInEditor({
  account,
  payload,
  onChange,
  capabilities,
  preview,
  readOnly,
  onRefine,
  onMedia,
  media,
}: EditorProps) {
  const profile = profileFor("linkedin");
  const text = String(payload[profile.textKey] ?? "");
  const visibility = Array.isArray(capabilities.visibility_options)
    ? (capabilities.visibility_options as string[])
    : [];
  if (Array.isArray(payload.thread)) {
    const items = threadItems(payload);
    return (
      <div className="flex flex-col gap-5">
        {items.map((item, index) => (
          <LinkedInEditor
            key={index}
            account={account}
            payload={item}
            onChange={(value) => {
              const next = [...items];
              next[index] = value;
              onChange({ thread: next });
            }}
            capabilities={capabilities}
            preview={preview}
            readOnly={readOnly}
            onRefine={(text, _, start, end, anchor) =>
              onRefine(text, index, start, end, anchor)
            }
            onMedia={onMedia}
            media={index === 0 ? media : null}
          />
        ))}
        {!readOnly && !preview && (
          <button
            className="flex items-center gap-1.5 text-muted-foreground text-xs ml-0 sm:ml-[55px] py-2.5 hover:text-foreground cursor-pointer transition-colors"
            onClick={() => onChange({ thread: [...items, { text: "" }] })}
          >
            <Plus size={16} />
            Add to thread
          </button>
        )}
      </div>
    );
  }
  return (
    <article className="p-4 sm:p-6 border border-border rounded-xl shadow-xs">
      <Author
        account={account}
        secondary={String(
          account.account_metadata.headline ?? "Your professional network",
        )}
      />
      {visibility.length > 0 && (
        <label className="flex items-center gap-1.5 ml-0 sm:ml-[55px] mt-2 text-muted-foreground text-[10px] [&_select]:text-[10px] [&_select]:bg-transparent [&_select]:max-w-[180px] [&_select]:outline-none">
          <Globe2 size={12} />
          <select
            aria-label="Post visibility"
            disabled={readOnly || preview}
            value={String(payload.visibility ?? visibility[0])}
            onChange={(e) =>
              onChange({ ...payload, visibility: e.target.value })
            }
          >
            {visibility.map((value) => (
              <option key={value} value={value}>
                {value === "PUBLIC" || value === "public"
                  ? "Anyone"
                  : value === "CONNECTIONS"
                    ? "Connections only"
                    : value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      )}
      {readOnly || preview ? (
        <div className="whitespace-pre-wrap [overflow-wrap:anywhere] text-base leading-[1.7] py-1.5 pb-5 min-h-[80px] tracking-[-0.1px] mt-5">
          {text || (
            <span className="text-muted-foreground/60">
              Your post will appear here.
            </span>
          )}
        </div>
      ) : (
        <GrowingText
          className="mt-5 min-h-[190px] sm:min-h-[230px]"
          aria-label={`${profile.name} post`}
          placeholder={profile.placeholder}
          value={text}
          onChange={(e) =>
            onChange({ ...payload, [profile.textKey]: e.target.value })
          }
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "i") {
              e.preventDefault();
              onRefine(
                e.currentTarget.value.substring(
                  e.currentTarget.selectionStart,
                  e.currentTarget.selectionEnd,
                ) || undefined,
                0,
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
                e.currentTarget,
              );
            }
          }}
        />
      )}
      {media}
      {payload.poll != null && (
        <LinkedInPoll
          payload={payload}
          onChange={onChange}
          readOnly={readOnly || preview}
        />
      )}
      {!readOnly && !preview && (
        <div className="flex items-center justify-between border-t border-border pt-3.5 text-muted-foreground [&>div]:flex [&>div]:gap-4 [&_button]:hover:text-foreground [&_button]:cursor-pointer [&_button]:transition-colors">
          <div>
            {capabilities.supports_media === true && (
              <button aria-label="Attach media" onClick={() => onMedia()}>
                <ImagePlus size={17} />
              </button>
            )}
            {capabilities.supports_polls === true && !payload.poll && (
              <button
                aria-label="Add a poll"
                onClick={() =>
                  onChange({
                    ...payload,
                    poll: {
                      question: "",
                      options: ["", ""],
                      duration: "SEVEN_DAYS",
                    },
                  })
                }
              >
                <BarChart3 size={17} />
              </button>
            )}
            <button
              aria-label="Refine post"
              onClick={(event) =>
                refineCurrentPost(event.currentTarget, onRefine)
              }
            >
              <Sparkles size={17} />
            </button>
          </div>
          <Counter
            text={text}
            platform="linkedin"
            limit={Number(capabilities.max_text_length ?? 3000)}
            counting={capabilities.text_length_type}
          />
        </div>
      )}
      {(preview || readOnly) && (
        <footer className="flex items-center justify-around border-t border-border pt-4 text-muted-foreground text-[11px] [&>span]:flex [&>span]:items-center [&>span]:gap-1.5">
          <span>Like</span>
          <span>
            <MessageCircle size={16} />
            Comment
          </span>
          <span>Repost</span>
          <span>Send</span>
        </footer>
      )}
    </article>
  );
}
