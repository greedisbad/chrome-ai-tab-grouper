# Chrome AI 标签分组插件设计

## 目标

构建一个供公司内部少量同事使用的 Chrome Manifest V3 插件。插件以 Chrome 侧边栏为主界面，既能完全不依赖 AI 地手动编辑当前窗口的原生标签组，也能调用用户配置的 OpenAI-compatible 模型生成可编辑的分组建议。

## 产品原则

- Chrome 原生标签组是唯一真实数据源，不模拟第二套持久化分组系统。
- AI 是可选助手；插件没有模型配置时仍可完整手动使用。
- 拖动只修改内存中的草稿，点击“保存调整”后才修改 Chrome。
- “重置”始终可用，恢复本次打开或最近一次刷新时读取的原始分组快照。
- AI 分组后仍保留“未分组”区域，允许标签明确不属于任何组。
- 所有分组默认展开；用户可以临时折叠，但折叠状态不作为核心业务数据。
- 标签拖动时不显示 toast；数量与位置变化就是反馈。
- 成功、失败等一次性消息显示在右上角并自动消失，不常驻占用空间。

## 支持范围

### 第一版包含

- 读取当前 Chrome 普通窗口中的所有标签和原生标签组。
- 按“未分组 + 已有组”展示，默认全部展开。
- 标签在组之间、组内以及未分组区域之间拖动。
- 编辑组名和 Chrome 支持的组颜色。
- 新建空组、删除草稿组、调整组顺序。
- 保存草稿到 Chrome 原生标签组。
- 重置尚未保存的全部手动或 AI 修改。
- 保存后撤销最近一次真实变更。
- 三种 AI 策略：整理未分组、优化已有组、全部重组。
- OpenAI-compatible 配置：Base URL、API Key、模型名称、自定义整理偏好。
- DeepSeek 默认示例以及 localhost 接口支持。
- 连接测试、结构化响应校验、错误提示和非 AI 降级。

### 第一版不包含

- 读取网页正文或注入 content script。
- 跨窗口移动或合并标签组。
- 云端账号、配置同步或团队共享。
- 自动关闭、冻结、休眠或收藏标签。
- 后台无感持续重排标签。
- 多级嵌套组；Chrome 原生标签组不支持嵌套。
- Chrome Web Store 公开发行流程。

## 核心流程

### 手动整理

1. 用户点击扩展图标，Chrome 打开侧边栏。
2. 插件读取当前窗口并建立不可变初始快照与可编辑草稿。
3. 用户拖动标签、改名、改色、新建或删除组。
4. 用户可随时点击“重置”恢复初始快照。
5. 用户点击“保存调整”，插件计算草稿与当前 Chrome 状态之间的操作并应用。
6. 保存成功后重新读取 Chrome；保存前快照成为可撤销记录。

### AI 整理

1. 用户选择“整理未分组”“优化已有组”或“全部重组”。
2. 用户点击“AI 整理”。
3. 插件只发送标签 ID、标题、URL、当前组名和用户整理偏好。
4. 模型返回严格 JSON 分组方案，允许 `ungroupedTabIds`。
5. 插件校验所有 ID：不得虚构、重复或遗漏；异常响应不修改当前草稿。
6. 校验通过后用 AI 方案替换当前草稿，右上角短暂提示结果摘要。
7. 用户可拖动修正、切换策略再次运行 AI、重置或保存。

## 数据模型

```ts
type ChromeGroupColor =
  | "grey" | "blue" | "red" | "yellow" | "green"
  | "pink" | "purple" | "cyan" | "orange";

interface TabItem {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  pinned: boolean;
  index: number;
}

interface GroupDraft {
  clientId: string;
  chromeGroupId?: number;
  title: string;
  color: ChromeGroupColor;
  tabIds: number[];
}

interface WorkspaceDraft {
  windowId: number;
  tabs: TabItem[];
  groups: GroupDraft[];
  ungroupedTabIds: number[];
}

type GroupingMode = "ungrouped" | "optimize" | "regroup";
```

固定标签展示但默认不可由 AI 移动。手动拖动固定标签时也保持其 pinned 状态；第一版不允许固定标签加入原生组，以避免 Chrome 行为差异造成误操作。

## Chrome 集成

- Manifest V3，最低 Chrome 114，以使用 `chrome.sidePanel`。
- 必需权限：`tabs`、`tabGroups`、`storage`、`sidePanel`。
- 可选 Host Permission：`http://*/*`、`https://*/*`，仅在用户保存或测试模型地址的明确操作中请求具体 origin。
- Service Worker 负责读取和修改标签、保存快照以及调用模型接口。
- Side Panel 只通过消息接口请求特权操作，不接收 API Key 明文回传。
- 点击扩展图标直接打开全局 Side Panel。

保存草稿时采用确定性过程：先解除需要离开旧组的标签，再按草稿组顺序调用 `chrome.tabs.group()`，随后调用 `chrome.tabGroups.update()` 设置标题和颜色，最后移动组顺序。任一步失败后重新读取真实状态并显示部分失败，不宣称事务性成功。

## AI 接入与安全

- 使用原生 `fetch` 调用 `{baseUrl}/chat/completions`，不加载远程 SDK 或代码。
- Base URL 规范化，去除末尾 `/`；允许 `http://localhost`、`http://127.0.0.1`，其他远端默认要求 HTTPS。
- API Key 默认保存于 `chrome.storage.session`；用户主动勾选“记住 Key”时保存于 `chrome.storage.local`。
- Base URL、模型、整理偏好保存于 `chrome.storage.local`。
- 提示词由不可编辑系统约束与用户追加偏好组成；用户偏好不能改变输出 schema 或安全边界。
- 对模型响应执行 JSON 提取、类型检查、ID 完整性检查、组名清理和颜色白名单检查。
- 模型失败不会改变现有草稿，用户仍可继续手动整理。

模型输出：

```json
{
  "groups": [
    {"title": "认证功能开发", "color": "green", "tabIds": [12, 13]}
  ],
  "ungroupedTabIds": [14]
}
```

## 界面状态

- `loading`：首次读取 Chrome 标签，显示骨架屏。
- `editing`：展示当前草稿，可手动拖动和保存。
- `ai-running`：列表保留，AI 按钮显示处理中并禁用重复请求。
- `saving`：禁用保存、AI 与重置，防止草稿变化。
- `settings`：侧边栏内替换为设置视图，可返回编辑器。
- `error`：右上角显示可消失错误；真实 Chrome 状态保持不变或重新读取。

底部工具栏在 `editing` 和 AI 完成后保持相同布局与文案：三种策略、AI 整理、重置、保存调整。

## 测试策略

- 使用 Node 内置测试运行器测试纯函数：快照转草稿、草稿变更、AI 响应校验、提示词生成和保存操作规划。
- 用 Chrome API mock 测试 Service Worker 消息处理与部分失败行为。
- 用静态检查验证 Manifest 权限、入口文件和禁止远程脚本。
- 在 Chrome 开发者模式加载 unpacked extension，执行手动验收：读取、拖动、重置、保存、撤销、设置、AI 成功及 AI 失败。

## 验收标准

- 未配置 AI 时，用户可以完成读取、拖动、重置、保存和撤销全过程。
- 初始界面的未分组和所有已有组均展开。
- 手动或 AI 状态下，标签可在任意组和未分组区域之间移动。
- 重置始终恢复最近一次读取的原始快照。
- AI 结果允许未分组标签，且所有真实标签恰好出现一次。
- AI 完成提示不会常驻。
- 保存后 Chrome 顶部标签栏显示与草稿一致的原生标签组。
- API Key 不出现在源码、日志、DOM 文本或 Service Worker 到 Side Panel 的响应中。
