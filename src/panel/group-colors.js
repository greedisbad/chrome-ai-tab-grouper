export const GROUP_COLORS = Object.freeze([
  { value: "grey", label: "灰色", hex: "#8f9692" },
  { value: "blue", label: "蓝色", hex: "#4f86e8" },
  { value: "red", label: "红色", hex: "#df625b" },
  { value: "yellow", label: "黄色", hex: "#e5b83e" },
  { value: "green", label: "绿色", hex: "#55a36f" },
  { value: "pink", label: "粉色", hex: "#d873ad" },
  { value: "purple", label: "紫色", hex: "#8d6bd1" },
  { value: "cyan", label: "青色", hex: "#46a9b8" },
  { value: "orange", label: "橙色", hex: "#dc7b42" }
]);

export function getGroupColor(value) {
  return GROUP_COLORS.find(color => color.value === value) || GROUP_COLORS[0];
}

export function groupColorPaletteHtml(group, clientId) {
  if (!group) return "";
  return GROUP_COLORS.map(color => `<button class="palette-color ${color.value === group.color ? "selected" : ""}" data-color-id="${clientId}" data-color-value="${color.value}" style="--swatch:${color.hex}" title="${color.label}" aria-label="${color.label}" aria-pressed="${color.value === group.color}"></button>`).join("");
}
