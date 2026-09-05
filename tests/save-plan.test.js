import test from "node:test";
import assert from "node:assert/strict";
import { buildSavePlan } from "../src/domain/save-plan.js";
import { snapshotToDraft } from "../src/domain/draft.js";
import { snapshot } from "./fixtures.js";

test("buildSavePlan ungroups tabs and creates new groups", () => {
  const draft = snapshotToDraft(snapshot);
  draft.groups[0].tabIds = [2];
  draft.ungroupedTabIds = [3];
  draft.groups.push({ clientId: "new", title: "Code", color: "green", tabIds: [1] });
  const plan = buildSavePlan(snapshot, draft);
  assert.ok(plan.some(op => op.type === "ungroup" && op.tabIds.includes(3)));
  assert.ok(plan.some(op => op.type === "group" && op.clientId === "new"));
  assert.ok(plan.some(op => op.type === "updateGroup" && op.title === "Code"));
});
