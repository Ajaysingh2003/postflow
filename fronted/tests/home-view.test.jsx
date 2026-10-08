import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeOverview } from "../src/modules/dashboard/view/HomeView";
import HomeSkeleton from "../src/modules/dashboard/component/HomeSkeleton";
import { HomeAiUsageCard } from "../src/modules/dashboard/component/HomeAiUsageCard";
import {
  homePostLink,
  homePostTime,
  homeFailureMessage,
  homeSetup,
} from "../src/modules/dashboard/homeModel";

const post = {
  post_id: "post",
  variant_id: "variant",
  connected_account_id: "account",
  platform: "threads",
  title: "Untitled",
  text: "A real draft from this workspace",
  status: "draft",
  updated_at: "2026-10-08T09:00:00Z",
  scheduled_time: null,
  published_at: null,
  last_error: null,
};
const empty = {
  workspace_id: "workspace",
  workspace_name: "Writing room",
  fetched_at: "2026-10-08T10:00:00Z",
  can_edit: true,
  can_manage_channels: true,
  usage: {
    plan_code: "free",
    cycle_start: "2026-10-01T00:00:00Z",
    cycle_end: "2026-11-01T00:00:00Z",
    connected_accounts: { used: 0, limit: 2, remaining: 2 },
    ai_credits: { used: 0, limit: 20, remaining: 20 },
    scheduled_posts: { used: 0, limit: 5, remaining: 5 },
  },
  counts: {
    drafts: 0,
    scheduled: 0,
    published_week: 0,
    published: 0,
    failed: 0,
  },
  accounts: [],
  drafts: [],
  upcoming: [],
  published: [],
  failed: [],
};

test("a fresh workspace has useful empty states and a primary connection action", () => {
  const html = renderToStaticMarkup(<HomeOverview data={empty} />);
  expect(html).toContain("Finish setting up");
  expect(html).toContain("0 of 3 complete");
  expect(html).toContain("Connect your first channel");
  expect(html).not.toContain("Continue writing");
  expect(html).toContain("Nothing scheduled");
  expect(html).toContain("No published posts yet");
  expect(html).toContain('href="/dashboard/channels"');
  expect(html).toContain("primary-btn");
  expect(html).toContain("secondary-btn");
  expect(html).not.toContain("Impressions");
  expect(html).not.toContain("sample post");
});

test("real drafts and scheduled posts route to their own channel and variant", () => {
  const data = {
    ...empty,
    accounts: [
      {
        id: "account",
        platform: "threads",
        display_name: "Writer",
        status: "active",
      },
    ],
    counts: { ...empty.counts, drafts: 1, scheduled: 1 },
    drafts: [post],
    upcoming: [
      { ...post, status: "scheduled", scheduled_time: "2026-10-09T10:00:00Z" },
    ],
  };
  const html = renderToStaticMarkup(
    <HomeOverview data={data} timeZone="Asia/Kolkata" />,
  );
  expect(html).toContain("A real draft from this workspace");
  expect(html).toContain(
    'href="/dashboard/content?post=post&amp;variant=variant&amp;account=account"',
  );
  expect(html).toContain('href="/dashboard/content?new=1&amp;account=account"');
  expect(html).toContain("Asia/Kolkata");
  expect(html).not.toContain("Finish setting up");
  expect(html).toContain('href="#continue-writing"');
  expect(html).toContain('href="#upcoming-posts"');
});

test("failed posts and reconnects remain actionable without confusing disabled channels", () => {
  const data = {
    ...empty,
    counts: { ...empty.counts, failed: 2 },
    accounts: [
      {
        id: "reauth",
        platform: "x",
        display_name: "Expired writer",
        status: "needs_reauth",
      },
      {
        id: "disabled",
        platform: "x",
        display_name: "Disabled writer",
        status: "disabled",
      },
    ],
    failed: [
      {
        ...post,
        status: "failed",
        last_error: "Please reconnect before publishing",
      },
    ],
  };
  const html = renderToStaticMarkup(<HomeOverview data={data} />);
  expect(html).toContain("Reconnect your channel");
  expect(html).toContain("Expired writer");
  expect(html).not.toContain("Disabled writer");
  expect(html).toContain("Reconnect this channel before trying again");
  expect(html).toContain("1 more post needs review");
  expect(html).not.toContain("You’re all caught up");
});

test("read-only members can browse without draft-creation actions", () => {
  const data = { ...empty, can_edit: false, can_manage_channels: false };
  const html = renderToStaticMarkup(<HomeOverview data={data} />);
  expect(html).toContain("View content");
  expect(html).toContain("view access");
  expect(html).not.toContain("?new=1");
  expect(html).not.toContain("Start a draft");
  expect(homeSetup(data)[1].href).toBe("/dashboard/content");
});

test("unassigned drafts, missing dates, in-flight and overdue schedules have honest labels", () => {
  expect(homePostTime(post, empty.fetched_at, "UTC")).toBe("Oct 8 · 9:00 AM");
  expect(homePostTime(post, empty.fetched_at, "Asia/Kolkata")).toBe(
    "Oct 8 · 2:30 PM",
  );
  expect(
    homeFailureMessage({
      ...post,
      last_error: 'X API error (HTTP 402): {"detail":"credits depleted"}',
    }),
  ).toContain("credits have run out");
  expect(
    homeFailureMessage({
      ...post,
      last_error: 'HTTP 500: {"stack":"private error trace"}',
    }),
  ).not.toContain("private error trace");
  expect(
    homePostLink({ ...post, variant_id: null, connected_account_id: null }),
  ).toBe("/dashboard/content?post=post");
  expect(
    homePostTime({ ...post, status: "publishing" }, empty.fetched_at, "UTC"),
  ).toBe("Publishing now");
  expect(
    homePostTime({ ...post, status: "scheduled" }, empty.fetched_at, "UTC"),
  ).toBe("Time not set");
  expect(
    homePostTime(
      { ...post, status: "scheduled", scheduled_time: "2026-10-08T09:00:00Z" },
      empty.fetched_at,
      "UTC",
    ),
  ).toContain("Overdue");
  const html = renderToStaticMarkup(
    <HomeOverview
      data={{
        ...empty,
        accounts: [
          {
            id: "account",
            platform: "threads",
            display_name: "Writer",
            status: "active",
          },
        ],
        drafts: [
          { ...post, connected_account_id: null, platform: null, text: "" },
        ],
      }}
    />,
  );
  expect(html).toContain("Unassigned draft");
  expect(html).toContain("A blank page");
});

test("skeleton and failed refresh never pretend to be an empty workspace", () => {
  const skeleton = renderToStaticMarkup(<HomeSkeleton />);
  expect(skeleton).toContain('role="status"');
  expect(skeleton).toContain("Loading your workspace home");
  expect(skeleton).not.toContain("0 of 3");
  const html = renderToStaticMarkup(
    <HomeOverview
      data={{
        ...empty,
        accounts: [
          {
            id: "account",
            platform: "threads",
            display_name: "Writer",
            status: "active",
          },
        ],
        drafts: [post],
      }}
      refreshError
      refreshing
    />,
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("last loaded overview");
  expect(html).toContain("A real draft from this workspace");
  expect(html).toContain("Refreshing");
});

test("the circular AI card reports real usage and handles unlimited and zero allowances", () => {
  const usage = empty.usage;
  let html = renderToStaticMarkup(
    <HomeAiUsageCard
      usage={{ ...usage, ai_credits: { used: 17, limit: 20, remaining: 3 } }}
    />,
  );
  expect(html).toContain('aria-valuenow="85"');
  expect(html).toContain('aria-valuetext="17 of 20 credits used"');
  expect(html).toContain("17 / 20 used");
  expect(html).toContain("Nov 1, 2026");
  html = renderToStaticMarkup(
    <HomeAiUsageCard
      usage={{
        ...usage,
        ai_credits: { used: 120, limit: null, remaining: null },
      }}
    />,
  );
  expect(html).toContain("Unlimited");
  expect(html).toContain("120 credits used");
  expect(html).not.toContain('role="progressbar"');
  html = renderToStaticMarkup(
    <HomeAiUsageCard
      usage={{ ...usage, ai_credits: { used: 0, limit: 0, remaining: 0 } }}
    />,
  );
  expect(html).toContain('aria-valuenow="100"');
  expect(html).toContain("AI allowance used up");
  expect(html).not.toContain("NaN");
});

test("Home discovery cards respect account state and member permissions", () => {
  let html = renderToStaticMarkup(
    <HomeOverview
      data={{
        ...empty,
        counts: { ...empty.counts, drafts: 2 },
        drafts: [post],
        accounts: [
          {
            id: "disabled",
            platform: "x",
            display_name: "Disabled",
            status: "disabled",
          },
        ],
      }}
    />,
  );
  expect(html).toContain("Connect your first channel");
  expect(html).toContain("View 2 drafts");
  expect(html).not.toContain("Continue writing");
  expect(html).toContain("Explore analytics");
  expect(html).not.toContain("Open analytics");
  html = renderToStaticMarkup(
    <HomeOverview
      data={{ ...empty, can_edit: false, can_manage_channels: false }}
    />,
  );
  expect(html).toContain("Ask a workspace owner or admin");
  expect(html).toContain("View channels");
  expect(html).not.toContain("Connect a channel</a>");
  expect(html).not.toContain("Start writing");
  html = renderToStaticMarkup(
    <HomeOverview
      data={{
        ...empty,
        accounts: [
          {
            id: "account",
            platform: "x",
            display_name: "Writer",
            status: "needs_reauth",
          },
        ],
        drafts: [post],
      }}
    />,
  );
  expect(html).toContain("Continue writing");
  expect(html).toContain("Reconnect your channel");
  expect(html).toContain("Open analytics");
  expect(html).toContain('href="/dashboard/analytics"');
  expect(html).not.toContain("Connect your first channel");
  expect(html).not.toContain("See how your posts are doing");
});
