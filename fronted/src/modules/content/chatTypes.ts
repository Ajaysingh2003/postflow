import type { Payload } from "@/modules/studio/types";
export type ChatContext = {
  source_text?: string;
  origin_scope?: string;
  account_name?: string;
  draft_id?: string | null;
};
export type Conversation = {
  id: string;
  title: string;
  platform: string;
  connected_account_id: string | null;
  context: ChatContext;
  turn_count: number;
  created_at: string;
  updated_at: string;
};
export type ChatTurn = {
  id: string;
  request_id: string;
  sequence: number;
  prompt: string;
  original_text: string;
  response_data: { output?: Payload; tokens_used?: number };
  status: "running" | "succeeded" | "failed";
  error: string | null;
  created_at: string;
};
export type ChatPage = Conversation & {
  can_continue: boolean;
  continue_notice?: string | null;
  turns: ChatTurn[];
  next_cursor: number | null;
};
export type ConversationPage = {
  items: Conversation[];
  next_cursor: number | null;
};
export type ConversationTurnContext = {
  id: string;
  requestId: string;
  workspaceId: string;
};
export function responseDraft(output: Payload = {}) {
  if (typeof output.rewritten_text === "string") return output.rewritten_text;
  return Array.isArray(output.tweets) &&
    output.tweets.every((text) => typeof text === "string")
    ? output.tweets.join("\n\n")
    : "";
}
export function groupConversations(items: Conversation[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const groups: Record<string, Conversation[]> = {};
  for (const item of items) {
    const date = new Date(item.updated_at);
    const group =
      date >= today
        ? "Today"
        : date >= yesterday
          ? "Yesterday"
          : date >= week
            ? "Previous 7 days"
            : "Earlier";
    (groups[group] ??= []).push(item);
  }
  return Object.entries(groups);
}
