import test from "node:test";
import assert from "node:assert/strict";
import { completeJson } from "../src/ai/openai-client.js";

test("completeJson posts to the compatible chat completions endpoint", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  const content = await completeJson({ baseUrl: "https://api.deepseek.com", apiKey: "secret", model: "deepseek-chat" }, [{ role: "user", content: "hi" }], fetchImpl);
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(content, '{"ok":true}');
  assert.match(request.options.headers.Authorization, /^Bearer /);
});

test("completeJson redacts server errors", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => "secret details" });
  await assert.rejects(() => completeJson({ baseUrl: "https://api.deepseek.com", apiKey: "key", model: "m" }, [], fetchImpl), /401/);
});
