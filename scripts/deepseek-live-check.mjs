import { readFile } from "node:fs/promises";
import { streamJson } from "../src/ai/openai-client.js";
import { buildGroupingMessages, parseGroupingResponse } from "../src/ai/grouping.js";

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    return separator < 0 ? [] : [[trimmed.slice(0, separator), trimmed.slice(separator + 1).trim()]];
  }));
}

const env = parseEnv(await readFile(new URL("../.env.local", import.meta.url), "utf8"));
if (!env.DEEPSEEK_API_KEY) throw new Error("请先在 .env.local 中填写 DEEPSEEK_API_KEY");

const tabs = [
  [1, "GitHub · frontend pull requests", "https://github.com/acme/frontend/pulls"],
  [2, "GitHub · backend issues", "https://github.com/acme/backend/issues"],
  [3, "localhost frontend", "http://localhost:5173/dashboard"],
  [4, "localhost API docs", "http://localhost:8080/docs"],
  [5, "Figma · dashboard design", "https://figma.com/file/dashboard"],
  [6, "Jira · WEB-142", "https://jira.example.com/browse/WEB-142"],
  [7, "MDN · WebExtensions", "https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions"],
  [8, "Chrome tabGroups API", "https://developer.chrome.com/docs/extensions/reference/api/tabGroups"],
  [9, "Production dashboard", "https://app.example.com/dashboard"]
].map(([id, title, url], index) => ({ id, title, url, pinned: false, index, groupId: -1 }));
const mode = process.argv.find(argument => argument.startsWith("--mode="))?.split("=")[1] || "regroup";
const hasExistingGroup = mode !== "regroup";
const draft = {
  windowId: 1,
  tabs,
  groups: hasExistingGroup ? [{ clientId: "existing", chromeGroupId: 10, title: "Existing engineering", color: "blue", tabIds: [1, 2] }] : [],
  ungroupedTabIds: tabs.map(tab => tab.id).filter(id => !hasExistingGroup || ![1, 2].includes(id))
};
const thinkingEnabled = process.argv.includes("--thinking");
let reasoningCharacters = 0;
const started = Date.now();
const response = await streamJson({
  baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
  apiKey: env.DEEPSEEK_API_KEY,
  thinkingEnabled
}, buildGroupingMessages(draft, mode, "按项目和工作目的分组，开发环境与对应项目放在一起"), event => {
  if (event.type === "reasoning") reasoningCharacters += event.text.length;
});
const result = parseGroupingResponse(response, draft);
if (result.groups.length === 0) throw new Error("模型返回了有效 JSON，但没有创建任何分组");
console.log(JSON.stringify({
  thinkingEnabled,
  mode,
  elapsedMs: Date.now() - started,
  reasoningCharacters,
  groups: result.groups.map(group => ({ title: group.title, color: group.color, tabCount: group.tabIds.length })),
  ungroupedCount: result.ungroupedTabIds.length
}, null, 2));
