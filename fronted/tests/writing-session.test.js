import { expect, test } from "bun:test";
import {
  carryDraft,
  switchWritingAccount,
  readWritingSession,
  sessionKey,
} from "../src/modules/content/studio/writingSession";
import { newDraft, draftText } from "../src/modules/content/studio/model";

const accounts = ["x", "linkedin", "reddit"].map((platform) => ({
  id: platform,
  platform,
  status: "active",
}));

test("X and LinkedIn keep the current text through repeated switches and edits", () => {
  let session = {
    activeAccountId: "x",
    drafts: {
      x: {
        ...newDraft("x"),
        payload: { text: "test", reply_settings: "following" },
      },
    },
  };
  session = switchWritingAccount(session, accounts, "linkedin");
  expect(session.drafts.linkedin.payload.text).toBe("test");
  session.drafts.linkedin.payload.text = "Edited on LinkedIn";
  session = switchWritingAccount(session, accounts, "x");
  expect(session.drafts.x.payload).toEqual({
    text: "Edited on LinkedIn",
    reply_settings: "following",
  });
  expect(session.drafts.linkedin.payload.text).toBe("Edited on LinkedIn");
});

test("a thread survives a round trip and every post reaches the LinkedIn editor", () => {
  let session = {
    activeAccountId: "x",
    drafts: {
      x: {
        ...newDraft("x"),
        payload: {
          thread: [
            { text: "First", paid_partnership: true },
            { text: "Second", made_with_ai: true },
          ],
        },
      },
    },
  };
  const original = structuredClone(session.drafts.x);
  session = switchWritingAccount(session, accounts, "linkedin");
  expect(session.drafts.linkedin.payload.text).toBe("First\n\nSecond");
  session = switchWritingAccount(session, accounts, "x");
  expect(session.drafts.x.payload).toEqual(original.payload);
});

test("Reddit settings stay with Reddit and a saved X identity never moves to another account", () => {
  const source = {
    ...newDraft("x"),
    payload: { text: "Current body" },
    variant: { id: "x-saved", connected_account_id: "x", status: "draft" },
    mediaIds: ["image"],
  };
  const cached = {
    ...newDraft("reddit"),
    payload: {
      body: "Older body",
      subreddit: "python",
      title: "Community title",
      flair_id: "discussion",
      post_type: "text",
    },
    variant: {
      id: "reddit-saved",
      connected_account_id: "reddit",
      status: "draft",
    },
  };
  const carried = carryDraft(source, "x", accounts[2], cached);
  expect(carried.variant.id).toBe("reddit-saved");
  expect(carried.payload).toEqual({ ...cached.payload, body: "Current body" });
  expect(carried.mediaIds).toEqual(["image"]);
  expect(cached.payload.body).toBe("Older body");
  expect(carryDraft(source, "x", accounts[1], source).variant).toBeNull();
});

test("switching cannot edit a cached scheduled or already-published post", () => {
  for (const status of ["scheduled", "published", "publishing"]) {
    const cached = {
      ...newDraft("linkedin"),
      variant: { id: "saved", connected_account_id: "linkedin", status },
    };
    const carried = carryDraft(
      { ...newDraft("x"), payload: { text: "New writing" } },
      "x",
      accounts[1],
      cached,
    );
    expect(carried.variant).toBeNull();
    expect(carried.localId).not.toBe(cached.localId);
    expect(carried.payload.text).toBe("New writing");
  }
});

test("switching between two X accounts keeps each account's own per-post settings", () => {
  const source = {
    ...newDraft("x"),
    payload: {
      thread: [
        { text: "First", reply_settings: "following" },
        { text: "Second", made_with_ai: true },
      ],
    },
  };
  const target = { ...accounts[0], id: "second-x" };
  const cached = {
    ...newDraft("x"),
    payload: {
      thread: [
        { text: "Old first", reply_settings: "mentionedUsers" },
        { text: "Old second", paid_partnership: true },
      ],
    },
  };
  const carried = carryDraft(source, "x", target, cached);
  expect(carried.payload.thread).toEqual([
    { text: "First", reply_settings: "mentionedUsers" },
    { text: "Second", paid_partnership: true },
  ]);
});

test("the shared draft recovers after reload and never restores another account's saved variant", () => {
  const session = {
    activeAccountId: "linkedin",
    drafts: {
      linkedin: {
        ...newDraft("linkedin"),
        payload: { text: "Recovered current writing" },
      },
    },
  };
  const values = new Map([[sessionKey("workspace"), JSON.stringify(session)]]);
  const previous = globalThis.localStorage;
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null };
  try {
    expect(readWritingSession("workspace", accounts)).toEqual(session);
    session.drafts.linkedin.variant = {
      id: "foreign",
      connected_account_id: "x",
      status: "draft",
    };
    values.set(sessionKey("workspace"), JSON.stringify(session));
    expect(
      readWritingSession("workspace", accounts).drafts.x.variant,
    ).toBeNull();
    expect(
      readWritingSession("another-workspace", accounts).drafts.x.payload.text,
    ).toBe("");
  } finally {
    globalThis.localStorage = previous;
  }
});
