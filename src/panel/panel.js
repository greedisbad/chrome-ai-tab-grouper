import { createEditorState, moveTab, resetDraft, addGroup, removeGroup, renameGroup, setGroupColor, moveGroup } from "./editor-state.js";
import { loadSettings, saveSettings } from "./settings.js";
import { GROUP_COLORS, getGroupColor } from "./group-colors.js";

const $ = selector => document.querySelector(selector);
let state;
let mode = "ungrouped";
let draggingTabId = null;

function toast(message, error = false) {
  const element = $("#toast"); element.textContent = message; element.style.background = error ? "#8f403b" : "#1f2d27"; element.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove("show"), 2200);
}
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || "操作失败");
  return response;
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
  const palette = GROUP_COLORS.map(color => `<button class="palette-color ${color.value===group.color?"selected":""}" data-color-id="${clientId}" data-color-value="${color.value}" style="--swatch:${color.hex}" title="${color.label}" aria-label="${color.label}" aria-pressed="${color.value===group.color}"></button>`).join("");
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
$("#aiAction").addEventListener("click", async () => { try { busy(true); $("#aiAction").textContent="分析中…"; const response=await send({type:"workspace:ai-group",draft:state.draft,mode}); state={...state,draft:response.draft,dirty:true};render();toast(`AI 整理完成 · ${response.draft.groups.length} 个组，${response.draft.ungroupedTabIds.length} 个未分组`); } catch(error){toast(error.message,true)} finally{$("#aiAction").textContent="AI 整理";busy(false)} });

const form={baseUrl:$("#baseUrl"),model:$("#model"),apiKey:$("#apiKey"),rememberKey:$("#rememberKey"),preference:$("#preference")};
$("#settingsButton").addEventListener("click", async()=>{$("#editorView").classList.add("hidden");$("#toolbar").classList.add("hidden");$("#settingsView").classList.remove("hidden");await loadSettings(form)});
$("#settingsBack").addEventListener("click",()=>{$("#settingsView").classList.add("hidden");$("#editorView").classList.remove("hidden");$("#toolbar").classList.remove("hidden")});
$("#saveSettings").addEventListener("click",async()=>{try{await saveSettings(form);toast("模型设置已保存")}catch(error){toast(error.message,true)}});
$("#testConnection").addEventListener("click",async()=>{try{await saveSettings(form);const result=await send({type:"settings:test"});toast(result.message||"连接成功")}catch(error){toast(error.message,true)}});

loadWorkspace();
