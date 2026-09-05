import { validateDraft } from "./draft.js";
export function buildSavePlan(before, draft) {
  const valid = validateDraft(draft); if (!valid.ok) throw new Error(valid.error);
  const operations = [];
  const originallyGrouped = before.tabs.filter(t => !t.pinned && t.groupId !== -1).map(t => t.id);
  const toUngroup = draft.ungroupedTabIds.filter(id => originallyGrouped.includes(id));
  if (toUngroup.length) operations.push({ type: "ungroup", tabIds: toUngroup });
  for (const group of draft.groups) {
    if (!group.tabIds.length) continue;
    operations.push({ type: "group", clientId: group.clientId, chromeGroupId: group.chromeGroupId, tabIds: group.tabIds });
    operations.push({ type: "updateGroup", clientId: group.clientId, chromeGroupId: group.chromeGroupId, title: group.title, color: group.color });
  }
  return operations;
}
