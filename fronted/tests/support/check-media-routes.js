import assert from "node:assert/strict";
import { mock } from "bun:test";
let signedIn = true;
mock.module("../../src/lib/http-error", () => ({
  getApiBase: () => "http://backend.test/api",
  getAuthHeaders: async () => signedIn ? { Authorization: "Bearer private-session", "X-Workspace-Id": "workspace" } : {},
}));
const { POST, GET } = await import("../../src/app/api/media/[...path]/route");
let calls = [];
let result = { asset_id: "asset", upload_url: "https://r2.example.invalid/signed", method: "PUT" };
let status = 201;
globalThis.fetch = async (url, options) => {
  calls.push({ url, options });
  return Response.json(result, { status });
};
function post(path, body = "{}", headers = {}) {
  return POST(new Request(`http://app.test/api/media/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://app.test", ...headers }, body,
  }), { params: Promise.resolve({ path: path.split("/") }) });
}
let response = await post("uploads", JSON.stringify({ filename: "video.mp4", size: 104857600, content_type: "video/mp4", purpose: "post" }));
assert.equal(response.status, 201);
assert.equal(calls[0].url, "http://backend.test/api/v1/media/uploads");
assert.equal(calls[0].options.headers.Authorization, "Bearer private-session");
assert.equal(calls[0].options.headers["X-Workspace-Id"], "workspace");
assert.equal(response.headers.get("cache-control"), "private, no-store");
assert.ok(calls[0].options.body.length < 4096);
assert.ok(!(await response.text()).includes("private-session"));
result = { id: "asset", status: "ready" }; status = 200;
response = await post("uploads/asset/complete");
assert.equal(response.status, 200);
assert.equal(calls.at(-1).url, "http://backend.test/api/v1/media/uploads/asset/complete");
let before = calls.length;
assert.equal((await post("uploads", "{}", { Origin: "https://evil.test" })).status, 403);
assert.equal((await post("attachments", "file bytes")).status, 404);
assert.equal((await post("uploads", "x".repeat(4097))).status, 422);
assert.equal((await post("uploads", "bad json")).status, 422);
assert.equal((await post("uploads", "{}", { "Content-Type": "multipart/form-data" })).status, 422);
signedIn = false;
assert.equal((await post("uploads")).status, 401);
assert.equal(calls.length, before);
signedIn = true;
result = { detail: "Malware scanner is unavailable" }; status = 503;
response = await post("uploads/asset/complete");
assert.equal(response.status, 503);
assert.equal((await response.json()).detail, result.detail);
const read = () => GET(new Request("http://app.test/api/media/asset/content"), { params: Promise.resolve({ path: ["asset", "content"] }) });
result = { download_url: "https://r2.example.invalid/signed-download" }; status = 200;
response = await read();
assert.equal(response.status, 307);
assert.equal(response.headers.get("location"), result.download_url);
assert.equal(await response.text(), "");
assert.equal(calls.at(-1).url, "http://backend.test/api/v1/media/asset/download");
result = { detail: "Media asset is not ready" }; status = 409;
assert.equal((await read()).status, 409);
console.log("Media route checks passed");
