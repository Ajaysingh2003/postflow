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
  getAuthHeaders: async () => ({
    Authorization: "Bearer test-only-token",
    "X-Workspace-ID": "workspace",
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
