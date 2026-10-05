import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  applyWritingOutput,
  canEditDraft,
  draftText,
  featureDefaults,
  fingerprint,
  newDraft,
  profileFor,
  readDraft,
  textLength,
  updateThread,
  xLength,
} from "../src/modules/content/studio/model";
import RedditEditor from "../src/modules/content/studio/editors/RedditEditor";
import LinkedInEditor from "../src/modules/content/component/editor/ConnectedLinkedInEditor";
import { TRPCReactProvider } from "../src/trpc/client";
import BlueskyEditor from "../src/modules/content/studio/editors/BlueskyEditor";
import MastodonEditor from "../src/modules/content/studio/editors/MastodonEditor";
import XEditor from "../src/modules/content/studio/editors/XEditor";
import XPoll from "../src/modules/content/studio/editors/XPoll";
import MarkdownPreview from "../src/modules/content/studio/MarkdownPreview";

const noop = () => {};
const account = (platform, id = platform) => ({
  id,
  platform,
  display_name: "A writer",
  status: "active",
  account_metadata: { username: "writer" },
});
const props = (platform, payload) => ({
  account: account(platform),
  payload,
  onChange: noop,
  capabilities: {
    max_text_length: platform === "x" ? 280 : 3000,
    supports_media: true,
    supports_polls: true,
    visibility_options:
      platform === "linkedin" ? ["PUBLIC", "CONNECTIONS"] : [],
  },
  readOnly: false,
  preview: false,
  onRefine: noop,
  onMedia: noop,
  media: null,
});

describe("account-aware writing", () => {
  test("applies LinkedIn poll output and keeps Reddit promotional disclosure", () => {
    expect(
      applyWritingOutput(
        {
          question: "What helps?",
          options: ["Focus", "Practice"],
          introductory_post: "Share your experience.",
        },
        {},
        "linkedin",
      ),
    ).toEqual({
      text: "Share your experience.",
      poll: {
        question: "What helps?",
        options: ["Focus", "Practice"],
        duration: "SEVEN_DAYS",
      },
    });
    expect(
      applyWritingOutput(
        {
          rewritten_body: "A useful story",
          transparency_statement: "I built this tool.",
        },
        { subreddit: "python" },
        "reddit",
      ).body,
    ).toBe("A useful story\n\nI built this tool.");
  });
  test("counts weighted X text, fixed URLs, CJK, combining marks and emoji correctly", () => {
    expect(xLength("Hello")).toBe(5);
    expect(xLength("你好")).toBe(4);
    expect(xLength("e\u0301")).toBe(1);
    expect(xLength("👨‍👩‍👧‍👦🇮🇳1️⃣")).toBe(6);
    expect(xLength("Read https://example.com/a-very-long-path")).toBe(28);
    expect(textLength("👨‍👩‍👧‍👦e\u0301", "bluesky", "graphemes")).toBe(2);
  });
  test("updates one thread item without losing its disclosures or the other items", () => {
    const payload = {
      thread: [{ text: "first", paid_partnership: true }, { text: "second" }],
    };
    const next = updateThread(payload, 1, {
      text: "new second",
      reply_settings: "following",
    });
    expect(next.thread[0]).toEqual(payload.thread[0]);
    expect(payload.thread[1].text).toBe("second");
    expect(next.thread[1]).toEqual({
      text: "new second",
      reply_settings: "following",
    });
    expect(draftText(next, "x")).toBe("first\n\nnew second");
  });
  test("keeps Reddit community and flair when applying a community rewrite", () => {
    const original = {
      subreddit: "programming",
      flair_id: "showcase",
      title: "Old",
      body: "Old body",
      post_type: "text",
    };
    expect(
      applyWritingOutput(
        { title: "A useful title", body: "Useful context", post_type: "text" },
        original,
        "reddit",
      ),
    ).toEqual({ ...original, title: "A useful title", body: "Useful context" });
    expect(
      applyWritingOutput(
        { is_compliant: false, risks: ["Promotion"] },
        original,
        "reddit",
      ),
    ).toBeNull();
  });
  test("only writing results enter the editor, preserving audience settings", () => {
    expect(
      applyWritingOutput(
        { full_post: "Experience matters" },
        { visibility: "CONNECTIONS" },
        "linkedin",
      ),
    ).toEqual({ text: "Experience matters", visibility: "CONNECTIONS" });
    expect(applyWritingOutput({ tweets: ["One", "Two"] }, {}, "x")).toEqual({
      thread: [{ text: "One" }, { text: "Two" }],
    });
    expect(
      applyWritingOutput({ slides: [{ title: "Outline" }] }, {}, "linkedin"),
    ).toBeNull();
  });
  test("locks published, queued, uncertain and partially published posts against duplicate publishing", () => {
    expect(canEditDraft(null)).toBe(true);
    expect(canEditDraft({ status: "failed", publish_state: {} })).toBe(true);
    for (const variant of [
      { status: "published" },
      { status: "scheduled" },
      { status: "publishing" },
      { status: "failed", publish_state: { outcome_unknown: true } },
      { status: "failed", publish_state: { thread_ids: ["123"] } },
    ])
      expect(canEditDraft(variant)).toBe(false);
  });
  test("restores only the selected account's backup and handles corrupt storage", () => {
    const storage = new Map();
    const original = globalThis.localStorage;
    globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null };
    try {
      const x = newDraft("x");
      x.payload.text = "My X draft";
      const reddit = newDraft("reddit");
      reddit.payload.body = "My Reddit draft";
      storage.set("workspace:x", JSON.stringify(x));
      storage.set("workspace:reddit", JSON.stringify(reddit));
      expect(readDraft("workspace:x", account("x")).payload.text).toBe(
        "My X draft",
      );
      expect(
        readDraft("workspace:reddit", account("reddit")).payload.body,
      ).toBe("My Reddit draft");
      storage.set(
        "workspace:x",
        JSON.stringify({ ...x, variant: { connected_account_id: "other" } }),
      );
      expect(readDraft("workspace:x", account("x")).payload.text).toBe("");
      storage.set("bad", "invalid json");
      expect(readDraft("bad", account("reddit")).payload.post_type).toBe(
        "text",
      );
    } finally {
      globalThis.localStorage = original;
    }
  });
  test("generation gets the draft and selected community rather than another account's context", () => {
    const feature = {
      input_schema: {
        properties: { draft: {}, subreddit: {}, count: { default: 3 } },
      },
    };
    expect(
      featureDefaults(
        feature,
        { body: "Actual draft", subreddit: "python" },
        "reddit",
      ),
    ).toEqual({ draft: "Actual draft", subreddit: "python", count: "3" });
    expect(fingerprint({ text: "a" }, ["media"])).not.toBe(
      fingerprint({ text: "a" }, []),
    );
    expect(profileFor("reddit").help).toContain("community");
  });
});

describe("platform editors", () => {
  test("Reddit preview renders common Markdown and treats HTML and unsafe links as text", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        text={
          "## A heading\n\n- **A point**\n- Another point\n\n[Safe](https://example.com)\n[Unsafe](javascript:alert(1))\n<img src=x onerror=alert(1)>"
        }
      />,
    );
    expect(html).toContain("<h3>A heading</h3>");
    expect(html).toContain("<strong>A point</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
  test("other connected platforms can display assistant-generated threads", () => {
    const html = renderToStaticMarkup(
      <BlueskyEditor
        {...props("bluesky", {
          thread: [
            { text: "First Bluesky post" },
            { text: "Second Bluesky post" },
          ],
        })}
      />,
    );
    expect(html).toContain("First Bluesky post");
    expect(html).toContain("Second Bluesky post");
    expect(html).toContain("Add to thread");
  });
  test("Mastodon preserves each thread item's own content warning", () => {
    const html = renderToStaticMarkup(
      <MastodonEditor
        {...props("mastodon", {
          thread: [
            { text: "First", spoiler_text: "First warning", sensitive: true },
            { text: "Second", spoiler_text: "Second warning", sensitive: true },
          ],
        })}
      />,
    );
    expect(html.match(/aria-label="Content warning"/g)).toHaveLength(2);
    expect(html).toContain('value="First warning"');
    expect(html).toContain('value="Second warning"');
  });
  test("X renders independently editable thread items and per-post controls", () => {
    const html = renderToStaticMarkup(
      <XEditor
        {...props("x", { thread: [{ text: "First" }, { text: "Second" }] })}
      />,
    );
    expect(html).toContain('aria-label="X post 1"');
    expect(html).toContain('aria-label="X post 2"');
    expect(html).toContain("Disclosures for post 2");
    expect(html).toContain('aria-label="More options for post 2"');
    expect(html).toContain('data-slot="textarea"');
    expect(html).toContain('data-slot="button"');
    expect(html).not.toContain("<details");
    expect(html).toContain("Add to thread");
  });
  test("Reddit has title, community, text/link, real flair options and community rules", () => {
    const html = renderToStaticMarkup(
      <RedditEditor
        {...props("reddit", {
          subreddit: "python",
          title: "Title",
          body: "Body",
          post_type: "text",
        })}
        profile={{
          name: "python",
          rules: [],
          allowed_post_types: ["text"],
          flair_required: true,
          available_flairs: [{ id: "help", text: "Help" }],
          title_requirements: { max_length: 100 },
          fetched_at: "2026-10-04T00:00:00Z",
        }}
        loadingProfile={false}
        onCommunity={noop}
      />,
    );
    for (const label of [
      "Subreddit",
      "Reddit title",
      "Reddit body",
      "Post flair",
    ])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('value="help"');
    expect(html).toContain("Community rules");
    expect(html).toContain("Markdown supported");
  });
  test("LinkedIn has its own audience, media/poll controls and native preview", () => {
    const html = renderToStaticMarkup(
      <TRPCReactProvider>
        <LinkedInEditor
          {...props("linkedin", { text: "A LinkedIn post" })}
          account={{ ...account("linkedin"), account_metadata: { picture_url: "https://example.com/profile.jpg" } }}
        />
      </TRPCReactProvider>,
    );
    expect(html).toContain('aria-label="LinkedIn post content"');
    expect(html).toContain('aria-label="Change post visibility"');
    expect(html).toContain('aria-label="Add a poll"');
    expect(html).toContain('aria-label="Refine post"');
    expect(html).toContain("Refine");
    expect(html).toContain('src="https://example.com/profile.jpg"');
    expect(html).not.toMatch(/<button[^>]*><button/);
    const preview = renderToStaticMarkup(
      <TRPCReactProvider>
        <LinkedInEditor
          {...props("linkedin", { text: "Published text" })}
          preview={true}
        />
      </TRPCReactProvider>,
    );
    expect(preview).toContain("Published text");
    expect(preview).not.toContain("textarea");
    expect(preview).toContain("Repost");
    expect(preview).not.toContain('aria-label="Refine post"');
  });
  test("the component LinkedIn editor keeps thread posts, attached media, polls and locked states", () => {
    const values = props("linkedin", {
      thread: [
        { text: "First", visibility: "CONNECTIONS" },
        { text: "Second", poll: { question: "Question?", options: ["A", "B"] } },
      ],
    });
    const html = renderToStaticMarkup(
      <TRPCReactProvider>
        <LinkedInEditor {...values} media={<div>Attached media</div>} />
      </TRPCReactProvider>,
    );
    expect(html).toContain("First");
    expect(html).toContain("Second");
    expect(html).toContain("Connections only");
    expect(html.match(/Attached media/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Poll question"');
    expect(html).toContain("Add to thread");
    const locked = renderToStaticMarkup(
      <TRPCReactProvider>
        <LinkedInEditor {...values} readOnly />
      </TRPCReactProvider>,
    );
    expect(locked).not.toContain('aria-label="Refine post"');
    expect(locked).not.toContain("Add to thread");
  });
  test("X polls use shadcn inputs and selects with platform limits", () => {
    const html = renderToStaticMarkup(
      <XPoll
        payload={{ poll: { options: ["One", "Two"], duration_minutes: 1440 } }}
        onChange={noop}
        readOnly={false}
      />,
    );
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain('maxLength="25"');
    expect(html).not.toContain("<select");
    const locked = renderToStaticMarkup(
      <XEditor
        {...props("x", {
          text: "Published",
          poll: { options: ["One", "Two"], duration_minutes: 1440 },
        })}
        readOnly={true}
      />,
    );
    expect(locked).not.toContain("Add to thread");
    expect(locked).not.toContain("More options for post");
    expect(locked).not.toContain("Remove poll");
  });
});
