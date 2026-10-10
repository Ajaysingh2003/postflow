import { describe, test, expect } from "bun:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { analyticsPostUrl, currentDashboard, liveAnalyticsOptions } from "../src/modules/analytics/liveAnalytics";

test("account analytics retains native posts without a draftva record and opens their official permalink", () => {
  const native = {post_id: null, variant_id: "external:threads:native", platform: "threads", external_post_id: "native", external_url: "https://www.threads.com/@writer/post/Native"};
  const local = {post_id: "saved", variant_id: "local", platform: "x", external_post_id: "123"};
  const dashboard = {account_id: "account", posts: [native, local]};
  expect(currentDashboard(dashboard, "account", false, false).posts).toEqual([native, local]);
  expect(analyticsPostUrl(native)).toBe(native.external_url);
  expect(analyticsPostUrl(local)).toBe("https://x.com/i/status/123");
  expect(analyticsPostUrl({...native, external_url: "javascript:alert(1)"})).toBeNull();
  expect(analyticsPostUrl({...native, external_url: "https://secret@example.com"})).toBeNull();
});

describe("live analytics account switching", () => {
  test("hides previous data during refresh, errors, and a different selection", () => {
    const old = { account_id: "x-account", posts: [{ text: "X post" }] };
    expect(currentDashboard(old, "linkedin-account", false, false)).toBeNull();
    expect(currentDashboard(old, "x-account", true, false)).toBeNull();
    expect(currentDashboard(old, "x-account", false, true)).toBeNull();
    expect(currentDashboard(old, "x-account", false, false)).toBe(old);
  });

  test("an older response arriving late cannot replace the current account", async () => {
    const client = new QueryClient();
    let finishX;
    const xResponse = new Promise((resolve) => { finishX = resolve; });
    const observer = new QueryObserver(client, {
      ...liveAnalyticsOptions,
      queryKey: ["analytics", "x"],
      queryFn: () => xResponse,
    });
    const unsubscribe = observer.subscribe(() => {});
    observer.setOptions({
      ...liveAnalyticsOptions,
      queryKey: ["analytics", "linkedin"],
      queryFn: async () => ({ account_id: "linkedin", posts: [], unavailable: true }),
    });
    await observer.refetch();
    finishX({ account_id: "x", posts: [{ text: "Old X data" }] });
    await xResponse;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const current = observer.getCurrentResult();
    expect(currentDashboard(current.data, "linkedin", current.isFetching, current.isError)?.account_id).toBe("linkedin");
    unsubscribe();
    client.clear();
  });

  test("switching back to an account performs a fresh request", async () => {
    const client = new QueryClient();
    let calls = 0;
    const options = (account) => ({
      ...liveAnalyticsOptions,
      queryKey: ["analytics", account],
      queryFn: async () => ({ account_id: account, followers: ++calls }),
    });
    const observer = new QueryObserver(client, options("x"));
    const unsubscribe = observer.subscribe(() => {});
    await observer.refetch();
    observer.setOptions(options("linkedin"));
    await observer.refetch();
    observer.setOptions(options("x"));
    expect(currentDashboard(observer.getCurrentResult().data, "x", observer.getCurrentResult().isFetching, false)).toBeNull();
    await observer.refetch();
    expect(observer.getCurrentResult().data.account_id).toBe("x");
    expect(observer.getCurrentResult().data.followers).toBeGreaterThan(2);
    unsubscribe();
    client.clear();
  });
});

import { visiblePostMetrics, hasEngagementRate } from "../src/modules/analytics/liveAnalytics";

describe("available analytics metrics", () => {
  test("keeps real zero counts and removes unsupported Threads fields", () => {
    const posts = [{ metrics_status: "partial", available_metrics: ["views", "likes", "comments", "shares", "engagements"], views: 271, likes: 0, comments: 0, shares: 0, impressions: 0 }];
    expect(visiblePostMetrics(posts)).toEqual(["views", "likes", "comments", "shares"]);
    expect(hasEngagementRate(posts[0])).toBe(true);
  });
  test("failed metrics and zero exposure never create an engagement rate", () => {
    const post = { metrics_status: "unavailable", available_metrics: ["views", "engagements"], views: 271 };
    expect(visiblePostMetrics([post])).toEqual([]);
    expect(hasEngagementRate(post)).toBe(false);
    expect(hasEngagementRate({...post, metrics_status: "partial", views: 0})).toBe(false);
  });
  test("mixed accounts retain separate views and impressions columns", () => {
    expect(visiblePostMetrics([{available_metrics: ["views"]}, {available_metrics: ["impressions", "bookmarks"]}])).toEqual(["views", "impressions", "bookmarks"]);
  });
});
