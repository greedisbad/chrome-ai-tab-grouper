import test from "node:test";
import assert from "node:assert/strict";
import { cloneDraft, snapshotToDraft, validateDraft } from "../src/domain/draft.js";
import { snapshot } from "./fixtures.js";

test("snapshotToDraft preserves grouped and ungrouped tabs", () => {
  const draft = snapshotToDraft(snapshot);
  assert.deepEqual(draft.ungroupedTabIds, [1]);
  assert.deepEqual(draft.groups[0].tabIds, [2, 3]);
  assert.equal(draft.groups[0].chromeGroupId, 10);
});

test("cloneDraft creates an independent copy", () => {
  const original = snapshotToDraft(snapshot);
  const copy = cloneDraft(original);
  copy.groups[0].tabIds.pop();
  assert.deepEqual(original.groups[0].tabIds, [2, 3]);
});

test("validateDraft rejects duplicate and missing assignments", () => {
  const duplicate = snapshotToDraft(snapshot);
  duplicate.groups[0].tabIds.push(1);
  assert.equal(validateDraft(duplicate).ok, false);
  const missing = snapshotToDraft(snapshot);
  missing.ungroupedTabIds = [];
  assert.equal(validateDraft(missing).ok, false);
});
