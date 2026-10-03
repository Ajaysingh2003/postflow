import { afterEach, describe, expect, mock, test, spyOn } from "bun:test";
import axios from "axios";
import { initTRPC } from "@trpc/server";

const t = initTRPC.create();
mock.module("../src/trpc/init", () => ({ authedProcedure: t.procedure, createTRPCRouter: t.router }));
mock.module("../src/lib/http-error", () => ({
  getApiBase: () => "http://backend.test",
  getAuthHeaders: async () => ({ Authorization: "Bearer test-only-token", "X-Workspace-ID": "workspace" }),
  handleBackendError: (error) => { throw error; },
}));
const { studioRouter } = await import("../src/modules/studio/server");
const caller = studioRouter.createCaller({});
const accountId = "00000000-0000-4000-8000-000000000002";
let request;
afterEach(() => request?.mockRestore());

describe("social account API wiring", () => {
  test("refreshes the selected account through the existing backend endpoint", async () => {
    const account = { id: accountId, platform: "x", status: "active", display_name: "Studio" };
    request = spyOn(axios, "request").mockResolvedValue({ data: account });
    expect(await caller.refreshAccount({ id: accountId })).toEqual(account);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", url: `http://backend.test/v1/channels/accounts/${accountId}/refresh`, data: {},
      headers: { Authorization: "Bearer test-only-token", "X-Workspace-ID": "workspace" },
    }));
  });
  test("disconnects exactly the requested account", async () => {
    request = spyOn(axios, "request").mockResolvedValue({ data: { status: "disconnected", account_id: accountId } });
    await caller.disconnect({ id: accountId });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: `http://backend.test/v1/channels/accounts/${accountId}/disconnect` }));
  });
  test("forwards provider discovery options for official OAuth", async () => {
    request = spyOn(axios, "request").mockResolvedValue({ data: { auth_url: "https://oauth.provider.test" } });
    await caller.connect({ platform: "bluesky", options: { identifier: "studio.bsky.social" } });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: "POST", url: "http://backend.test/v1/channels/bluesky/connect", data: { options: { identifier: "studio.bsky.social" } } }));
  });
  test("propagates provider failure rather than reporting a successful refresh", async () => {
    request = spyOn(axios, "request").mockRejectedValue(new Error("Provider unavailable"));
    await expect(caller.refreshAccount({ id: accountId })).rejects.toThrow("Provider unavailable");
  });
  test("rejects invalid account IDs before calling the backend", async () => {
    request = spyOn(axios, "request");
    await expect(caller.refreshAccount({ id: "bad/id" })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
