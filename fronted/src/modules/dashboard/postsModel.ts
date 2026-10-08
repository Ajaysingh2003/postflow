import type { PostLibraryItem } from "@/modules/studio/types";

export const POST_TABS = ["posts", "scheduled", "drafts"] as const;
export type PostTab = typeof POST_TABS[number];
export const TAB_LABELS: Record<PostTab, string> = {
  posts: "Published", scheduled: "Scheduled", drafts: "Drafts",
};
export const POSTS_PAGE_SIZE = 50;

export function postTab(value: string | null): PostTab {
  return POST_TABS.includes(value as PostTab) ? value as PostTab : "posts";
}
export function libraryLink(account: string, tab: PostTab, page = 0) {
  return `/dashboard/posts?${new URLSearchParams({account, tab, ...(page ? {page: String(page)} : {})})}`;
}
export function newPostLink(account: string) {
  return `/dashboard/content?${new URLSearchParams({new: "1", account})}`;
}
export function libraryPostText(post: PostLibraryItem): string {
  const payload = post.payload;
  if (Array.isArray(payload.thread)) {
    return payload.thread.map((item) => typeof item === "string" ? item :
      item && typeof item === "object" ? String(item.text ?? "") : "").join("\n\n");
  }
  return String(payload.text ?? payload.caption ?? payload.body ?? post.base_text ?? "");
}
export function editorLink(post: Pick<PostLibraryItem, "post_id" | "id">) {
  return `/dashboard/content?${new URLSearchParams({post: post.post_id, variant: post.id})}`;
}
export function libraryPostDate(post: PostLibraryItem): string | null {
  return post.status === "published" ? post.published_at ?? post.updated_at :
    post.status === "scheduled" || post.status === "publishing" ? post.scheduled_time : post.updated_at;
}
export function postStatus(status: string): string {
  return status === "publishing" ? "Publishing" : status === "published" ? "Published" :
    status === "scheduled" ? "Scheduled" : status === "failed" || status === "rejected" ? "Needs attention" : "Draft";
}
