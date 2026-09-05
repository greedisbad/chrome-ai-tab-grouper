import { validateModelConfig } from "./config.js";

export async function completeJson(config, messages, fetchImpl = fetch) {
  const checked = validateModelConfig(config);
  if (!checked.ok) throw new Error(checked.error);
  const { baseUrl, apiKey, model } = checked.value;
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model, messages, temperature: 0.2, response_format: { type: "json_object" } })
    });
  } catch { throw new Error("无法连接模型服务"); }
  if (!response.ok) throw new Error(`模型服务请求失败（HTTP ${response.status}）`);
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("模型服务返回内容为空");
  return content;
}
