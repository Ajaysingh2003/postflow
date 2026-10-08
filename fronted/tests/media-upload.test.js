import {describe, test, expect} from "bun:test";
import {fileType, validatePostAsset, uploadAsset} from "../src/modules/content/assets";

describe("shared editor uploads", () => {
  test("recovers missing browser MIME types and validates the channel's formats", () => {
    const file = new File(["image"], "photo.PNG", {type: ""});
    expect(fileType(file)).toBe("image/png");
    expect(() => validatePostAsset(file, ["image/png"])).not.toThrow();
    expect(() => validatePostAsset(file, ["image/jpeg"])).toThrow("supported by this channel");
    expect(() => validatePostAsset(new File([], "empty.png"), ["image/png"])).toThrow("empty");
  });
  test("only verified uploads can be attached, and API errors remain visible", async () => {
    const original = globalThis.XMLHttpRequest;
    let response = {id: "asset", status: "ready", original_filename: "photo.png", content_type: "image/png", actual_size: 5};
    let code = 201;
    let form;
    globalThis.XMLHttpRequest = class {
      upload = {};
      open(method, url) { expect(method).toBe("POST"); expect(url).toBe("/api/media/attachments"); }
      send(body) { form = body; this.upload.onload(); this.status = code; this.responseText = JSON.stringify(response); this.onload(); }
    };
    try {
      const stages = [];
      const file = new File(["image"], "photo.png");
      expect((await uploadAsset(file, "post", (stage) => stages.push(stage))).asset_id).toBe("asset");
      expect(form.get("content_type")).toBe("image/png");
      expect(stages).toEqual(["uploading", "scanning"]);
      response = {...response, status: "scanning"};
      await expect(uploadAsset(file, "post")).rejects.toThrow("verified");
      code = 503; response = {detail: "Storage unavailable"};
      await expect(uploadAsset(file, "post")).rejects.toThrow("Storage unavailable");
    } finally { globalThis.XMLHttpRequest = original; }
  });
});
