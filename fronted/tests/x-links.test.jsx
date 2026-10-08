import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  containsPostLink,
  xLinkIssues,
  X_LINK_MESSAGE,
} from "../src/modules/content/studio/xLinks";
import XEditor from "../src/modules/content/studio/editors/XEditor";
import { socialEditorIssues } from "../src/modules/content/component/editor/socialEditorModel";
import {
  destinationDraft,
  submitDestinations,
} from "../src/modules/content/studio/publicationModel";

test("X detects explicit URLs, bare domains and Unicode links without blocking email or versions", () => {
  for (const text of [
    "https://example.com",
    "HTTP://EXAMPLE.COM",
    "www.example.com",
    "See\nexample.com/path",
    "blog.example.co.uk",
    "t.co/short",
    "пример.рф",
    "xn--e1afmkfd.xn--p1ai",
  ])
    expect(containsPostLink(text)).toBe(true);
  for (const text of [
    "A useful idea.",
    "writer@example.com first.last@sub.example.co.uk",
    "Version 1.3.0 costs $3.50",
    "@writer #Writing",
  ])
    expect(containsPostLink(text)).toBe(false);
});

test("X checks every thread item and leaves attachment URLs and draft text intact", () => {
  const payload = {
    thread: ["First", { text: "Read example.com" }],
    media_urls: ["https://storage.example.com/image.png"],
  };
  const before = structuredClone(payload);
  expect(xLinkIssues(payload)).toEqual([`Post 2: ${X_LINK_MESSAGE}`]);
  expect(payload).toEqual(before);
  expect(
    xLinkIssues({ text: "A photo", media_urls: payload.media_urls }),
  ).toEqual([]);
});

test("only editable X versions show the link warning in the shared X and Threads editor", () => {
  for (const [platform, readOnly, warning] of [
    ["x", false, true],
    ["threads", false, false],
    ["x", true, false],
  ]) {
    const html = renderToStaticMarkup(
      <XEditor
        account={{
          id: platform,
          platform,
          display_name: "Writer",
          status: "active",
          account_metadata: {},
        }}
        payload={{ text: "Read https://example.com" }}
        onChange={() => {}}
        capabilities={{ supports_threads: true }}
        readOnly={readOnly}
        preview={false}
        onRefine={() => {}}
        onMedia={() => {}}
        media={null}
      />,
    );
    expect(html.includes('role="alert"')).toBe(warning);
    expect(html).toContain("https://example.com");
  }
});

test("other channels retain links when creating destination drafts", () => {
  const sourceAccount = { id: "source", platform: "x" };
  const source = {
    payload: { text: "Read https://example.com" },
    media_asset_ids: [],
  };
  for (const platform of [
    "linkedin",
    "reddit",
    "bluesky",
    "mastodon",
    "facebook",
    "instagram",
    "threads",
  ]) {
    const draft = destinationDraft(source, sourceAccount, {
      id: platform,
      platform,
    });
    expect(JSON.stringify(draft.payload)).toContain("https://example.com");
    const issues = socialEditorIssues(
      platform,
      draft.payload,
      { count: 0, types: [] },
      { supports_threads: true },
    );
    expect(issues.some((issue) => issue.includes(X_LINK_MESSAGE))).toBe(false);
  }
  expect(
    socialEditorIssues("x", source.payload, { count: 0, types: [] }, {}),
  ).toEqual([X_LINK_MESSAGE]);
});

test("a blocked X destination does not prevent other channels from submitting", async () => {
  const submitted = [];
  const results = await submitDestinations(
    ["x", "threads", "linkedin"],
    async (id) => {
      if (id === "x")
        throw new Error(xLinkIssues({ text: "Read example.com" })[0]);
      submitted.push(id);
      return { accountId: id, status: "scheduled", message: "Scheduled" };
    },
  );
  expect(submitted).toEqual(["threads", "linkedin"]);
  expect(results.map((result) => result.status)).toEqual([
    "error",
    "scheduled",
    "scheduled",
  ]);
});
