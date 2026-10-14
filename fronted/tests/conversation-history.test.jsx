import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HistoryList,
  HistorySkeleton,
} from "../src/modules/content/component/AssistantHistory";
import { savedChatRun } from "../src/modules/content/hooks/useAgentChat";
import {
  groupConversations,
  responseDraft,
} from "../src/modules/content/chatTypes";
import { DraftArtifactCard } from "../src/modules/content/component/DraftArtifactCard";

const now = new Date(2026, 9, 13, 12);
const conversation = (id, date, title = "A better opening") => ({
  id,
  title,
  platform: "x",
  connected_account_id: "account",
  context: { account_name: "Jamie" },
  turn_count: 2,
  created_at: date.toISOString(),
  updated_at: date.toISOString(),
});

test("History groups dates using the viewer’s local calendar, including month boundaries", () => {
  const items = [
    conversation("today", now),
    conversation("yesterday", new Date(2026, 9, 12, 23)),
    conversation("week", new Date(2026, 9, 7)),
    conversation("old", new Date(2026, 8, 30)),
  ];
  expect(groupConversations(items, now).map(([label]) => label)).toEqual([
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Earlier",
  ]);
  expect(
    groupConversations(
      [conversation("boundary", new Date(2026, 8, 30, 23))],
      new Date(2026, 9, 1, 1),
    )[0][0],
  ).toBe("Yesterday");
});

test("History has accessible selection, privacy-friendly summaries and honest empty/search states", () => {
  const render = (props) =>
    renderToStaticMarkup(
      <HistoryList
        items={[]}
        activeId={null}
        busy={false}
        open={() => {}}
        {...props}
      />,
    );
  expect(render({})).toContain("Your conversations live here");
  expect(render({ search: "not found" })).toContain(
    "No matching conversations",
  );
  const html = render({
    items: [conversation("one", now, "<script>unsafe</script>")],
    activeId: "one",
    busy: true,
    now,
  });
  expect(html).toContain('aria-current="true"');
  expect(html).toContain('disabled=""');
  expect(html).toContain("Jamie");
  expect(html).not.toContain("<script>");
  expect(renderToStaticMarkup(<HistorySkeleton />)).toContain(
    'data-slot="skeleton"',
  );
});

test("Reopening a saved turn restores its original and result but never applies to another draft", () => {
  const turn = {
    id: "turn",
    request_id: "request",
    sequence: 1,
    prompt: "Make it clearer",
    original_text: "A rough idea",
    response_data: {
      output: { rewritten_text: "A useful idea", notes: "Polished" },
    },
    status: "succeeded",
    error: null,
    created_at: now.toISOString(),
  };
  const run = savedChatRun(turn, "workspace:account:draft", now.getTime());
  expect(run.prompt).toBe(turn.prompt);
  expect(run.artifact.original).toBe("A rough idea");
  expect(run.artifact.content).toBe("A useful idea");
  expect(run.text).toBe("Polished");
  expect(run.canApply).toBe(false);
  expect(run.replace).toBeUndefined();
  const html = renderToStaticMarkup(
    <DraftArtifactCard
      artifact={run.artifact}
      content={run.artifact.original}
      ready={false}
      replace={() => {}}
      readOnlyReason="Saved suggestion. Copy it to use in your current draft."
    />,
  );
  expect(html).toContain("Saved suggestion");
  expect(html).toContain("disabled");
  expect(html).toContain("Copy suggestion");
});

test("Threads and interrupted or failed responses survive restoration accurately", () => {
  expect(responseDraft({ tweets: ["First post", "Second post"] })).toBe(
    "First post\n\nSecond post",
  );
  expect(responseDraft({ tweets: [null] })).toBe("");
  const turn = {
    id: "turn",
    request_id: "request",
    sequence: 1,
    prompt: "A draft",
    original_text: "",
    response_data: {},
    status: "running",
    error: null,
    created_at: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
  };
  expect(savedChatRun(turn, "scope", now.getTime()).status).toBe("failed");
  expect(savedChatRun(turn, "scope", now.getTime()).error).toContain(
    "interrupted",
  );
  expect(
    savedChatRun(
      { ...turn, status: "failed", error: "Quota reached" },
      "scope",
      now.getTime(),
    ).error,
  ).toBe("Quota reached");
});
