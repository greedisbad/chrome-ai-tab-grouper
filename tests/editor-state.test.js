import test from "node:test";
import assert from "node:assert/strict";
import { createEditorState, moveTab, resetDraft, addGroup, removeGroup } from "../src/panel/editor-state.js";
import { snapshot } from "./fixtures.js";

test("moveTab moves a tab between ungrouped and groups", () => {
  let state = createEditorState(snapshot);
  state = moveTab(state, 1, state.draft.groups[0].clientId, 1);
  assert.deepEqual(state.draft.ungroupedTabIds, []);
  assert.deepEqual(state.draft.groups[0].tabIds, [2, 1, 3]);
});

test("resetDraft restores the initial snapshot after edits", () => {
  let state = createEditorState(snapshot);
  state = moveTab(state, 1, state.draft.groups[0].clientId, 0);
  state = resetDraft(state);
  assert.deepEqual(state.draft.ungroupedTabIds, [1]);
});

test("groups can be added and removed without losing tabs", () => {
  let state = addGroup(createEditorState(snapshot), "New", "green");
  const id = state.draft.groups.at(-1).clientId;
  state = moveTab(state, 1, id, 0);
  state = removeGroup(state, id);
  assert.deepEqual(state.draft.ungroupedTabIds, [1]);
});
