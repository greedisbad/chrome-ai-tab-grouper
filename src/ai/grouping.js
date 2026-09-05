import { GROUP_COLORS, validateDraft } from "../domain/draft.js";

const modeText = { ungrouped: "只整理未分组标签并尽量保留已有组", optimize: "优化已有分组，可以合并、拆分和改名", regroup: "完全重新规划所有标签" };
export function buildGroupingMessages(draft, mode, preference = "") {
  const tabs = draft.tabs.filter(tab => !tab.pinned).map(tab => ({ id: tab.id, title: tab.title, url: tab.url, currentGroup: draft.groups.find(g => g.tabIds.includes(tab.id))?.title || null }));
  return [
    { role: "system", content: "你是浏览器标签整理器。只输出 JSON，不要 Markdown。每个标签 ID 必须且只能出现一次。格式：{\"groups\":[{\"title\":\"名称\",\"color\":\"grey|blue|red|yellow|green|pink|purple|cyan|orange\",\"tabIds\":[1]}],\"ungroupedTabIds\":[2]}" },
    { role: "user", content: `策略：${modeText[mode] || modeText.ungrouped}\n用户偏好：${preference || "无"}\n标签：${JSON.stringify(tabs)}` }
  ];
}
export function parseGroupingResponse(text, draft) {
  const raw = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error("模型没有返回有效 JSON"); }
  if (!Array.isArray(parsed.groups) || !Array.isArray(parsed.ungroupedTabIds)) throw new Error("模型响应结构无效");
  const groups = parsed.groups.map((group, index) => {
    if (!group.title?.trim()) throw new Error("分组名称不能为空");
    if (!GROUP_COLORS.includes(group.color)) throw new Error("分组颜色无效");
    if (!Array.isArray(group.tabIds)) throw new Error("标签列表无效");
    return { clientId: `ai-${index}-${crypto.randomUUID()}`, title: group.title.trim().slice(0, 60), color: group.color, tabIds: group.tabIds };
  });
  const result = { ...structuredClone(draft), groups, ungroupedTabIds: parsed.ungroupedTabIds };
  const valid = validateDraft(result); if (!valid.ok) throw new Error(valid.error);
  return result;
}
