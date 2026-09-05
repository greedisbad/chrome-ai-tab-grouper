import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBaseUrl, validateModelConfig } from "../src/ai/config.js";

test("normalizeBaseUrl accepts DeepSeek and localhost", () => {
  assert.equal(normalizeBaseUrl("https://api.deepseek.com/"), "https://api.deepseek.com");
  assert.equal(normalizeBaseUrl("http://localhost:11434/v1/"), "http://localhost:11434/v1");
});

test("normalizeBaseUrl rejects insecure remote endpoints", () => {
  assert.throws(() => normalizeBaseUrl("http://example.com/v1"), /HTTPS/);
});

test("validateModelConfig requires a model and remote API key", () => {
  assert.equal(validateModelConfig({ baseUrl: "https://api.deepseek.com", model: "", apiKey: "x" }).ok, false);
  assert.equal(validateModelConfig({ baseUrl: "https://api.deepseek.com", model: "deepseek-chat", apiKey: "" }).ok, false);
  assert.equal(validateModelConfig({ baseUrl: "http://localhost:11434/v1", model: "qwen", apiKey: "" }).ok, true);
});
