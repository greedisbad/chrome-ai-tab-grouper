import test from "node:test";
import assert from "node:assert/strict";
import { buildGroupingMessages, parseGroupingResponse } from "../src/ai/grouping.js";
import { snapshotToDraft } from "../src/domain/draft.js";
import { snapshot } from "./fixtures.js";

test("grouping messages describe the selected strategy", () => {
  const draft = snapshotToDraft(snapshot);
  const messages = buildGroupingMessages(draft, "regroup", "按项目分组");
  assert.match(messages[1].content, /完全重新/);
  assert.match(messages[1].content, /按项目分组/);
});

test("parseGroupingResponse accepts fenced JSON and ungrouped tabs", () => {
  const draft = snapshotToDraft(snapshot);
  const text = '```json\n{"groups":[{"title":"开发","color":"green","tabIds":[1,2]}],"ungroupedTabIds":[3]}\n```';
  const result = parseGroupingResponse(text, draft);
  assert.deepEqual(result.ungroupedTabIds, [3]);
  assert.deepEqual(result.groups[0].tabIds, [1, 2]);
});

test("parseGroupingResponse rejects invented, duplicate, or omitted IDs", () => {
  const draft = snapshotToDraft(snapshot);
  assert.throws(() => parseGroupingResponse('{"groups":[{"title":"X","color":"green","tabIds":[1,99]}],"ungroupedTabIds":[2,3]}', draft), /未知/);
  assert.throws(() => parseGroupingResponse('{"groups":[{"title":"X","color":"green","tabIds":[1,2]}],"ungroupedTabIds":[2,3]}', draft), /重复/);
  assert.throws(() => parseGroupingResponse('{"groups":[{"title":"X","color":"green","tabIds":[1]}],"ungroupedTabIds":[2]}', draft), /遗漏/);
});
