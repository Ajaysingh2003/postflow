import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("media routes relay only bounded metadata, protect sessions, and redirect verified previews", () => {
  const result = Bun.spawnSync([process.execPath, fileURLToPath(new URL("./support/check-media-routes.js", import.meta.url))]);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("Media route checks passed");
});
