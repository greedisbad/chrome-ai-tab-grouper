# Chrome AI Tab Grouper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a loadable Chrome MV3 side-panel extension for manual and optional AI-assisted native tab grouping.

**Architecture:** A dependency-free extension uses a service worker as the privileged Chrome/AI gateway and a side-panel ES module as the draft editor. Pure domain modules own snapshots, draft validation, AI parsing, and deterministic save planning so Node's built-in test runner can verify behavior without Chrome.

**Tech Stack:** Chrome Manifest V3, vanilla HTML/CSS/ES modules, Sortable-style native HTML5 drag events, Node.js `node:test`, native `fetch`.

**Spec:** `docs/superpowers/specs/2026-09-05-ai-tab-grouper-design.md`

## Global Constraints

- Minimum Chrome version is 114.
- Required permissions are `tabs`, `tabGroups`, `storage`, and `sidePanel`.
- Only the current normal Chrome window is modified.
- No content scripts, page-body extraction, remote executable code, or mandatory AI dependency.
- Every tab must appear exactly once in a draft, either in one group or in `ungroupedTabIds`.
- API keys never appear in source, logs, DOM text, or service-worker responses.
- All groups are expanded by default and the bottom toolbar stays stable after AI runs.

---

### Task 1: Extension shell and draft domain

**Files:**
- Create: `manifest.json`
- Create: `src/domain/draft.js`
- Create: `tests/draft.test.js`
- Create: `package.json`

**Interfaces:**
- Produces: `snapshotToDraft(snapshot): WorkspaceDraft`, `cloneDraft(draft): WorkspaceDraft`, `validateDraft(draft): {ok:boolean,error?:string}`.

- [ ] Write tests proving groups and ungrouped tabs are preserved, clones are independent, and duplicate/missing tab IDs fail validation.
- [ ] Run `npm test -- tests/draft.test.js` and verify failure because `src/domain/draft.js` does not exist.
- [ ] Implement the three pure functions with structured cloning and exact tab-ID set validation.
- [ ] Create MV3 manifest with side panel and service worker entries, Chrome 114 minimum, required permissions, and optional HTTP/HTTPS host permissions.
- [ ] Run `npm test -- tests/draft.test.js` and verify all draft tests pass.
- [ ] Commit the task files with message `feat: scaffold extension draft domain`.

Test shape:

```js
test("validateDraft rejects duplicate assignments", () => {
  const draft = snapshotToDraft(fixture);
  draft.groups[0].tabIds.push(draft.ungroupedTabIds[0]);
  assert.equal(validateDraft(draft).ok, false);
});
```

### Task 2: Chrome workspace gateway and save planner

**Files:**
- Create: `src/domain/save-plan.js`
- Create: `src/background/chrome-workspace.js`
- Create: `src/background/service-worker.js`
- Create: `tests/save-plan.test.js`
- Create: `tests/chrome-workspace.test.js`

**Interfaces:**
- Consumes: `validateDraft(draft)`.
- Produces: `buildSavePlan(before, draft): SaveOperation[]`, `readWorkspace(chromeApi, windowId?)`, `applyDraft(chromeApi, before, draft)`, runtime messages `workspace:get`, `workspace:save`, and `workspace:undo`.

- [ ] Write save-plan tests for ungrouping, reusing an existing group, creating a new group, renaming/recoloring, and group ordering.
- [ ] Write gateway tests with a Chrome mock proving `tabs.group`, `tabs.ungroup`, `tabGroups.update`, and reread-after-failure behavior.
- [ ] Run both tests and verify missing-module failures.
- [ ] Implement deterministic save operations without assuming Chrome group IDs survive a session.
- [ ] Implement workspace reads that exclude pinned tabs from editable assignments but retain them for display.
- [ ] Implement service-worker message routing and one in-memory undo snapshot per window; set `openPanelOnActionClick` during install/startup.
- [ ] Run `npm test -- tests/save-plan.test.js tests/chrome-workspace.test.js` and verify they pass.
- [ ] Commit with message `feat: integrate native Chrome tab groups`.

Operation example:

```js
[
  { type: "ungroup", tabIds: [7] },
  { type: "group", clientId: "new-auth", tabIds: [1, 2] },
  { type: "updateGroup", clientId: "new-auth", title: "认证功能", color: "green" }
]
```

### Task 3: Manual side-panel editor

**Files:**
- Create: `src/panel/panel.html`
- Create: `src/panel/panel.css`
- Create: `src/panel/panel.js`
- Create: `src/panel/editor-state.js`
- Create: `tests/editor-state.test.js`

**Interfaces:**
- Consumes: runtime messages `workspace:get`, `workspace:save`, `workspace:undo`.
- Produces: `createEditorState(snapshot)`, `moveTab(state, tabId, targetClientId, targetIndex)`, `resetDraft(state)`, `renameGroup`, `setGroupColor`, `addGroup`, `removeGroup`.

- [ ] Write tests for moves between groups and ungrouped, reset after manual edits, group creation/removal, and count updates.
- [ ] Run the editor tests and verify missing-module failure.
- [ ] Implement immutable editor-state transitions.
- [ ] Convert the approved `panel.html` look into extension-local HTML/CSS without inline scripts or demo data.
- [ ] Render all groups expanded, keep a permanent ungrouped drop zone, implement native drag/drop, group rename/color/new/delete controls, and stable bottom toolbar.
- [ ] Wire save, reset, and undo; suppress move toasts and show transient upper-right success/error notifications only.
- [ ] Run `npm test -- tests/editor-state.test.js` and the complete test suite.
- [ ] Commit with message `feat: add manual side panel group editor`.

### Task 4: Model settings and OpenAI-compatible client

**Files:**
- Create: `src/ai/config.js`
- Create: `src/ai/openai-client.js`
- Create: `src/panel/settings.js`
- Create: `tests/config.test.js`
- Create: `tests/openai-client.test.js`

**Interfaces:**
- Produces: `normalizeBaseUrl(url)`, `validateModelConfig(config)`, `requestEndpointPermission(origin)`, `testConnection(config)`, `completeJson(config, messages, fetchImpl)`, settings runtime messages that never return the stored key.

- [ ] Write tests for DeepSeek URL normalization, localhost HTTP acceptance, remote HTTP rejection, missing model/key errors, endpoint composition, and HTTP/API error redaction.
- [ ] Run tests and verify missing-module failures.
- [ ] Implement config validation and `/chat/completions` endpoint composition.
- [ ] Implement a settings screen for Base URL, API Key, model, remember-key checkbox, connection test, and user grouping preference.
- [ ] Store ordinary config locally, session-only keys in `storage.session`, remembered keys in `storage.local`, and request only the configured origin permission on a user gesture.
- [ ] Run targeted and complete tests.
- [ ] Commit with message `feat: add private OpenAI-compatible settings`.

### Task 5: AI grouping prompt and response validation

**Files:**
- Create: `src/ai/grouping.js`
- Create: `tests/grouping.test.js`
- Modify: `src/background/service-worker.js`
- Modify: `src/panel/panel.js`

**Interfaces:**
- Produces: `buildGroupingMessages(draft, mode, preference)`, `parseGroupingResponse(text, draft)`, runtime message `workspace:ai-group`.

- [ ] Write tests for the three strategy prompts, fenced/unfenced JSON, invented IDs, duplicate IDs, omitted IDs, invalid colors, blank names, and valid ungrouped results.
- [ ] Run tests and verify missing-module failure.
- [ ] Implement prompts that include only ID/title/URL/current group and require the exact JSON schema.
- [ ] Implement strict response parsing and return a fresh valid `WorkspaceDraft` without mutating the caller.
- [ ] Wire the service worker to fetch using the private stored key and return only a draft or redacted error.
- [ ] Wire the stable AI toolbar so changing mode and rerunning AI replaces the editable draft while preserving reset-to-original behavior.
- [ ] Run targeted and complete tests.
- [ ] Commit with message `feat: add validated AI grouping workflow`.

### Task 6: Packaging, documentation, and end-to-end verification

**Files:**
- Create: `README.md`
- Create: `scripts/verify-extension.mjs`
- Modify: `package.json`
- Modify: `.gitignore` if generated output is introduced.

**Interfaces:**
- Consumes the complete extension.
- Produces `npm run verify`, an unpacked-extension directory rooted at the repository, and internal installation instructions.

- [ ] Implement a verifier that parses `manifest.json`, checks every referenced file, rejects remote scripts and inline extension scripts, and verifies required permissions/minimum Chrome version.
- [ ] Add tests or fixture assertions proving the verifier fails for missing files and passes for this repository.
- [ ] Write README instructions for loading unpacked, granting model endpoint permission, DeepSeek and localhost configuration, manual workflow, AI workflow, privacy, and known limitations.
- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run verify` and require a successful manifest/file/security report.
- [ ] Inspect `git status`, ensure no key, dependency directory, cache, or generated artifact is staged, then commit with message `docs: finish extension packaging and verification`.
- [ ] Load the unpacked extension in Chrome manually and verify read → drag → reset → save → undo and AI success/failure flows; record any environment-only limitation in README.
