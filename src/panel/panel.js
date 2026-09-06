import { createEditorState, moveTab, resetDraft, addGroup, removeGroup, renameGroup, setGroupColor, moveGroup } from "./editor-state.js";
import { loadSettings, saveSettings, settingsFingerprint } from "./settings.js";
import { getGroupColor, groupColorPaletteHtml } from "./group-colors.js";

const $ = selector => document.querySelector(selector);
let state;
let mode = "ungrouped";
let draggingTabId = null;
let aiTimer;
let aiHideTimer;
let aiDebugEnabled = false;
let savedSettingsFingerprint = "";

function toast(message, error = false) {
  const element = $("#toast"); element.textContent = message; element.style.background = error ? "#8f403b" : "#1f2d27"; element.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove("show"), 2200);
}
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "操作失败");
  return response;
}
function beginAiProgress() {
  clearTimeout(aiHideTimer); clearInterval(aiTimer);
  const panel = $("#aiProgress"); panel.classList.remove("hidden", "done", "error");
  $("#aiProgressBody").classList.add("hidden"); $("#aiProgressToggle").setAttribute("aria-expanded", "false");
  $("#aiStage").textContent = "正在准备"; $("#aiElapsed").textContent = "0s"; $("#aiReasoning").textContent = "等待模型返回…";
  aiDebugEnabled = false; $("#aiDebug").classList.add("hidden"); $("#aiDebug").open = false; $("#aiRaw").textContent = "";
  const started = Date.now();
  aiTimer = setInterval(() => { $("#aiElapsed").textContent = `${Math.floor((Date.now()-started)/1000)}s`; }, 1000);
}
function finishAiProgress(text, error = false) {
  clearInterval(aiTimer); $("#aiStage").textContent = text;
  $("#aiProgress").classList.add(error ? "error" : "done");
  aiHideTimer = setTimeout(() => { if ($("#aiProgressBody").classList.contains("hidden")) $("#aiProgress").classList.add("hidden"); }, 5000);
}
function runAiGrouping(draft, selectedMode) {
  beginAiProgress();
  return new Promise((resolve, reject) => {
    const port = chrome.runtime.connect({ name: "ai-grouping" });
    let settled = false;
    let hasReasoning = false;
    port.onMessage.addListener(message => {
      if (message.type === "debug") { aiDebugEnabled = message.enabled; $("#aiDebug").classList.toggle("hidden", !message.enabled); }
      if (message.type === "stage") { $("#aiStage").textContent = message.text; if (!hasReasoning) $("#aiReasoning").textContent = message.text; }
      if (message.type === "reasoning") {
        const box = $("#aiReasoning");
        if (!hasReasoning) { box.textContent = ""; hasReasoning = true; }
        box.textContent += message.text; box.scrollTop = box.scrollHeight;
      }
      if (message.type === "content" && aiDebugEnabled) $("#aiRaw").textContent += message.text;
      if (message.type === "done") { settled = true; finishAiProgress("整理完成"); resolve(message.draft); port.disconnect(); }
      if (message.type === "error") { settled = true; if (aiDebugEnabled) $("#aiRaw").textContent += `\n\n[解析错误] ${message.error}`; finishAiProgress("整理失败", true); reject(new Error(message.error)); port.disconnect(); }
    });
    port.onDisconnect.addListener(() => { if (!settled) { finishAiProgress("连接中断", true); reject(new Error("AI 连接意外中断")); } });
    port.postMessage({ type: "start", draft, mode: selectedMode });
  });
}
function tabById(id) { return state.draft.tabs.find(tab => tab.id === id); }
function favicon(tab) {
  if (tab.favIconUrl) return `<div class="favicon"><img src="${escapeHtml(tab.favIconUrl)}" alt=""></div>`;
  return `<div class="favicon">${escapeHtml((new URL(tab.url || "https://x").hostname[0] || "T").toUpperCase())}</div>`;
}
function escapeHtml(value="") { return value.replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function tabHtml(id) {
  const tab = tabById(id); if (!tab) return "";
  return `<div class="tab-row" draggable="true" data-tab-id="${id}">${favicon(tab)}<div class="tab-copy"><div class="tab-title">${escapeHtml(tab.title)}</div><div class="tab-url">${escapeHtml(tab.url)}</div></div><span class="handle" title="拖动标签">⠿</span></div>`;
}
function groupHtml(group, ungrouped=false) {
  const ids = ungrouped ? state.draft.ungroupedTabIds : group.tabIds;
  const clientId = ungrouped ? "ungrouped" : group.clientId;
  const title = ungrouped ? "未分组" : `<input class="name-input" data-group-id="${clientId}" value="${escapeHtml(group.title)}">`;
  const currentColor = getGroupColor(group?.color);
  const palette = groupColorPaletteHtml(group, clientId);
  const tools = ungrouped ? "" : `<button class="reorder" data-move-id="${clientId}" data-delta="-1" title="上移分组">↑</button><button class="reorder" data-move-id="${clientId}" data-delta="1" title="下移分组">↓</button><span class="color-picker"><button class="color-swatch" data-color-toggle="${clientId}" style="--swatch:${currentColor.hex}" title="分组颜色：${currentColor.label}" aria-label="选择分组颜色，当前${currentColor.label}" aria-expanded="false"></button><span class="color-palette hidden" data-palette-id="${clientId}" role="group" aria-label="选择分组颜色">${palette}</span></span><button class="delete" data-delete-id="${clientId}" title="删除分组">×</button>`;
  const dotColor = ungrouped ? "#a6aca8" : currentColor.hex;
  return `<section class="group ${ungrouped?"ungrouped":""}"><div class="group-head"><span class="dot" style="--group-color:${dotColor}"></span><span class="group-name">${title}</span><span class="group-tools"><span class="group-count">${ids.length} 个</span>${tools}</span></div><div class="group-body" data-group-id="${clientId}">${ids.map(tabHtml).join("") || '<div class="empty">拖动标签到这里</div>'}</div></section>`;
}
function render() {
  if (!state) return;
  const pinned = state.draft.tabs.filter(tab => tab.pinned);
  $("#windowMeta").textContent = `当前窗口 · ${state.draft.tabs.length} 个标签`;
  $("#workspace").innerHTML = (pinned.length ? `<div class="pinned">📌 ${pinned.length} 个固定标签保持原位</div>` : "") + groupHtml(null, true) + state.draft.groups.map(group => groupHtml(group)).join("");
  bindWorkspace();
}
function bindWorkspace() {
  document.querySelectorAll(".tab-row").forEach(row => {
    row.addEventListener("dragstart", () => { draggingTabId = Number(row.dataset.tabId); row.classList.add("dragging"); });
    row.addEventListener("dragend", () => { draggingTabId = null; row.classList.remove("dragging"); });
  });
  document.querySelectorAll(".group-body").forEach(zone => {
    zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", event => { event.preventDefault(); zone.classList.remove("drag-over"); if (draggingTabId == null) return; const targetRow = event.target.closest(".tab-row"); const index = targetRow ? [...zone.querySelectorAll(".tab-row")].indexOf(targetRow) : Infinity; state = moveTab(state, draggingTabId, zone.dataset.groupId, index); render(); });
  });
  document.querySelectorAll(".name-input").forEach(input => input.addEventListener("change", () => { state = renameGroup(state, input.dataset.groupId, input.value); render(); }));
  document.querySelectorAll("[data-color-toggle]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    const palette = document.querySelector(`[data-palette-id="${button.dataset.colorToggle}"]`);
    document.querySelectorAll(".color-palette").forEach(item => { if (item !== palette) item.classList.add("hidden"); });
    document.querySelectorAll("[data-color-toggle]").forEach(item => { if (item !== button) item.setAttribute("aria-expanded", "false"); });
    palette.classList.toggle("hidden");
    button.setAttribute("aria-expanded", String(!palette.classList.contains("hidden")));
  }));
  document.querySelectorAll(".palette-color").forEach(button => button.addEventListener("click", event => { event.stopPropagation(); state = setGroupColor(state, button.dataset.colorId, button.dataset.colorValue); render(); }));
  document.querySelectorAll(".delete").forEach(button => button.addEventListener("click", () => { state = removeGroup(state, button.dataset.deleteId); render(); }));
  document.querySelectorAll(".reorder").forEach(button => button.addEventListener("click", () => { state = moveGroup(state, button.dataset.moveId, Number(button.dataset.delta)); render(); }));
}
function closeColorPalettes() {
  document.querySelectorAll(".color-palette").forEach(palette => palette.classList.add("hidden"));
  document.querySelectorAll("[data-color-toggle]").forEach(button => button.setAttribute("aria-expanded", "false"));
}
document.addEventListener("click", closeColorPalettes);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeColorPalettes(); });
$("#aiProgressToggle").addEventListener("click", () => {
  const body = $("#aiProgressBody"); body.classList.toggle("hidden");
  $("#aiProgressToggle").setAttribute("aria-expanded", String(!body.classList.contains("hidden")));
});
async function loadWorkspace() {
  try { const response = await send({ type: "workspace:get" }); state = createEditorState(response.snapshot); render(); }
  catch (error) { $("#workspace").innerHTML = `<div class="loading">${escapeHtml(error.message)}</div>`; toast(error.message, true); }
}
function busy(value) { ["#aiAction","#reset","#save"].forEach(id => $(id).disabled = value); }

$("#addGroup").addEventListener("click", () => { state = addGroup(state); render(); document.querySelectorAll(".name-input")[state.draft.groups.length-1]?.focus(); });
document.querySelectorAll(".mode").forEach(button => button.addEventListener("click", () => { document.querySelectorAll(".mode").forEach(item=>item.classList.remove("active")); button.classList.add("active"); mode=button.dataset.mode; }));
$("#reset").addEventListener("click", () => { state=resetDraft(state); render(); });
$("#save").addEventListener("click", async () => { try { busy(true); const emptyGroups=state.draft.groups.filter(group=>group.tabIds.length===0); const response=await send({type:"workspace:save",draft:state.draft}); state=createEditorState(response.snapshot,emptyGroups); render(); toast("已保存到 Chrome 原生标签组"); } catch(error){toast(error.message,true)} finally{busy(false)} });
$("#undo").addEventListener("click", async () => { try { const response=await send({type:"workspace:undo",windowId:state.draft.windowId}); state=createEditorState(response.snapshot);render();toast("已撤销上次保存"); } catch(error){toast(error.message,true)} });
$("#aiAction").addEventListener("click", async () => { try { busy(true); $("#aiAction").textContent="分析中…"; const draft=await runAiGrouping(state.draft,mode); state={...state,draft,dirty:true};render();toast(`AI 整理完成 · ${draft.groups.length} 个组，${draft.ungroupedTabIds.length} 个未分组`); } catch(error){toast(error.message,true)} finally{$("#aiAction").textContent="AI 整理";busy(false)} });

const form={baseUrl:$("#baseUrl"),model:$("#model"),apiKey:$("#apiKey"),rememberKey:$("#rememberKey"),thinkingEnabled:$("#thinkingEnabled"),developerMode:$("#developerMode"),preference:$("#preference")};
$("#settingsButton").addEventListener("click", async()=>{$("#editorView").classList.add("hidden");$("#toolbar").classList.add("hidden");$("#settingsView").classList.remove("hidden");await loadSettings(form);savedSettingsFingerprint=settingsFingerprint(form)});
$("#settingsBack").addEventListener("click",()=>{if(settingsFingerprint(form)!==savedSettingsFingerprint&&!window.confirm("设置尚未保存，确定放弃修改并返回吗？"))return;$("#settingsView").classList.add("hidden");$("#editorView").classList.remove("hidden");$("#toolbar").classList.remove("hidden")});
$("#saveSettings").addEventListener("click",async()=>{try{await saveSettings(form);savedSettingsFingerprint=settingsFingerprint(form);toast("模型设置已保存")}catch(error){toast(error.message,true)}});
$("#testConnection").addEventListener("click",async()=>{try{await saveSettings(form);savedSettingsFingerprint=settingsFingerprint(form);const result=await send({type:"settings:test"});toast(result.message||"连接成功")}catch(error){toast(error.message,true)}});

loadWorkspace();
