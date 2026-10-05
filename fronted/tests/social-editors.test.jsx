import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FacebookEditor from "../src/modules/content/component/editor/FacebookEditor";
import InstagramEditor from "../src/modules/content/component/editor/InstagramEditor";
import ThreadsEditor from "../src/modules/content/component/editor/ThreadsEditor";
import { captionHashtags, editorMedia, instagramFormat, reorderEditorMedia, replaceCaptionHashtags, safePostLink, socialEditorIssues } from "../src/modules/content/component/editor/socialEditorModel";
import { refineCommands, refineInstructions } from "../src/modules/content/studio/refinement";

const noop = () => {};
const props = (platform, payload = {}) => ({
  account: { id: platform, platform, display_name: "Studio North", status: "active", account_metadata: { username: "studionorth" } },
  payload,
  capabilities: { max_text_length: platform === "threads" ? 500 : platform === "instagram" ? 2200 : 63206, supports_media: true, supports_video: true, supports_threads: false, supports_links: platform === "facebook", max_media_count: 10 },
  onChange: noop, onMedia: noop, onRefine: noop, media: null, readOnly: false, preview: false,
});

describe("social editors", () => {
  test("all editors share shadcn controls, body typography and the Refine action", () => {
    for (const [platform, Editor, label] of [["threads", ThreadsEditor, "Threads post 1"], ["facebook", FacebookEditor, "Facebook post"], ["instagram", InstagramEditor, "Instagram caption"]]) {
      const html = renderToStaticMarkup(<Editor {...props(platform)} />);
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain('data-slot="textarea"');
      expect(html).toContain('data-slot="button"');
      expect(html).toContain("md:text-[15.5px]");
      expect(html).toContain('aria-label="Refine post"');
      expect(html).not.toContain("<select");
      expect(html).not.toContain("linear-gradient");
    }
  });
  test("Facebook uses a real link payload with a safe preview and Page context", () => {
    const html = renderToStaticMarkup(<FacebookEditor {...props("facebook", { text: "An update", link: "https://example.com/article" })} />);
    expect(html).toContain("Page");
    expect(html).toContain('aria-label="Facebook post link"');
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('href="https://example.com/article"');
    const unsafe = renderToStaticMarkup(<FacebookEditor {...props("facebook", { link: "javascript:alert(1)" })} preview />);
    expect(unsafe).not.toContain('href="javascript:');
    expect(unsafe).toContain("Enter a complete http or https link.");
  });
  test("Instagram shows format tabs, media requirements, hashtag count and carousel ordering", () => {
    const html = renderToStaticMarkup(<InstagramEditor {...props("instagram", { caption: "A new collection. #design #studio" })} />);
    expect(html).toContain('aria-label="Instagram post format"');
    expect(html).toContain('data-slot="tabs-trigger"');
    expect(html).toContain("Carousel");
    expect(html).toContain("Reel");
    expect(html).toContain("2 hashtags");
    expect(html).toContain("Add your photo");
    expect(html).toContain('aria-label="Edit caption hashtags"');
    const carousel = renderToStaticMarkup(<InstagramEditor {...props("instagram", { caption: "Slides", media_type: "CAROUSEL" })} mediaIds={["a", "b"]} mediaAssets={[{ id: "a", content_type: "image/jpeg" }, { id: "b", content_type: "image/jpeg" }]} media={<div>Selected slides</div>} onMediaOrderChange={noop} />);
    expect(carousel).toContain("Selected slides");
    expect(carousel).toContain('aria-label="Reorder carousel slides"');
    expect(carousel).not.toContain("Add your carousel");
  });
  test("Threads respects publisher thread capabilities and refines every existing post separately", () => {
    const single = renderToStaticMarkup(<ThreadsEditor {...props("threads", { text: "Hello" })} />);
    expect(single).not.toContain("Add to thread");
    const base = props("threads", { thread: [{ text: "First" }, { text: "Second" }] });
    const chain = renderToStaticMarkup(<ThreadsEditor {...base} capabilities={{ ...base.capabilities, supports_threads: true }} />);
    expect(chain).toContain('aria-label="Threads post 2"');
    expect(chain).toContain('aria-label="Refine post 2"');
    expect(chain).toContain("Add to thread");
    const unsupported = renderToStaticMarkup(<ThreadsEditor {...base} />);
    expect(unsupported).toContain("one post at a time");
  });
  test("preview and read-only modes preserve content without editing actions", () => {
    for (const [platform, Editor] of [["threads", ThreadsEditor], ["facebook", FacebookEditor], ["instagram", InstagramEditor]]) {
      for (const mode of [{ preview: true }, { readOnly: true }]) {
        const html = renderToStaticMarkup(<Editor {...props(platform, { text: "Saved text", caption: "Saved text" })} {...mode} />);
        expect(html).toContain("Saved text");
        expect(html).not.toContain("textarea");
        expect(html).not.toContain('aria-label="Refine post"');
        expect(html).not.toContain('aria-label="Edit caption hashtags"');
        expect(html).not.toContain('aria-label="Instagram post format"');
      }
    }
  });
});

describe("platform options", () => {
  test("media counts and types reflect selected workspace assets, including unloaded files", () => {
    expect(editorMedia({}, ["a", "b"], [{ id: "a", content_type: "video/mp4" }])).toEqual({ count: 2, types: ["video/mp4", ""] });
    expect(editorMedia({ media_urls: ["old"] }, [])).toEqual({ count: 0, types: [] });
    expect(instagramFormat({}, { count: 1, types: ["video/mp4"] })).toBe("REELS");
    expect(instagramFormat({}, { count: 2, types: ["image/jpeg", "image/jpeg"] })).toBe("CAROUSEL");
    expect(instagramFormat({ media_type: "IMAGE" }, { count: 2, types: [] })).toBe("IMAGE");
  });
  test("format checks prevent publishing the wrong kind of Instagram attachment", () => {
    const cap = props("instagram").capabilities;
    expect(socialEditorIssues("instagram", { media_type: "REELS" }, { count: 1, types: ["image/jpeg"] }, cap)).toContain("A Reel needs one video attachment.");
    expect(socialEditorIssues("instagram", { media_type: "CAROUSEL" }, { count: 1, types: ["image/jpeg"] }, cap)).toContain("A carousel needs at least two attachments.");
    expect(socialEditorIssues("instagram", { media_type: "IMAGE" }, { count: 1, types: ["video/mp4"] }, cap)).toHaveLength(1);
    expect(socialEditorIssues("instagram", { media_type: "REELS" }, { count: 1, types: ["video/mp4"] }, cap)).toEqual([]);
    expect(socialEditorIssues("facebook", { link: "https://example.com" }, { count: 1, types: ["image/jpeg"] }, {})).toHaveLength(1);
    expect(safePostLink("https://name:password@example.com")).toBeNull();
  });
  test("hashtag edits deduplicate tags without damaging URLs, mentions or Unicode", () => {
    const caption = "A useful post.\nRead https://example.com/#section and ask @alex.\n\n#Old #旧";
    expect(captionHashtags(caption)).toEqual(["#Old", "#旧"]);
    expect(replaceCaptionHashtags(caption, "#Design design #新しい")).toBe("A useful post.\nRead https://example.com/#section and ask @alex.\n\n#design #新しい");
    expect(replaceCaptionHashtags("Post #old", "bad-tag")).toBeNull();
    expect(replaceCaptionHashtags("Post\n\n#old", "")).toBe("Post");
    expect(captionHashtags("Post #डिज़ाइन #Cafe\u0301")).toEqual(["#डिज़ाइन", "#Cafe\u0301"]);
    expect(replaceCaptionHashtags("Post #old", "#Cafe\u0301 #Café")).toBe("Post\n\n#Café");
  });
  test("reordering preserves every attachment and does not mutate the original", () => {
    const ids = ["first", "second", "third"];
    expect(reorderEditorMedia(ids, 1, -1)).toEqual(["second", "first", "third"]);
    expect(reorderEditorMedia(ids, 2, 1)).toEqual(ids);
    expect(ids).toEqual(["first", "second", "third"]);
  });
  test("platform Refine commands are scoped and resolve to their own instructions", () => {
    const facebook = refineCommands("facebook");
    expect(facebook.some((command) => command.id === "facebook_cta")).toBe(true);
    expect(facebook.some((command) => command.id === "instagram_hook")).toBe(false);
    expect(refineCommands("instagram").some((command) => command.id === "instagram_hashtags")).toBe(true);
    expect(refineCommands("x")).toHaveLength(11);
    expect(refineInstructions("instagram_hook", "", { language: "", commands: {} })).toContain("first line");
  });
});
