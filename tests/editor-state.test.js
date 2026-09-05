import test from "node:test";
import assert from "node:assert/strict";
import { createEditorState, moveTab, resetDraft, addGroup, removeGroup, moveGroup, setGroupColor } from "../src/panel/editor-state.js";
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

test("moveGroup changes group order", () => {
  let state = addGroup(createEditorState(snapshot), "New", "green");
  const id = state.draft.groups[1].clientId;
  state = moveGroup(state, id, -1);
  assert.equal(state.draft.groups[0].clientId, id);
});

test("createEditorState preserves empty placeholder groups after saving", () => {
  const empty = { clientId: "empty", title: "稍后整理", color: "blue", tabIds: [] };
  const state = createEditorState(snapshot, [empty]);
  assert.deepEqual(state.draft.groups.at(-1), empty);
  assert.deepEqual(state.original.groups.at(-1), empty);
});

test("setGroupColor updates the selected Chrome color in the draft", () => {
  const state = setGroupColor(createEditorState(snapshot), "chrome-10", "orange");
  assert.equal(state.draft.groups[0].color, "orange");
  assert.equal(state.dirty, true);
});
