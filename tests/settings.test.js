import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, settingsFingerprint } from "../src/panel/settings.js";

function form() {
  return {
    baseUrl: { value: "" }, model: { value: "" }, apiKey: { value: "" }, preference: { value: "" },
    rememberKey: { checked: false }, thinkingEnabled: { checked: false }, developerMode: { checked: false }
  };
}

test("loadSettings refills a session API key into the password field", async () => {
  globalThis.chrome = {
    storage: {
      local: { get: async () => ({ modelConfig: { baseUrl: "https://api.deepseek.com", model: "deepseek-v4-flash" } }), set: async () => {} },
      session: { get: async () => ({ sessionApiKey: "session-secret" }) }
    }
  };
  const target = form();
  await loadSettings(target);
  assert.equal(target.apiKey.value, "session-secret");
  assert.equal(target.thinkingEnabled.checked, true);
  delete globalThis.chrome;
});

test("settingsFingerprint changes when a setting is edited", () => {
  const target = form();
  const before = settingsFingerprint(target);
  target.preference.value = "尽可能去分组";
  assert.notEqual(settingsFingerprint(target), before);
});
