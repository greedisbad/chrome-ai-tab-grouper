import test from "node:test";
import assert from "node:assert/strict";
import { GROUP_COLORS, groupColorPaletteHtml } from "../src/panel/group-colors.js";

test("color palette exposes every color supported by Chrome tab groups", () => {
  assert.deepEqual(
    GROUP_COLORS.map(item => item.value),
    ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"]
  );
  assert.equal(GROUP_COLORS.every(item => item.label && /^#[0-9a-f]{6}$/i.test(item.hex)), true);
});

test("ungrouped section does not attempt to render a color palette", () => {
  assert.equal(groupColorPaletteHtml(null, "ungrouped"), "");
});
