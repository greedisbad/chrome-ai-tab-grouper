import { readWorkspace, applyDraft } from "./chrome-workspace.js";
import { buildGroupingMessages, parseGroupingResponse } from "../ai/grouping.js";
import { completeJson } from "../ai/openai-client.js";

const undoSnapshots = new Map();
chrome.runtime.onInstalled.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }));
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }));

async function getPrivateConfig() {
  const local = await chrome.storage.local.get(["modelConfig", "rememberedApiKey"]);
  const session = await chrome.storage.session.get("sessionApiKey");
  return { ...(local.modelConfig || {}), apiKey: session.sessionApiKey || local.rememberedApiKey || "" };
}

async function handle(message) {
  if (message.type === "workspace:get") return { ok: true, snapshot: await readWorkspace(chrome, message.windowId) };
  if (message.type === "workspace:save") {
    const before = await readWorkspace(chrome, message.draft.windowId);
    undoSnapshots.set(before.windowId, before);
    return { ok: true, snapshot: await applyDraft(chrome, before, message.draft) };
  }
  if (message.type === "workspace:undo") {
    const before = undoSnapshots.get(message.windowId);
    if (!before) throw new Error("没有可撤销的整理记录");
    const current = await readWorkspace(chrome, message.windowId);
    const { snapshotToDraft } = await import("../domain/draft.js");
    return { ok: true, snapshot: await applyDraft(chrome, current, snapshotToDraft(before)) };
  }
  if (message.type === "workspace:ai-group") {
    const config = await getPrivateConfig();
    const text = await completeJson(config, buildGroupingMessages(message.draft, message.mode, config.preference));
    return { ok: true, draft: parseGroupingResponse(text, message.draft) };
  }
  if (message.type === "settings:test") {
    const config = await getPrivateConfig();
    await completeJson(config, [{ role: "user", content: "只返回 JSON：{\"ok\":true}" }]);
    return { ok: true, message: "模型连接成功" };
  }
  throw new Error("未知操作");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message || "操作失败" }));
  return true;
});
