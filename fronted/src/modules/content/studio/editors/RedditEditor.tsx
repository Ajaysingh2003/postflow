"use client";
import { useState } from "react";
import { Link2, Sparkles } from "lucide-react";
import type { SubredditProfile } from "@/modules/studio/types";
import { profileFor } from "../model";
import MarkdownPreview from "../MarkdownPreview";
import { GrowingText, Counter, refineCurrentPost } from "./shared";
import type { EditorProps } from "./types";
import { cn } from "@/lib/utils";

export default function RedditEditor({
  profile,
  profileError,
  loadingProfile,
  onCommunity,
  ...props
}: EditorProps & {
  profile?: SubredditProfile;
  profileError?: string;
  loadingProfile: boolean;
  onCommunity: (name: string) => void;
}) {
  const { payload, onChange, readOnly, preview, account, onRefine } = props;
  const [rulesOpen, setRulesOpen] = useState(false);
  const type = String(payload.post_type ?? "text");
  const maxTitle = Number(profile?.title_requirements.max_length ?? 300);
  return (
    <div data-reddit-editor className="flex flex-col">
      <div className="flex items-center gap-2.5 min-w-0 mb-6">
        <span className="size-8 flex items-center justify-center rounded-full bg-[#f5ede8] text-[#ef5527] font-semibold text-sm shrink-0">
          r/
        </span>
        <input
          className="bg-transparent text-[13px] font-semibold flex-1 min-w-0 outline-none text-foreground placeholder:text-muted-foreground/60"
          aria-label="Subreddit"
          list="studio-subreddits"
          placeholder="Choose a community"
          value={String(payload.subreddit ?? "")}
          readOnly={readOnly || preview}
          onChange={(e) =>
            onChange({
              ...payload,
              subreddit: e.target.value.replace(/^r\//, ""),
              flair_id: null,
            })
          }
          onBlur={(e) => onCommunity(e.target.value)}
        />
        <button
          className="text-[10px] text-muted-foreground hover:text-foreground whitespace-nowrap cursor-pointer transition-colors"
          onClick={() => setRulesOpen(!rulesOpen)}
          aria-expanded={rulesOpen}
        >
          {loadingProfile ? "Loading rules…" : "Community rules"}
        </button>
      </div>
      {profileError && (
        <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap" role="alert">
          {profileError}
        </p>
      )}
      {rulesOpen && (
        <section className="bg-muted/55 rounded-lg p-4.5 mb-6 text-[11px] leading-relaxed [&_h3]:font-semibold [&>p]:text-muted-foreground [&>p]:mt-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_ol]:mt-4 [&_li]:py-1.5 [&_li>p]:text-muted-foreground [&_li>p]:whitespace-pre-wrap [&_small]:text-muted-foreground [&_small]:block [&_small]:mt-3.5">
          <h3>r/{String(payload.subreddit || "community")}</h3>
          {profile ? (
            <>
              <p>
                {profile.allowed_post_types
                  .filter((v) => ["text", "link"].includes(v))
                  .join(" & ")}{" "}
                posts ·{" "}
                {profile.flair_required ? "Flair required" : "Flair optional"}
              </p>
              {profile.title_requirements.cannot_submit === true && (
                <p className="text-[11px] leading-relaxed text-destructive py-2 whitespace-pre-wrap">
                  This account cannot submit to this community.
                </p>
              )}
              <ol>
                {profile.rules.map((rule, i) => (
                  <li key={i}>
                    <strong>{rule.short_name}</strong>
                    <p>{rule.description}</p>
                  </li>
                ))}
              </ol>
              <small>
                Checked {new Date(profile.fetched_at).toLocaleString()}
              </small>
            </>
          ) : (
            <p>Choose a community to load its current rules and flairs.</p>
          )}
        </section>
      )}
      <div
        className="flex gap-6 border-b border-border mb-5.5"
        role="tablist"
        aria-label="Reddit post type"
      >
        {["text", "link"].map((v) => (
          <button
            role="tab"
            aria-selected={type === v}
            disabled={
              readOnly ||
              preview ||
              (profile != null && !profile.allowed_post_types.includes(v))
            }
            className={cn(
              "px-1 pb-3 text-xs border-b-2 cursor-pointer transition-colors",
              type === v
                ? "text-foreground border-b-[#ed5825] font-medium"
                : "text-muted-foreground border-b-transparent hover:text-foreground",
            )}
            key={v}
            onClick={() => onChange({ ...payload, post_type: v })}
          >
            {v === "text" ? "Text" : "Link"}
          </button>
        ))}
      </div>
      <input
        className="text-[21px] sm:text-[23px] font-semibold tracking-tight bg-transparent w-full py-2 leading-snug outline-none placeholder:text-muted-foreground/50 text-foreground"
        aria-label="Reddit title"
        placeholder="An interesting title"
        value={String(payload.title ?? "")}
        readOnly={readOnly || preview}
        onChange={(e) => onChange({ ...payload, title: e.target.value })}
      />
      {!preview && !readOnly && (
        <Counter
          text={String(payload.title ?? "")}
          platform="reddit"
          limit={maxTitle}
        />
      )}
      <div className="my-4 mb-6 text-muted-foreground text-[11px] [&>span]:opacity-60">
        Posted by {account.display_name.replace(/^u\//, "u/")}
        <span>
          {" "}
          ·{" "}
          {props.status === "published"
            ? "Published"
            : props.status === "scheduled"
              ? "Scheduled"
              : props.status === "publishing"
                ? "Publishing"
                : "Draft"}
        </span>
      </div>
      {type === "link" ? (
        <label className="flex flex-col gap-2 text-[11px] my-3.5 [&>span]:flex [&>span]:items-center [&>span]:gap-1.5 [&>span]:text-muted-foreground">
          <span>
            <Link2 size={14} />
            Destination URL
          </span>
          <input
            type="url"
            className="border border-border p-2.5 rounded-md text-xs bg-background text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Reddit link URL"
            placeholder="https://"
            readOnly={readOnly || preview}
            value={String(payload.url ?? "")}
            onChange={(e) => onChange({ ...payload, url: e.target.value })}
          />
        </label>
      ) : readOnly || preview ? (
        <div className="whitespace-pre-wrap [overflow-wrap:anywhere] text-base leading-[1.7] py-1.5 pb-5 min-h-[80px] tracking-[-0.1px]">
          {payload.body ? (
            <MarkdownPreview text={String(payload.body)} />
          ) : (
            <span className="text-muted-foreground/60">
              Your post will appear here.
            </span>
          )}
        </div>
      ) : (
        <GrowingText
          className="w-full text-[15px] leading-relaxed bg-transparent min-h-[200px] outline-none placeholder:text-muted-foreground/60 text-foreground"
          aria-label="Reddit body"
          placeholder={profileFor("reddit").placeholder}
          value={String(payload.body ?? "")}
          onChange={(e) => onChange({ ...payload, body: e.target.value })}
        />
      )}
      {!readOnly && !preview && (
        <div className="mt-4 flex items-end justify-between gap-4 flex-wrap [&_label]:text-[10px] [&_label]:text-muted-foreground [&_select]:block [&_select]:border [&_select]:border-border [&_select]:rounded-md [&_select]:p-2 [&_select]:bg-background [&_select]:text-foreground [&_select]:mt-1.5 [&_select]:max-w-[240px] [&_select]:text-[11px] [&_select]:outline-none [&_label>span]:block [&_label>span]:mt-1.5 [&_button]:flex [&_button]:items-center [&_button]:gap-1.5 [&_button]:text-[10px] [&_button]:text-muted-foreground hover:[&_button]:text-foreground [&_button]:cursor-pointer [&_button]:transition-colors">
          <label>
            Post flair
            {profile ? (
              <select
                aria-label="Post flair"
                value={String(payload.flair_id ?? "")}
                onChange={(e) =>
                  onChange({ ...payload, flair_id: e.target.value || null })
                }
              >
                <option value="">
                  {profile.flair_required
                    ? "Choose a flair (required)"
                    : "No flair"}
                </option>
                {profile.available_flairs.map((flair) => (
                  <option key={flair.id} value={flair.id}>
                    {flair.text}
                  </option>
                ))}
              </select>
            ) : (
              <span>Choose a community first</span>
            )}
          </label>
          <button
            onClick={(event) =>
              refineCurrentPost(event.currentTarget, onRefine)
            }
          >
            <Sparkles size={16} />
            Refine for r/{String(payload.subreddit || "community")}
          </button>
        </div>
      )}
      {type === "text" && !preview && !readOnly && (
        <div className="flex items-center justify-between text-muted-foreground text-[11px] min-h-[30px] mt-5 [&>small]:opacity-65">
          <small>Markdown supported</small>
          <Counter
            text={String(payload.body ?? "")}
            platform="reddit"
            limit={40000}
          />
        </div>
      )}
      <p className="text-[11px] text-muted-foreground leading-relaxed mt-5">
        Every subreddit is its own community. Review its rules before
        scheduling. Text and link posts are supported.
      </p>
    </div>
  );
}
