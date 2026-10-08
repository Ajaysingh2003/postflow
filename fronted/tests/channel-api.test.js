import { afterEach, describe, expect, mock, test, spyOn } from "bun:test";
import axios from "axios";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();
mock.module("../src/trpc/init", () => ({
  authedProcedure: t.procedure,
  createTRPCRouter: t.router,
}));
mock.module("../src/lib/http-error", () => ({
  getApiBase: () => "http://backend.test",
  getAuthHeaders: async (_, workspaceId) => ({
    Authorization: "Bearer test-only-token",
    "X-Workspace-ID": workspaceId ?? "workspace",
  }),
  handleBackendError: (error) => {
    throw error;
  },
}));
const { studioRouter } = await import("../src/modules/studio/server");
const caller = studioRouter.createCaller({});
const accountId = "00000000-0000-4000-8000-000000000002";
let request;
afterEach(() => request?.mockRestore());

describe("social account API wiring", () => {
  test("preloads one workspace Home summary with explicit workspace headers", async () => {
    const data = {workspace_id: accountId, counts: {}, drafts: [], upcoming: [], published: [], failed: [], accounts: []};
    request = spyOn(axios, "request").mockResolvedValue({data});
    expect(await caller.home({workspace_id: accountId})).toEqual(data);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET", url: "http://backend.test/v1/posts/home",
      headers: {Authorization: "Bearer test-only-token", "X-Workspace-ID": accountId},
    }));
  });
  test("loads Postflow posts and counts with one bounded library request", async () => {
    const data = {items: [], counts: {posts: 0, scheduled: 1, drafts: 2}, total: 0, next_offset: null};
    request = spyOn(axios, "request").mockResolvedValue({data});
    expect(await caller.postLibrary({connected_account_id: accountId, category: "posts", offset: 50})).toEqual(data);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: "http://backend.test/v1/posts/library",
      params: {connected_account_id: accountId, category: "posts", offset: 50, limit: 50},
    }));
  });
  test("fetches reply pages and saved-post counts scoped to the selected account", async () => {
    request = spyOn(axios, "request").mockResolvedValue({data: {}});
    await caller.postSummary({connected_account_id: accountId});
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({url: "http://backend.test/v1/posts/summary", params: {connected_account_id: accountId}}));
    await caller.analyticsDashboard({account_id: accountId, content_type: "replies", offset: 50});
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({params: {account_id: accountId, content_type: "replies", offset: 50, limit: 50}}));
  });
  test("requests one fresh dashboard for the selected account, interval and page", async () => {
    const data = { account_id: accountId, accounts: [], overview: {}, posts: [] };
    request = spyOn(axios, "request").mockResolvedValue({ data });
    const input = { account_id: accountId, start_date: "2026-10-01T00:00:00Z", end_date: "2026-10-07T23:59:59Z", limit: 50, offset: 100, content_type: "posts" };
    expect(await caller.analyticsDashboard(input)).toEqual(data);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "http://backend.test/v1/analytics/dashboard", params: input }));
  });

  test("analytics returns account-native posts without filtering for a saved Postflow id", async () => {
    const native = {post_id: null, variant_id: "external:native", text: "Published in the native app"};
    const data = {account_id: accountId, posts: [native], feed_total: 1};
    request = spyOn(axios, "request").mockResolvedValue({data});
    expect((await caller.analyticsDashboard({account_id: accountId, content_type: "posts"})).posts).toEqual([native]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({url: "http://backend.test/v1/analytics/dashboard", params: {account_id: accountId, content_type: "posts", offset: 0, limit: 50}}));
  });

  test("loads dated calendar entries with the requested interval and pagination", async () => {
    request = spyOn(axios, "request").mockResolvedValue({ data: { items: [], next_cursor: null } });
    const period = { start: "2026-10-05T00:00:00.000Z", end: "2026-10-12T00:00:00.000Z", cursor: 200 };
    expect(await caller.calendar(period)).toEqual({ items: [], next_cursor: null });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "http://backend.test/v1/publishing/calendar", params: period }));
  });
  test("keeps destination identity, media and retry key when creating another version", async () => {
    request = spyOn(axios, "request").mockResolvedValue({ data: { id: accountId } });
    const input = { post_id: accountId, platform: "instagram", connected_account_id: accountId, payload: { caption: "Instagram version" }, media_asset_ids: [accountId], idempotency_key: `crosspost:${accountId}:${accountId}` };
    await caller.addVariant(input);
    const { post_id: ignored, ...data } = input;
    expect(ignored).toBe(accountId);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: `http://backend.test/v1/posts/${accountId}/variants`, data }));
    await caller.schedule({ id: accountId, scheduled_time: "2026-10-05T09:30:00.000Z" });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST", url: `http://backend.test/v1/publishing/variants/${accountId}/schedule`, data: { scheduled_time: "2026-10-05T09:30:00.000Z" } }));
    await caller.cancel({ id: accountId });
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ method: "POST", url: `http://backend.test/v1/publishing/variants/${accountId}/cancel` }));
  });
  test("saves draft media and payload through the same variant endpoint", async () => {
    request = spyOn(axios, "request").mockResolvedValue({
      data: { id: accountId },
    });
    await caller.editDraft({
      id: accountId,
      payload: { thread: [{ text: "First" }, { text: "Second" }] },
      media_asset_ids: [accountId],
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PATCH",
        url: `http://backend.test/v1/variants/${accountId}`,
        data: {
          payload: { thread: [{ text: "First" }, { text: "Second" }] },
          media_asset_ids: [accountId],
        },
      }),
    );
  });
  test("uses the chosen account, community and writing preferences for assistant validation", async () => {
    request = spyOn(axios, "request").mockResolvedValue({
      data: { output: { body: "A useful post" }, validation_issues: [] },
    });
    await caller.runFeature({
      feature: "reddit_subreddit_rewrite",
      platform: "reddit",
      input_data: { draft: "A draft", subreddit: "python" },
      connected_account_id: accountId,
      validation_context: { subreddit: "python", flair_id: "help" },
      writing_instructions: "Use plain language",
      output_language: "Hindi",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          connected_account_id: accountId,
          validation_context: { subreddit: "python", flair_id: "help" },
          writing_instructions: "Use plain language",
          output_language: "Hindi",
        }),
      }),
    );
  });
  test("loads account-specific capabilities and validates a saved variant before publishing", async () => {
    request = spyOn(axios, "request").mockResolvedValue({
      data: { is_valid: false, issues: [] },
    });
    await caller.accountCapabilities({ id: accountId });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "GET",
        url: `http://backend.test/v1/channels/accounts/${accountId}/capabilities`,
      }),
    );
    await caller.validate({ id: accountId });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: "POST",
        url: `http://backend.test/v1/publishing/variants/${accountId}/validate`,
      }),
    );
  });
  test("filters post history by the selected account and requested statuses", async () => {
    request = spyOn(axios, "request").mockResolvedValue({ data: [] });
    await caller.posts({
      connected_account_id: accountId,
      status: "draft,failed",
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          offset: 0,
          limit: 100,
          variant_status: "draft,failed",
          connected_account_id: accountId,
        },
      }),
    );
  });
  test("refreshes the selected account through the existing backend endpoint", async () => {
    const account = {
      id: accountId,
      platform: "x",
      status: "active",
      display_name: "Studio",
    };
    request = spyOn(axios, "request").mockResolvedValue({ data: account });
    expect(await caller.refreshAccount({ id: accountId })).toEqual(account);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: `http://backend.test/v1/channels/accounts/${accountId}/refresh`,
        data: {},
        headers: {
          Authorization: "Bearer test-only-token",
          "X-Workspace-ID": "workspace",
        },
      }),
    );
  });
  test("disconnects exactly the requested account", async () => {
    request = spyOn(axios, "request").mockResolvedValue({
      data: { status: "disconnected", account_id: accountId },
    });
    await caller.disconnect({ id: accountId });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: `http://backend.test/v1/channels/accounts/${accountId}/disconnect`,
      }),
    );
  });
  test("forwards provider discovery options for official OAuth", async () => {
    request = spyOn(axios, "request").mockResolvedValue({
      data: { auth_url: "https://oauth.provider.test" },
    });
    await caller.connect({
      platform: "bluesky",
      options: { identifier: "studio.bsky.social" },
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "http://backend.test/v1/channels/bluesky/connect",
        data: { options: { identifier: "studio.bsky.social" } },
      }),
    );
  });
  test("propagates provider failure rather than reporting a successful refresh", async () => {
    request = spyOn(axios, "request").mockRejectedValue(
      new Error("Provider unavailable"),
    );
    await expect(caller.refreshAccount({ id: accountId })).rejects.toThrow(
      "Provider unavailable",
    );
  });
  test("rejects invalid account IDs before calling the backend", async () => {
    request = spyOn(axios, "request");
    await expect(caller.refreshAccount({ id: "bad/id" })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
