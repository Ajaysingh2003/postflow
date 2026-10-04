import { describe, expect, test } from "bun:test";
import {
  REFINE_COMMANDS,
  applyRefinement,
  refinementDiff,
  refinementChanges,
  refineInstructions,
  refinePreferencesKey,
  readRefinePreferences,
} from "../src/modules/content/studio/refinement";

describe("inline refinement", () => {
  test("includes all reference commands with distinct editing instructions", () => {
    expect(REFINE_COMMANDS).toHaveLength(11);
    expect(new Set(REFINE_COMMANDS.map((item) => item.instruction)).size).toBe(
      11,
    );
    expect(
      refineInstructions("grammar", "", {
        language: "",
        commands: { grammar: "Keep British spelling" },
      }),
    ).toContain("Keep British spelling");
    expect(
      refineInstructions(
        "custom",
        "Make it warmer",
        { language: "", commands: {} },
        "Keep the opening",
      ),
    ).toContain(
      "Make it warmer\nFurther refine the proposed response: Keep the opening",
    );
  });
  test("replaces a selected passage without losing settings or neighboring posts", () => {
    const payload = {
      thread: [
        {
          text: "Before look at this after",
          paid_partnership: true,
          poll: { options: ["A", "B"] },
        },
        { text: "Another", made_with_ai: true },
      ],
    };
    const next = applyRefinement(
      payload,
      "x",
      { index: 0, start: 7, end: 19 },
      "look at this",
      "Look at this.",
      "replace",
    );
    expect(next.thread[0]).toEqual({
      ...payload.thread[0],
      text: "Before Look at this. after",
    });
    expect(next.thread[1]).toEqual(payload.thread[1]);
    expect(payload.thread[0].text).toBe("Before look at this after");
  });
  test("insert retains the source and adds the response immediately after it", () => {
    expect(
      applyRefinement(
        { text: "Original", visibility: "PUBLIC" },
        "linkedin",
        { index: 0 },
        "Original",
        "New version",
        "insert",
      ),
    ).toEqual({ text: "Original\n\nNew version", visibility: "PUBLIC" });
    expect(
      applyRefinement(
        { body: "First last", title: "Title", subreddit: "writing" },
        "reddit",
        { index: 0, start: 0, end: 5 },
        "First",
        "Inserted",
        "insert",
      ),
    ).toEqual({
      body: "First\n\nInserted last",
      title: "Title",
      subreddit: "writing",
    });
  });
  test("rejects stale selections and missing thread items instead of overwriting", () => {
    expect(
      applyRefinement(
        { text: "Changed" },
        "x",
        { index: 0 },
        "Original",
        "Rewrite",
        "replace",
      ),
    ).toBeNull();
    expect(
      applyRefinement(
        { thread: [{ text: "First" }] },
        "x",
        { index: 2 },
        "First",
        "Rewrite",
        "replace",
      ),
    ).toBeNull();
    expect(
      applyRefinement(
        { text: "First" },
        "x",
        { index: 0, start: -1, end: 5 },
        "First",
        "Rewrite",
        "replace",
      ),
    ).toBeNull();
  });
  test("diff highlights edits without splitting emoji and preserves unchanged text", () => {
    expect(refinementDiff("look at this", "Look at this.")).toEqual({
      prefix: "",
      removed: "look at this",
      added: "Look at this.",
      suffix: "",
    });
    expect(refinementDiff("Hello 👩", "Hello 👨")).toEqual({
      prefix: "Hello ",
      removed: "👩",
      added: "👨",
      suffix: "",
    });
    expect(refinementDiff("Same", "Same")).toEqual({
      prefix: "Same",
      removed: "",
      added: "",
      suffix: "",
    });
  });
  test("preferences are scoped to each account and corrupt storage is harmless", () => {
    expect(refinePreferencesKey("ws", "x")).not.toBe(
      refinePreferencesKey("ws", "linkedin"),
    );
    expect(readRefinePreferences("bad JSON")).toEqual({
      language: "",
      commands: {},
    });
    expect(
      readRefinePreferences(
        JSON.stringify({
          language: "Hindi",
          commands: { grammar: "Keep names", bad: 12 },
        }),
      ),
    ).toEqual({ language: "Hindi", commands: { grammar: "Keep names" } });
  });
  test("response highlights only changed words and always reproduces the exact output", () => {
    expect(refinementChanges("look at this", "Look at this.")).toEqual([
      { text: "Look", added: true },
      { text: " at this", added: false },
      { text: ".", added: true },
    ]);
    for (const [before, after] of [
      ["a b a", "a a b"],
      ["Long old post", "New"],
      ["👨‍👩‍👧", "👨‍👩‍👦"],
      ["", "New text"],
      ["a".repeat(2000), "! ".repeat(2000)],
    ])
      expect(
        refinementChanges(before, after)
          .map((part) => part.text)
          .join(""),
      ).toBe(after);
  });
});
