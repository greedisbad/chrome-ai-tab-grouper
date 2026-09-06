import test from "node:test";
import assert from "node:assert/strict";
import { completeJson, streamJson } from "../src/ai/openai-client.js";

test("completeJson posts to the compatible chat completions endpoint", async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
  };
  const content = await completeJson({ baseUrl: "https://api.deepseek.com", apiKey: "secret", model: "deepseek-v4-flash" }, [{ role: "user", content: "hi" }], fetchImpl);
  assert.equal(request.url, "https://api.deepseek.com/chat/completions");
  assert.equal(content, '{"ok":true}');
  assert.match(request.options.headers.Authorization, /^Bearer /);
});

test("completeJson redacts server errors", async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => "secret details" });
  await assert.rejects(() => completeJson({ baseUrl: "https://api.deepseek.com", apiKey: "key", model: "m" }, [], fetchImpl), /401/);
});

test("streamJson disables DeepSeek thinking by default and streams content", async () => {
  let payload;
  const events = [];
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"groups\\":"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"[]}"}}]}\n\n',
    "data: [DONE]\n\n"
  ];
  const fetchImpl = async (_url, options) => {
    payload = JSON.parse(options.body);
    return { ok: true, body: new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(new TextEncoder().encode(chunk))); controller.close(); } }) };
  };
  const content = await streamJson({ baseUrl: "https://api.deepseek.com", apiKey: "key", model: "deepseek-v4-flash" }, [], event => events.push(event), fetchImpl);
  assert.deepEqual(payload.thinking, { type: "disabled" });
  assert.equal(payload.stream, true);
  assert.equal(content, '{"groups":[]}');
  assert.equal(events.filter(event => event.type === "content").length, 2);
});

test("streamJson exposes reasoning chunks when thinking is enabled", async () => {
  let payload;
  const events = [];
  const fetchImpl = async (_url, options) => {
    payload = JSON.parse(options.body);
    const text = 'data: {"choices":[{"delta":{"reasoning_content":"按项目识别","content":null}}]}\n\ndata: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n';
    return { ok: true, body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } }) };
  };
  await streamJson({ baseUrl: "https://api.deepseek.com", apiKey: "key", model: "deepseek-v4-flash", thinkingEnabled: true }, [], event => events.push(event), fetchImpl);
  assert.deepEqual(payload.thinking, { type: "enabled" });
  assert.equal(payload.reasoning_effort, "low");
  assert.equal(events.find(event => event.type === "reasoning").text, "按项目识别");
});
