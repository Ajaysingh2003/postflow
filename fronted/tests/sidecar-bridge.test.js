import { expect, test } from "bun:test";
import {
  assistantDraftSource,
  createSidecarReplacement,
} from "../src/modules/content/studio/sidecarBridge";
import { newDraft } from "../src/modules/content/studio/model";

function editor(platform, payload, selection = { index: 0 }) {
  let draft = { ...newDraft(platform), payload };
  const snapshot = structuredClone(draft);
  let conflicts = 0;
  const replace = createSidecarReplacement(
    snapshot,
    platform,
    selection,
    () => draft,
    (next) => {
      draft = next;
    },
    () => false,
    () => {
      conflicts++;
    },
  );
  return {
    replace,
    get draft() {
      return draft;
    },
    set draft(next) {
      draft = next;
    },
    get conflicts() {
      return conflicts;
    },
  };
}

test("the restored sidecar edits one X thread item and preserves its audience and disclosures", () => {
  const state = editor(
    "x",
    {
      thread: [
        { text: "First", reply_settings: "following" },
        { text: "Second", paid_partnership: true },
      ],
    },
    { index: 1 },
  );
  state.replace("Second", "Revised second");
  expect(state.draft.payload.thread).toEqual([
    { text: "First", reply_settings: "following" },
    { text: "Revised second", paid_partnership: true },
  ]);
  state.replace("Revised second", "Second");
  expect(state.draft.payload.thread[1].text).toBe("Second");
});

test("changing a Reddit community or flair blocks an earlier suggestion even when the body is unchanged", () => {
  const state = editor("reddit", {
    body: "An idea",
    subreddit: "python",
    flair_id: "discussion",
  });
  state.draft = {
    ...state.draft,
    payload: { ...state.draft.payload, subreddit: "learnpython" },
  };
  state.replace("An idea", "Revised idea");
  expect(state.draft.payload.body).toBe("An idea");
  expect(state.conflicts).toBe(1);
});

test("suggestions cannot overwrite another draft or a scheduled post", () => {
  for (const change of [
    { localId: "another-draft" },
    { variant: { status: "scheduled" } },
  ]) {
    const state = editor("linkedin", { text: "My draft" });
    state.draft = { ...state.draft, ...change };
    state.replace("My draft", "Revised draft");
    expect(state.draft.payload.text).toBe("My draft");
    expect(state.conflicts).toBe(1);
  }
});

test("a selected passage can be applied and undone after its length changes", () => {
  const state = editor(
    "linkedin",
    { text: "A short idea with context" },
    { index: 0, start: 2, end: 7 },
  );
  state.replace("short", "more thoughtful");
  expect(state.draft.payload.text).toBe("A more thoughtful idea with context");
  state.replace("more thoughtful", "short");
  expect(state.draft.payload.text).toBe("A short idea with context");
});

test("the assistant reads all current thread posts and falls back from a stale selection", () => {
  const payload = { thread: [{ text: "First" }, { text: "Edited second" }] };
  expect(assistantDraftSource(payload, "x", { index: -1 }).text).toBe(
    "First\n\nEdited second",
  );
  expect(
    assistantDraftSource(payload, "x", {
      index: 1,
      text: "Second",
      start: 0,
      end: 6,
    }),
  ).toEqual({ text: "First\n\nEdited second", selection: { index: -1 } });
  expect(
    assistantDraftSource({ text: "Latest text" }, "linkedin", {
      index: 0,
      text: "Older text",
    }).text,
  ).toBe("Latest text");
  expect(assistantDraftSource(payload, "x", { index: 3 }).text).toBe(
    "First\n\nEdited second",
  );
});

test("the whole-thread suggestion applies structured posts and undo restores every setting", () => {
  const original = {
    thread: [
      { text: "First", reply_settings: "following" },
      { text: "Second", paid_partnership: true },
    ],
  };
  let draft = { ...newDraft("x"), payload: original };
  const replace = createSidecarReplacement(
    structuredClone(draft),
    "x",
    { index: -1 },
    () => draft,
    (next) => {
      draft = next;
    },
    () => false,
    () => {
      throw new Error("Unexpected conflict");
    },
    ["New first", "New second"],
  );
  replace("First\n\nSecond", "New first\n\nNew second");
  expect(draft.payload.thread).toEqual([
    { text: "New first", reply_settings: "following" },
    { text: "New second", paid_partnership: true },
  ]);
  replace("New first\n\nNew second", "First\n\nSecond");
  expect(draft.payload).toEqual(original);
});
