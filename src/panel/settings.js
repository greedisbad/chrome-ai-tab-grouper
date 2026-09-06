import { migrateModelConfig, normalizeBaseUrl } from "../ai/config.js";

export async function loadSettings(form) {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(["modelConfig", "rememberedApiKey"]),
    chrome.storage.session.get("sessionApiKey")
  ]);
  const savedConfig = local.modelConfig || {};
  const config = migrateModelConfig(savedConfig);
  if (config !== savedConfig) await chrome.storage.local.set({ modelConfig: config });
  form.baseUrl.value = config.baseUrl || "https://api.deepseek.com";
  form.model.value = config.model || "deepseek-v4-flash";
  form.preference.value = config.preference || "";
  form.thinkingEnabled.checked = Boolean(config.thinkingEnabled);
  form.developerMode.checked = Boolean(config.developerMode);
  form.rememberKey.checked = Boolean(local.rememberedApiKey);
  form.apiKey.value = session.sessionApiKey || local.rememberedApiKey || "";
}

export function settingsFingerprint(form) {
  return JSON.stringify({
    baseUrl: form.baseUrl.value.trim(), model: form.model.value.trim(), apiKey: form.apiKey.value.trim(),
    preference: form.preference.value.trim(), rememberKey: form.rememberKey.checked,
    thinkingEnabled: form.thinkingEnabled.checked, developerMode: form.developerMode.checked
  });
}

export async function saveSettings(form) {
  const baseUrl = normalizeBaseUrl(form.baseUrl.value);
  const origin = `${new URL(baseUrl).origin}/*`;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error("需要允许访问模型接口地址");
  const modelConfig = { baseUrl, model: form.model.value.trim(), preference: form.preference.value.trim(), thinkingEnabled: form.thinkingEnabled.checked, developerMode: form.developerMode.checked };
  if (!modelConfig.model) throw new Error("请输入模型名称");
  await chrome.storage.local.set({ modelConfig });
  const apiKey = form.apiKey.value.trim();
  if (apiKey) {
    if (form.rememberKey.checked) {
      await chrome.storage.local.set({ rememberedApiKey: apiKey });
      await chrome.storage.session.remove("sessionApiKey");
    } else {
      await chrome.storage.session.set({ sessionApiKey: apiKey });
      await chrome.storage.local.remove("rememberedApiKey");
    }
  }
  return modelConfig;
}
