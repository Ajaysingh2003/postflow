import { describe, expect, test } from "bun:test";
import { emptySettings } from "../src/modules/content/composerTypes";
import {
  generateLinkedInRefinement,
  linkedInRefineSource,
} from "../src/modules/content/component/editor/linkedinRefinement";

function setup(overrides = {}) {
  const applied = [];
  const errors = [];
  const calls = [];
  const controller = new AbortController();
  const options = {
    snapshot: {
      state: {
        localId: "draft",
        content: "Before old text after",
        composer: { ...emptySettings(), visibility: "CONNECTIONS", comment: "Keep me" },
      },
      accountId: "account",
      workspaceId: "workspace",
      start: 7,
      end: 15,
    },
    request: { command: "grammar", custom: "", preferences: { language: "British English", commands: {} } },
    signal: controller.signal,
    isCurrent: () => true,
    runAssistant: async (input) => {
      calls.push(input);
      return { output: { rewritten_text: "New text" }, validation_issues: [] };
    },
    apply: (text) => applied.push(text),
    onError: (message) => errors.push(message),
    ...overrides,
  };
  return { options, applied, errors, calls, controller };
}

describe("component LinkedIn refinement", () => {
  test("refines the selected passage using the Studio service and preserves surrounding text and settings", async () => {
    const { options, applied, calls } = setup();
    expect(linkedInRefineSource(options.snapshot)).toBe("old text");
    const result = await generateLinkedInRefinement(options);
    expect(calls[0]).toMatchObject({
      feature: "rewrite_with_tone",
      platform: "linkedin",
      input_data: { text: "old text" },
      connected_account_id: "account",
      validation_context: { visibility: "CONNECTIONS" },
      output_language: "British English",
    });
    expect(result.apply("replace")).toBe(true);
    expect(applied).toEqual(["Before New text after"]);
    expect(options.snapshot.state.composer.comment).toBe("Keep me");
  });

  test("inserts after a selection and supports whole-post follow-up refinements", async () => {
    const selected = setup();
    const result = await generateLinkedInRefinement(selected.options);
    result.apply("insert");
    expect(selected.applied).toEqual(["Before old text\n\nNew text after"]);
    const whole = setup();
    delete whole.options.snapshot.start;
    delete whole.options.snapshot.end;
    whole.options.request.previous = "Previous revision";
    whole.options.request.followup = "Make it warmer";
    const next = await generateLinkedInRefinement(whole.options);
    expect(whole.calls[0].input_data.text).toBe("Previous revision");
    expect(whole.calls[0].input_data.tone).toContain("Make it warmer");
    next.apply("replace");
    expect(whole.applied).toEqual(["New text"]);
  });

  test("rejects drafts that change before generation or before applying", async () => {
    let current = false;
    const { options, calls, applied, errors } = setup({ isCurrent: () => current });
    await expect(generateLinkedInRefinement(options)).rejects.toThrow("draft changed");
    expect(calls).toHaveLength(0);
    current = true;
    const result = await generateLinkedInRefinement(options);
    current = false;
    expect(result.apply("replace")).toBe(false);
    expect(applied).toHaveLength(0);
    expect(errors[0]).toContain("draft changed");
  });

  test("never applies cancelled, invalid, empty or over-limit responses", async () => {
    const aborted = setup();
    aborted.controller.abort();
    await expect(generateLinkedInRefinement(aborted.options)).rejects.toThrow("Cancelled");
    for (const response of [
      { output: { rewritten_text: "New" }, validation_issues: [{ severity: "error", message: "Invalid post" }] },
      { output: { rewritten_text: " " } },
    ]) {
      const { options } = setup({ runAssistant: async () => response });
      await expect(generateLinkedInRefinement(options)).rejects.toThrow();
    }
    const long = setup({ runAssistant: async () => ({ output: { rewritten_text: "a".repeat(3000) } }) });
    const result = await generateLinkedInRefinement(long.options);
    expect(result.apply("replace")).toBe(false);
    expect(long.applied).toHaveLength(0);
    expect(long.errors[0]).toContain("3,000-character limit");
  });
});
