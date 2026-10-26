import { describe, test, expect } from "bun:test";
import { fileType, validatePostAsset, uploadAsset } from "../src/modules/content/assets";

async function withStorage(check, overrides = {}) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (options.signal?.aborted) throw options.signal.reason;
    if (url === "/api/media/uploads") {
      if (overrides.start) return overrides.start(options);
      return Response.json(overrides.ticket ?? {
        asset_id: "asset", method: "PUT", upload_url: "https://r2.example.invalid/signed",
        headers: { "Content-Type": "image/png", "x-amz-meta-purpose": "post" },
      }, { status: overrides.ticketStatus ?? 201 });
    }
    if (url === "https://r2.example.invalid/signed") {
      if (overrides.put) return overrides.put(options);
      return new Response(null, { status: overrides.putStatus ?? 200 });
    }
    expect(url).toBe("/api/media/uploads/asset/complete");
    if (overrides.complete) return overrides.complete(options);
    return Response.json(overrides.ready ?? {
      id: "asset", status: "ready", original_filename: "photo.png", content_type: "image/png", actual_size: 5,
    }, { status: overrides.readyStatus ?? 200 });
  };
  try { await check(calls); }
  finally { globalThis.fetch = original; }
}
const photo = () => new File(["image"], "photo.PNG");

describe("shared editor direct uploads", () => {
  test("recovers missing browser MIME types and validates channel formats", () => {
    const file = photo();
    expect(fileType(file)).toBe("image/png");
    expect(() => validatePostAsset(file, ["image/png"])).not.toThrow();
    expect(() => validatePostAsset(file, ["image/jpeg"])).toThrow("supported by this channel");
    expect(() => validatePostAsset(new File([], "empty.png"), ["image/png"])).toThrow("empty");
  });
  test("only metadata reaches Next.js, raw file bytes go to R2, then verification must complete", async () => {
    await withStorage(async (calls) => {
      const stages = [];
      const file = photo();
      expect((await uploadAsset(file, "post", (stage) => stages.push(stage))).asset_id).toBe("asset");
      expect(calls.map((c) => c.options.method)).toEqual(["POST", "PUT", "POST"]);
      expect(JSON.parse(calls[0].options.body)).toEqual({ filename: "photo.PNG", content_type: "image/png", size: 5, purpose: "post" });
      expect(calls[1].options.body).toBe(file);
      expect(calls[1].options.credentials).toBe("omit");
      expect(calls[1].options.headers).toEqual({ "Content-Type": "image/png", "x-amz-meta-purpose": "post" });
      expect(calls[2].options.body).toBe("{}");
      expect(stages).toEqual(["uploading", "verifying"]);
    });
  });
  test("files above Vercel's limit never enter a function request body", async () => {
    await withStorage(async (calls) => {
      const file = new File([new Uint8Array(5 * 1024 * 1024)], "video.mp4", { type: "video/mp4" });
      await uploadAsset(file, "post");
      expect(calls[1].options.body.size).toBe(file.size);
      expect(calls[0].options.body.length).toBeLessThan(1024);
      expect(calls[2].options.body.length).toBeLessThan(1024);
    });
  });
  test("AI sources use their own type and purpose and remain limited to 20 MB", async () => {
    await withStorage(async (calls) => {
      await uploadAsset(new File(["notes"], "source.txt"), "assistant");
      expect(JSON.parse(calls[0].options.body).purpose).toBe("assistant");
      expect(JSON.parse(calls[0].options.body).content_type).toBe("text/plain");
      await expect(uploadAsset(new File([new Uint8Array(21 * 1024 * 1024)], "source.mp4"), "assistant")).rejects.toThrow("20 MB");
      expect(calls).toHaveLength(3);
    });
  });
  test("unverified or rejected completion never yields an attachment", async () => {
    await withStorage(async () => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow("verified");
    }, { ready: { status: "uploading" } });
    await withStorage(async () => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow("Storage temporarily unavailable");
    }, { readyStatus: 503, ready: { detail: "Storage temporarily unavailable" } });
  });
  test("quota denial stops before uploading, and failed PUT never starts completion", async () => {
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow("Storage full");
      expect(calls).toHaveLength(1);
    }, { ticketStatus: 413, ticket: { detail: "Storage full" } });
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow("file storage");
      expect(calls).toHaveLength(2);
    }, { putStatus: 403 });
  });
  test("cancellation and CORS/network failure never start verification", async () => {
    const controller = new AbortController();
    controller.abort();
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post", undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(calls).toHaveLength(1);
    });
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow("could not be reached");
      expect(calls).toHaveLength(2);
    }, { put: () => { throw new TypeError("Failed to fetch"); } });
  });
  test.each([
    ["start", "The upload service could not be reached", 1],
    ["put", "File storage could not be reached", 2],
    ["complete", "verification could not be reached", 3],
  ])("Safari Load failed identifies the %s step without exposing signed URLs", async (step, message, count) => {
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post")).rejects.toThrow(message);
      expect(calls).toHaveLength(count);
    }, { [step]: () => { throw new TypeError("Load failed"); } });
  });
  test("storage cancellation during transfer remains cancellation instead of a network error", async () => {
    const controller = new AbortController();
    await withStorage(async (calls) => {
      await expect(uploadAsset(photo(), "post", undefined, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
      expect(calls).toHaveLength(2);
    }, { put: () => { controller.abort(); throw new TypeError("Load failed"); } });
  });
});
