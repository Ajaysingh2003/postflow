import type { Account } from "@/modules/studio/types";
import {
  canEditDraft,
  draftText,
  newDraft,
  profileFor,
  readDraft,
  threadItems,
  type WritingDraft,
} from "./model";

export type WritingSession = {
  activeAccountId: string;
  drafts: Record<string, WritingDraft>;
};

export function sessionKey(workspaceId: string) {
  return `draftva:current-writing-draft:${workspaceId}`;
}

export function readWritingSession(
  workspaceId: string,
  accounts: Account[],
): WritingSession {
  try {
    const stored = JSON.parse(
      localStorage.getItem(sessionKey(workspaceId)) ?? "null",
    );
    const account = accounts.find(
      (item) => item.id === stored?.activeAccountId,
    );
    if (account) {
      const drafts: Record<string, WritingDraft> = {};
      for (const item of accounts) {
        const draft = stored.drafts?.[item.id];
        if (
          draft?.localId &&
          draft.payload &&
          typeof draft.payload === "object" &&
          !Array.isArray(draft.payload) &&
          Array.isArray(draft.mediaIds) &&
          typeof draft.saved === "string" &&
          (!draft.variant || draft.variant.connected_account_id === item.id)
        )
          drafts[item.id] = draft;
      }
      if (drafts[account.id]) return { activeAccountId: account.id, drafts };
    }
  } catch {
    /* Fall back to the previous account backup. */
  }
  let selected = "";
  try {
    selected =
      localStorage.getItem(`draftva:active-writing-account:${workspaceId}`) ??
      "";
  } catch {
    /* Storage is optional. */
  }
  const account =
    accounts.find((item) => item.id === selected) ??
    accounts.find((item) => item.status === "active") ??
    accounts[0];
  return {
    activeAccountId: account.id,
    drafts: {
      [account.id]: readDraft(
        `draftva:editor:${workspaceId}:${account.id}`,
        account,
      ),
    },
  };
}

/** Carry writing between accounts without ever moving a saved variant's identity. */
export function carryDraft(
  source: WritingDraft,
  sourcePlatform: string,
  target: Account,
  cached?: WritingDraft,
): WritingDraft {
  const draft =
    cached &&
    (!cached.variant || cached.variant.connected_account_id === target.id) &&
    canEditDraft(cached.variant)
      ? structuredClone(cached)
      : newDraft(target.platform);
  const text = draftText(source.payload, sourcePlatform);
  if (draftText(draft.payload, target.platform) !== text) {
    const ownPosts = threadItems(draft.payload);
    const { thread: _thread, ...settings } = draft.payload;
    void _thread;
    draft.payload = {
      ...settings,
      ...(Array.isArray(draft.payload.thread) ? ownPosts[0] : {}),
      [profileFor(target.platform).textKey]: text,
    };
    if (
      sourcePlatform === target.platform &&
      Array.isArray(source.payload.thread)
    ) {
      draft.payload = {
        thread: threadItems(source.payload).map((post, index) => ({
          ...ownPosts[index],
          text: post.text ?? "",
        })),
      };
    }
  }
  draft.mediaIds = [...source.mediaIds];
  return draft;
}

export function switchWritingAccount(
  session: WritingSession,
  accounts: Account[],
  id: string,
): WritingSession {
  const source = accounts.find((item) => item.id === session.activeAccountId);
  const target = accounts.find((item) => item.id === id);
  if (!source || !target || source.id === target.id) return session;
  return {
    ...session,
    activeAccountId: id,
    drafts: {
      ...session.drafts,
      [id]: carryDraft(
        session.drafts[source.id],
        source.platform,
        target,
        session.drafts[id],
      ),
    },
  };
}
