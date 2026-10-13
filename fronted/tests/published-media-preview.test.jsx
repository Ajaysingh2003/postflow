import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import XEditor from "../src/modules/content/studio/editors/XEditor";
import { MediaPreview } from "../src/modules/content/studio/MediaPicker";
import { publishedPostMediaIds } from "../src/modules/content/studio/model";

const noop = () => {};
const props = {
  account: { id: "account", platform: "x", display_name: "A writer", account_metadata: {} },
  status: "published", readOnly: true, preview: true,
  onChange: noop, onMedia: noop, onRefine: noop,
  capabilities: { max_text_length: 280 }, media: null,
};
const assets = [
  { id: "photo", content_type: "image/png", alt_text: "Our pricing plans" },
  { id: "reply-photo", content_type: "image/jpeg", alt_text: "A second photo" },
];

describe("published image previews", () => {
  test("uses original workspace image instead of X's remote upload identifier", () => {
    const html = renderToStaticMarkup(<XEditor {...props}
      payload={{ text: "A published photo", media_ids: ["1234567890"] }}
      mediaIds={["photo"]} mediaAssets={assets} />);
    expect(html).toContain('src="/api/media/photo/content"');
    expect(html).toContain('alt="Our pricing plans"');
    expect(html).toContain("object-contain");
    expect(html).not.toContain("/api/media/1234567890/");
    expect(html).not.toContain("View attachment");
    expect(html).not.toContain("Remove attachment");
  });
  test("keeps the original images on their own thread posts without duplicates", () => {
    const payload = { thread: [
      { text: "First post", media_ids: ["remote-1"], media_asset_ids: ["photo"] },
      { text: "Second post", media_ids: ["remote-2"], media_asset_ids: ["reply-photo"] },
      { text: "Third post", media_asset_ids: [] },
    ] };
    const html = renderToStaticMarkup(<XEditor {...props} payload={payload}
      mediaIds={["photo", "reply-photo"]} mediaAssets={assets} />);
    expect(html.match(/src="\/api\/media\/photo\/content"/g)).toHaveLength(1);
    expect(html.match(/src="\/api\/media\/reply-photo\/content"/g)).toHaveLength(1);
    expect(html.indexOf('src="/api/media/photo/content"')).toBeLessThan(html.indexOf("Second post"));
    expect(html.indexOf('src="/api/media/reply-photo/content"')).toBeGreaterThan(html.indexOf("Second post"));
    expect(publishedPostMediaIds(payload, ["photo", "reply-photo"], 2)).toEqual([]);
  });
  test("preserves legacy assignments and excludes unlinked workspace identifiers", () => {
    expect(publishedPostMediaIds({ media_ids: ["photo"] }, ["photo"], 0)).toEqual(["photo"]);
    expect(publishedPostMediaIds({ text: "Post" }, ["photo"], 0)).toEqual(["photo"]);
    const payload = { thread: [
      { text: "Root", media_asset_ids: [] },
      { text: "Reply", media_asset_ids: ["reply-photo", "unlinked"] },
    ] };
    expect(publishedPostMediaIds(payload, ["reply-photo"], 0)).toEqual([]);
    expect(publishedPostMediaIds(payload, ["reply-photo"], 1)).toEqual(["reply-photo"]);
  });
  test("videos keep controls and documents keep their actual file link", () => {
    const html = renderToStaticMarkup(<MediaPreview readOnly onRemove={noop}
      ids={["video", "document"]} assets={[
        { id: "video", content_type: "video/mp4", original_filename: "Clip" },
        { id: "document", content_type: "application/pdf", original_filename: "Guide.pdf" },
      ]} />);
    expect(html).toContain("<video");
    expect(html).toContain("controls");
    expect(html).toContain('href="/api/media/document/content"');
    expect(html).toContain("Guide.pdf");
  });
});
