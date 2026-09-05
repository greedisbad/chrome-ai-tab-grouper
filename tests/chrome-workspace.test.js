import test from "node:test";
import assert from "node:assert/strict";
import { readWorkspace, applyDraft } from "../src/background/chrome-workspace.js";
import { snapshot, snapshot as fixture } from "./fixtures.js";
import { snapshotToDraft } from "../src/domain/draft.js";

function chromeMock() {
  const calls = [];
  return {
    calls,
    windows: { getCurrent: async () => ({ id: 1, type: "normal" }) },
    tabs: {
      query: async () => fixture.tabs,
      ungroup: async ids => calls.push(["ungroup", ids]),
      group: async options => { calls.push(["group", options]); return options.groupId ?? 99; }
    },
    tabGroups: {
      query: async () => fixture.groups,
      update: async (id, update) => calls.push(["update", id, update]),
      move: async (id, move) => calls.push(["move", id, move])
    }
  };
}

test("readWorkspace reads tabs and groups from the current window", async () => {
  const result = await readWorkspace(chromeMock());
  assert.equal(result.windowId, 1);
  assert.equal(result.tabs.length, 3);
  assert.equal(result.groups[0].id, 10);
});

test("applyDraft applies native ungroup, group and metadata operations", async () => {
  const api = chromeMock();
  const draft = snapshotToDraft(snapshot);
  draft.groups[0].tabIds = [2]; draft.ungroupedTabIds = [3];
  draft.groups.push({ clientId: "new", title: "Code", color: "green", tabIds: [1] });
  await applyDraft(api, snapshot, draft);
  assert.ok(api.calls.some(call => call[0] === "ungroup"));
  assert.ok(api.calls.some(call => call[0] === "update" && call[2].title === "Code"));
  assert.ok(api.calls.some(call => call[0] === "move"));
});

test("applyDraft recreates a group when a snapshot group ID no longer exists", async () => {
  const api = chromeMock();
  const current = { ...snapshot, groups: [{ id: 20, title: "Current", color: "red" }], tabs: snapshot.tabs.map(tab => ({ ...tab, groupId: tab.id === 1 ? -1 : 20 })) };
  api.tabs.query = async () => current.tabs;
  api.tabGroups.query = async () => current.groups;
  const oldDraft = snapshotToDraft(snapshot);
  await applyDraft(api, current, oldDraft);
  const groupCall = api.calls.find(call => call[0] === "group");
  assert.equal(groupCall[1].groupId, undefined);
  assert.deepEqual(groupCall[1].createProperties, { windowId: 1 });
});
