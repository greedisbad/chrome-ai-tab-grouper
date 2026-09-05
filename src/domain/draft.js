export const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];

export function cloneDraft(draft) { return structuredClone(draft); }

export function snapshotToDraft(snapshot) {
  const editableTabs = snapshot.tabs.filter(tab => !tab.pinned);
  const groups = snapshot.groups.map(group => ({
    clientId: `chrome-${group.id}`,
    chromeGroupId: group.id,
    title: group.title || "未命名分组",
    color: GROUP_COLORS.includes(group.color) ? group.color : "grey",
    tabIds: editableTabs.filter(tab => tab.groupId === group.id).sort((a,b) => a.index-b.index).map(tab => tab.id)
  })).filter(group => group.tabIds.length);
  return {
    windowId: snapshot.windowId,
    tabs: structuredClone(snapshot.tabs),
    groups,
    ungroupedTabIds: editableTabs.filter(tab => tab.groupId === -1).sort((a,b) => a.index-b.index).map(tab => tab.id)
  };
}

export function validateDraft(draft) {
  const expected = draft.tabs.filter(tab => !tab.pinned).map(tab => tab.id);
  const assigned = [...draft.ungroupedTabIds, ...draft.groups.flatMap(group => group.tabIds)];
  if (new Set(assigned).size !== assigned.length) return { ok: false, error: "标签被重复分配" };
  const expectedSet = new Set(expected);
  if (assigned.some(id => !expectedSet.has(id))) return { ok: false, error: "包含未知标签" };
  if (assigned.length !== expected.length || expected.some(id => !assigned.includes(id))) return { ok: false, error: "存在遗漏标签" };
  return { ok: true };
}
