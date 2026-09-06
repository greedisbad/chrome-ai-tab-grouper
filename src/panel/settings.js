import { migrateModelConfig, normalizeBaseUrl } from "../ai/config.js";

export async function loadSettings(form) {
  const local = await chrome.storage.local.get(["modelConfig", "rememberedApiKey"]);
  const savedConfig = local.modelConfig || {};
  const config = migrateModelConfig(savedConfig);
  if (config !== savedConfig) await chrome.storage.local.set({ modelConfig: config });
  form.baseUrl.value = config.baseUrl || "https://api.deepseek.com";
  form.model.value = config.model || "deepseek-v4-flash";
  form.preference.value = config.preference || "";
  form.thinkingEnabled.checked = Boolean(config.thinkingEnabled);
  form.rememberKey.checked = Boolean(local.rememberedApiKey);
  form.apiKey.value = "";
}

export async function saveSettings(form) {
  const baseUrl = normalizeBaseUrl(form.baseUrl.value);
  const origin = `${new URL(baseUrl).origin}/*`;
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) throw new Error("需要允许访问模型接口地址");
  const modelConfig = { baseUrl, model: form.model.value.trim(), preference: form.preference.value.trim(), thinkingEnabled: form.thinkingEnabled.checked };
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
