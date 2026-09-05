import { cloneDraft, snapshotToDraft } from "../domain/draft.js";

export function createEditorState(snapshot, preservedEmptyGroups = []) {
  const original = snapshotToDraft(snapshot);
  const existingClientIds = new Set(original.groups.map(group => group.clientId));
  original.groups.push(...preservedEmptyGroups
    .filter(group => group.tabIds.length === 0 && !existingClientIds.has(group.clientId))
    .map(group => ({ ...group, tabIds: [] })));
  return { original, draft: cloneDraft(original), dirty: false };
}
export function resetDraft(state) { return { ...state, draft: cloneDraft(state.original), dirty: false }; }
export function moveTab(state, tabId, targetClientId, targetIndex = Infinity) {
  const draft = cloneDraft(state.draft);
  draft.ungroupedTabIds = draft.ungroupedTabIds.filter(id => id !== tabId);
  draft.groups.forEach(group => { group.tabIds = group.tabIds.filter(id => id !== tabId); });
  const target = targetClientId === "ungrouped" ? draft.ungroupedTabIds : draft.groups.find(group => group.clientId === targetClientId)?.tabIds;
  if (!target) throw new Error("目标分组不存在");
  target.splice(Math.min(targetIndex, target.length), 0, tabId);
  return { ...state, draft, dirty: true };
}
export function addGroup(state, title = "新分组", color = "grey") {
  const draft = cloneDraft(state.draft);
  draft.groups.push({ clientId: `new-${crypto.randomUUID()}`, title, color, tabIds: [] });
  return { ...state, draft, dirty: true };
}
export function removeGroup(state, clientId) {
  const draft = cloneDraft(state.draft);
  const group = draft.groups.find(item => item.clientId === clientId);
  if (!group) return state;
  draft.ungroupedTabIds.push(...group.tabIds);
  draft.groups = draft.groups.filter(item => item.clientId !== clientId);
  return { ...state, draft, dirty: true };
}
export function renameGroup(state, clientId, title) {
  const draft = cloneDraft(state.draft); const group = draft.groups.find(item => item.clientId === clientId);
  if (group) group.title = title.trim() || "未命名分组";
  return { ...state, draft, dirty: true };
}
export function setGroupColor(state, clientId, color) {
  const draft = cloneDraft(state.draft); const group = draft.groups.find(item => item.clientId === clientId);
  if (group) group.color = color;
  return { ...state, draft, dirty: true };
}
export function moveGroup(state, clientId, delta) {
  const draft = cloneDraft(state.draft);
  const index = draft.groups.findIndex(group => group.clientId === clientId);
  const target = Math.max(0, Math.min(draft.groups.length - 1, index + delta));
  if (index < 0 || index === target) return state;
  const [group] = draft.groups.splice(index, 1);
  draft.groups.splice(target, 0, group);
  return { ...state, draft, dirty: true };
}
