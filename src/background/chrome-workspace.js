import { buildSavePlan } from "../domain/save-plan.js";

export async function readWorkspace(chromeApi, requestedWindowId) {
  const windowId = requestedWindowId ?? (await chromeApi.windows.getCurrent()).id;
  const [tabs, groups] = await Promise.all([
    chromeApi.tabs.query({ windowId }),
    chromeApi.tabGroups.query({ windowId })
  ]);
  return {
    windowId,
    tabs: tabs.map(tab => ({ id: tab.id, title: tab.title || "无标题", url: tab.url || "", favIconUrl: tab.favIconUrl, pinned: Boolean(tab.pinned), index: tab.index, groupId: tab.groupId ?? -1 })),
    groups: groups.map(group => ({ id: group.id, title: group.title || "未命名分组", color: group.color || "grey", collapsed: Boolean(group.collapsed) }))
  };
}

export async function applyDraft(chromeApi, before, draft) {
  const plan = buildSavePlan(before, draft);
  const groupIds = new Map();
  for (const operation of plan) {
    if (operation.type === "ungroup" && operation.tabIds.length) await chromeApi.tabs.ungroup(operation.tabIds);
    if (operation.type === "group" && operation.tabIds.length) {
      const options = { tabIds: operation.tabIds };
      if (operation.chromeGroupId != null) options.groupId = operation.chromeGroupId;
      else options.createProperties = { windowId: draft.windowId };
      groupIds.set(operation.clientId, await chromeApi.tabs.group(options));
    }
    if (operation.type === "updateGroup") {
      const id = groupIds.get(operation.clientId) ?? operation.chromeGroupId;
      if (id != null) await chromeApi.tabGroups.update(id, { title: operation.title, color: operation.color, collapsed: false });
    }
  }
  return readWorkspace(chromeApi, draft.windowId);
}
