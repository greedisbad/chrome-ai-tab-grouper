import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyExtension } from "../scripts/verify-extension.mjs";

test("verifyExtension accepts the repository extension", async () => {
  const result = await verifyExtension(new URL("..", import.meta.url));
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("verifyExtension reports missing referenced files", async () => {
  const fake = {
    manifest_version: 3,
    minimum_chrome_version: "114",
    permissions: ["tabs", "tabGroups", "storage", "sidePanel"],
    background: { service_worker: "missing.js" },
    side_panel: { default_path: "missing.html" }
  };
  const result = await verifyExtension(new URL("..", import.meta.url), fake);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /missing/);
});

test("module service worker does not use dynamic import", async () => {
  const source = await readFile(new URL("../src/background/service-worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bimport\s*\(/, "Chrome ServiceWorkerGlobalScope 禁止动态 import()；请使用顶层静态导入");
});

test("saving model settings does not clear the visible API key", async () => {
  const source = await readFile(new URL("../src/panel/panel.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /form\.apiKey\.value\s*=\s*["']{2}/, "保存设置后不应立即清空用户正在查看的 API Key");
});
