import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryPostCard } from "../src/modules/dashboard/view/PostsView";
import { editorLink, libraryLink, libraryPostDate, libraryPostText, newPostLink, POST_TABS, postStatus, postTab } from "../src/modules/dashboard/postsModel";

const post = {id: "variant", post_id: "post", platform: "x", connected_account_id: "account", title: "Untitled", base_text: "Fallback", payload: {text: "Published through draftva"}, status: "published", media_asset_ids: ["asset"], published_at: "2026-10-07T12:00:00Z", updated_at: "2026-10-08T00:00:00Z"};

test("the library has only published, scheduled and drafts; old reply links resolve to published", () => {
  expect(POST_TABS).toEqual(["posts", "scheduled", "drafts"]);
  for (const old of ["all", "replies", "failed", "invalid", null]) expect(postTab(old)).toBe("posts");
  const url = new URL(libraryLink("x-account", "drafts", 2), "http://localhost");
  expect(url.searchParams.get("account")).toBe("x-account");
  expect(url.searchParams.get("tab")).toBe("drafts");
  expect(url.searchParams.get("page")).toBe("2");
  expect(libraryLink("x-account", "scheduled")).not.toContain("page=");
  expect(url.searchParams.has("start_date")).toBeFalse();
});

test("cards open the saved draftva variant, using its publication or scheduled date", () => {
  const html = renderToStaticMarkup(<LibraryPostCard post={post} account={{display_name: "Writer"}} />);
  expect(html).toContain('href="/dashboard/content?post=post&amp;variant=variant"');
  expect(html).toContain("Published through draftva");
  expect(html).toContain("View post");
  expect(html).not.toContain("Impressions");
  expect(html).not.toContain("Reply");
  expect(editorLink(post)).toBe("/dashboard/content?post=post&variant=variant");
  expect(libraryPostDate(post)).toBe(post.published_at);
  expect(libraryPostDate({...post, status: "scheduled", scheduled_time: "2026-10-09"})).toBe("2026-10-09");
});

test("a saved thread stays one post and failed drafts keep their explanation", () => {
  expect(libraryPostText({...post, payload: {thread: [{text: "One"}, {text: "Two"}]}})).toBe("One\n\nTwo");
  expect(libraryPostText({...post, payload: {caption: "An Instagram caption"}})).toBe("An Instagram caption");
  expect(libraryPostText({...post, payload: {}})).toBe("Fallback");
  const html = renderToStaticMarkup(<LibraryPostCard post={{...post, status: "failed", last_error: "Reconnect this account"}} account={{display_name: "Writer"}} />);
  expect(html).toContain("Needs attention");
  expect(html).toContain("Reconnect this account");
  expect(html).toContain("Open editor");
  expect(postStatus("publishing")).toBe("Publishing");
  const link = new URL(newPostLink("threads-account"), "http://localhost");
  expect(link.searchParams.get("new")).toBe("1");
  expect(link.searchParams.get("account")).toBe("threads-account");
});
