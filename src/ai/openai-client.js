import { validateModelConfig } from "./config.js";

function requestBody(config, messages, stream = false) {
  const body = { model: config.model, messages, response_format: { type: "json_object" } };
  if (stream) body.stream = true;
  if (new URL(config.baseUrl).hostname === "api.deepseek.com") {
    const thinkingEnabled = config.thinkingEnabled !== false;
    body.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
    if (thinkingEnabled) body.reasoning_effort = "low";
    else body.temperature = 0.2;
  } else body.temperature = 0.2;
  return body;
}

async function modelFetch(config, messages, stream, fetchImpl) {
  const checked = validateModelConfig(config);
  if (!checked.ok) throw new Error(checked.error);
  const value = { ...config, ...checked.value };
  let response;
  try {
    response = await fetchImpl(`${value.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(value.apiKey ? { Authorization: `Bearer ${value.apiKey}` } : {}) },
      body: JSON.stringify(requestBody(value, messages, stream))
    });
  } catch { throw new Error("无法连接模型服务"); }
  if (!response.ok) throw new Error(`模型服务请求失败（HTTP ${response.status}）`);
  return response;
}

export async function completeJson(config, messages, fetchImpl = fetch) {
  const response = await modelFetch(config, messages, false, fetchImpl);
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("模型服务返回内容为空");
  return content;
}

export async function streamJson(config, messages, onEvent = () => {}, fetchImpl = fetch) {
  const response = await modelFetch(config, messages, true, fetchImpl);
  if (!response.body) throw new Error("模型服务不支持流式响应");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const consume = line => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk; try { chunk = JSON.parse(data); } catch { return; }
    const delta = chunk?.choices?.[0]?.delta || {};
    if (typeof delta.reasoning_content === "string" && delta.reasoning_content) onEvent({ type: "reasoning", text: delta.reasoning_content });
    if (typeof delta.content === "string" && delta.content) { content += delta.content; onEvent({ type: "content", text: delta.content }); }
  };
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : lines.pop();
    lines.forEach(consume);
    if (done) { if (buffer) consume(buffer); break; }
  }
  if (!content) throw new Error("模型服务返回内容为空");
  return content;
}
