export function normalizeBaseUrl(value) {
  let url; try { url = new URL(value.trim()); } catch { throw new Error("请输入有效的 Base URL"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) throw new Error("远程模型地址必须使用 HTTPS");
  return url.href.replace(/\/$/, "");
}

export function migrateModelConfig(config = {}) {
  let isDeepSeek = false;
  try { isDeepSeek = normalizeBaseUrl(config.baseUrl || "") === "https://api.deepseek.com"; } catch {}
  if (isDeepSeek && config.model === "deepseek-chat") return { ...config, model: "deepseek-v4-flash" };
  return config;
}

export function validateModelConfig(config) {
  try {
    const baseUrl = normalizeBaseUrl(config.baseUrl || "");
    if (!config.model?.trim()) return { ok: false, error: "请输入模型名称" };
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseUrl).hostname);
    if (!local && !config.apiKey?.trim()) return { ok: false, error: "请输入 API Key" };
    return { ok: true, value: { ...config, baseUrl, model: config.model.trim() } };
  } catch (error) { return { ok: false, error: error.message }; }
}
