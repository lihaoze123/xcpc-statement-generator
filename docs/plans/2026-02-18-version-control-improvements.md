# 版本管理功能改进实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 改进版本管理的用户引导和增强核心功能，包括空状态引导、版本预览、从版本创建分支。

**Architecture:** 在现有 VersionManager 组件基础上添加展开预览功能，在新建分支弹窗中添加版本选择功能。

**Tech Stack:** React + TypeScript + i18next

---

## 任务总览

| 任务 | 描述 |
|------|------|
| 1 | 添加空状态引导组件 |
| 2 | 实现版本卡片展开/折叠功能 |
| 3 | 添加版本预览功能 |
| 4 | 修改新建分支弹窗支持基于版本创建 |
| 5 | 添加 i18n 文案 |
| 6 | 测试并修复问题 |

---

### 任务 1: 添加空状态引导组件

**Files:**
- Modify: `src/components/VersionManager.tsx`

**Step 1: 查看当前空状态代码**

在 VersionManager.tsx 中找到版本列表为空时的显示区域（约第 350 行）：

```tsx
{versions.length === 0 ? (
  <div className="text-center text-base-content/50 py-8">
    <FontAwesomeIcon icon={faHistory} className="text-4xl mb-2" />
    <p>{t("messages:versionControl.noVersions")}</p>
  </div>
) : ...}
```

**Step 2: 替换为空状态引导组件**

```tsx
{versions.length === 0 ? (
  <div className="flex-1 flex flex-col items-center justify-center p-4">
    <div className="text-center max-w-xs">
      <FontAwesomeIcon icon={faHistory} className="text-5xl mb-4 text-base-content/30" />
      <h4 className="font-semibold text-lg mb-2">{t("messages:versionControl.emptyStateTitle")}</h4>
      <p className="text-base-content/60 mb-4">{t("messages:versionControl.emptyStateDesc")}</p>
      <button
        className="btn btn-primary"
        onClick={() => setShowSaveModal(true)}
      >
        <FontAwesomeIcon icon={faPlus} className="mr-2" />
        {t("messages:versionControl.saveFirstVersion")}
      </button>
    </div>
  </div>
) : ...}
```

**Step 3: 提交**

```bash
git add src/components/VersionManager.tsx
git commit -m "feat: add empty state guidance for version management"
```

---

### 任务 2: 实现版本卡片展开/折叠功能

**Files:**
- Modify: `src/components/VersionManager.tsx`

**Step 1: 添加展开状态**

在组件中添加状态：

```tsx
const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
```

**Step 2: 添加展开/折叠处理函数**

```tsx
const handleToggleExpand = (versionId: string) => {
  setExpandedVersionId(prev => prev === versionId ? null : versionId);
};
```

**Step 3: 修改版本卡片渲染**

将版本卡片从 `div` 改为可展开的结构：

```tsx
{versions.map(version => (
  <div
    key={version.id}
    className={`border-2 rounded-lg overflow-hidden transition-all ${
      selectedVersions.includes(version.id) ? "border-primary" : "border-base-300"
    }`}
  >
    {/* 卡片头部 - 始终显示 */}
    <div
      className="p-3 cursor-pointer hover:bg-base-200/50"
      onClick={() => handleToggleExpand(version.id)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FontAwesomeIcon
              icon={expandedVersionId === version.id ? faChevronDown : faChevronRight}
              className="text-xs text-base-content/50"
            />
            <span className="font-semibold">{version.name}</span>
          </div>
          <div className="text-sm text-base-content/60 ml-5">{formatDate(version.createdAt)}</div>
          {version.description && (
            <div className="text-sm mt-1 ml-5">{version.description}</div>
          )}
          <div className="text-xs text-base-content/50 mt-1 ml-5">
            {t("messages:versionControl.problemCount", { count: version.contest.problems.length })}
          </div>
        </div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-xs btn-outline"
            onClick={() => handleRestore(version.id)}
          >
            {t("messages:versionControl.restore")}
          </button>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => handleDeleteVersion(version.id)}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>
    </div>

    {/* 展开内容 - 条件渲染 */}
    {expandedVersionId === version.id && (
      <div className="border-t border-base-300 p-3 bg-base-200/30">
        <h5 className="font-medium text-sm mb-2">{t("messages:versionControl.problemList")}</h5>
        <ul className="space-y-1">
          {version.contest.problems.map((problem, idx) => (
            <li key={idx} className="text-sm flex items-center gap-2">
              <span className="font-medium">{problem.problem.display_id}.</span>
              <span>{problem.problem.display_name}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
))}
```

**Step 4: 添加缺失的 icon**

在 import 中添加：

```tsx
import { faPlus, faTrash, faCodeBranch, faHistory, faDownload, faUpload, faCompress, faX, faChevronRight, faChevronDown } from "@fortawesome/free-solid-svg-icons";
```

**Step 5: 提交**

```bash
git add src/components/VersionManager.tsx
git commit -m "feat: add version card expand/collapse functionality"
```

---

### 任务 3: 添加版本预览功能（题目内容预览）

**Files:**
- Modify: `src/components/VersionManager.tsx`

**Step 1: 添加题目内容预览状态**

```tsx
const [previewProblemIndex, setPreviewProblemIndex] = useState<number | null>(null);
```

**Step 2: 修改展开区域，添加题目内容预览**

在展开区域内添加题目内容预览：

```tsx
{expandedVersionId === version.id && (
  <div className="border-t border-base-300 p-3 bg-base-200/30">
    <h5 className="font-medium text-sm mb-2">{t("messages:versionControl.problemList")}</h5>
    <ul className="space-y-1">
      {version.contest.problems.map((problem, idx) => (
        <li key={idx} className="text-sm">
          <button
            className="flex items-center gap-2 hover:text-primary w-full text-left"
            onClick={() => setPreviewProblemIndex(previewProblemIndex === idx ? null : idx)}
          >
            <FontAwesomeIcon
              icon={previewProblemIndex === idx ? faChevronDown : faChevronRight}
              className="text-xs"
            />
            <span className="font-medium">{problem.problem.display_id}.</span>
            <span>{problem.problem.display_name}</span>
          </button>
          {previewProblemIndex === idx && (
            <div className="mt-2 p-2 bg-base-100 rounded text-xs font-mono max-h-32 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{problem.statement.description?.slice(0, 500)}{problem.statement.description && problem.statement.description.length > 500 ? "..." : ""}</pre>
            </div>
          )}
        </li>
      ))}
    </ul>
  </div>
)}
```

**Step 3: 提交**

```bash
git add src/components/VersionManager.tsx
git commit -m "feat: add problem content preview in version details"
```

---

### 任务 4: 修改新建分支弹窗支持基于版本创建

**Files:**
- Modify: `src/components/VersionManager.tsx`

**Step 1: 添加分支创建时的版本选择状态**

```tsx
const [branchBaseType, setBranchBaseType] = useState<"empty" | "version">("empty");
const [selectedBaseVersionId, setSelectedBaseVersionId] = useState<string>("");
```

**Step 2: 修改新建分支 Modal**

找到新建分支 Modal（约第 440 行），替换为：

```tsx
{showNewBranchModal && (
  <div className="modal modal-open">
    <div className="modal-box">
      <h3 className="font-bold text-lg">{t("messages:versionControl.newBranch")}</h3>
      <div className="form-control mt-4">
        <label className="label"><span className="label-text">{t("messages:versionControl.branchName")}</span></label>
        <input
          type="text"
          className="input input-bordered"
          value={newBranchName}
          onChange={e => setNewBranchName(e.target.value)}
          placeholder="draft-A"
        />
      </div>

      {/* 基于版本选择 */}
      <div className="form-control mt-4">
        <label className="label"><span className="label-text">{t("messages:versionControl.branchBase")}</span></label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="branchBase"
              className="radio radio-primary"
              checked={branchBaseType === "empty"}
              onChange={() => { setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}
            />
            <span>{t("messages:versionControl.branchBaseEmpty")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="branchBase"
              className="radio radio-primary"
              checked={branchBaseType === "version"}
              onChange={() => setBranchBaseType("version")}
            />
            <span>{t("messages:versionControl.branchBaseVersion")}</span>
          </label>
          {branchBaseType === "version" && (
            <select
              className="select select-bordered mt-2"
              value={selectedBaseVersionId}
              onChange={e => setSelectedBaseVersionId(e.target.value)}
            >
              <option value="">{t("messages:versionControl.selectVersion")}</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>{v.name} - {formatDate(v.createdAt)}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="modal-action">
        <button className="btn btn-ghost" onClick={() => { setShowNewBranchModal(false); setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}>{t("common:cancel")}</button>
        <button className="btn btn-primary" onClick={handleCreateBranch}>{t("common:create")}</button>
      </div>
    </div>
    <div className="modal-backdrop" onClick={() => { setShowNewBranchModal(false); setBranchBaseType("empty"); setSelectedBaseVersionId(""); }}></div>
  </div>
)}
```

**Step 3: 修改 handleCreateBranch 函数**

```tsx
const handleCreateBranch = async () => {
  if (!newBranchName.trim()) return;

  const branchId = crypto.randomUUID();

  if (branchBaseType === "version" && selectedBaseVersionId) {
    // 从版本创建：复制版本的 contest 数据到新分支
    const baseVersion = await getVersion(selectedBaseVersionId);
    if (baseVersion) {
      // 创建新版本，基于选中的版本
      await saveVersion({
        id: crypto.randomUUID(),
        name: baseVersion.name,
        description: baseVersion.description,
        createdAt: Date.now(),
        branchId,
        contest: baseVersion.contest,
        images: baseVersion.images,
      });
    }
  }

  await saveBranch({
    id: branchId,
    name: newBranchName,
    createdAt: Date.now(),
    currentVersionId: selectedBaseVersionId || "",
  });

  setShowNewBranchModal(false);
  setNewBranchName("");
  setBranchBaseType("empty");
  setSelectedBaseVersionId("");

  // Refresh branches
  const newBranches = await getAllBranches();
  setBranches(newBranches);
  setSelectedBranchId(newBranches[newBranches.length - 1].id);
  showToast(t("messages:versionControl.branchCreated"));
};
```

**Step 4: 提交**

```bash
git add src/components/VersionManager.tsx
git commit -m "feat: support creating branch from existing version"
```

---

### 任务 5: 添加 i18n 文案

**Files:**
- Modify: `src/i18n/locales/zh/messages.json`
- Modify: `src/i18n/locales/en/messages.json`

**Step 1: 在中文文案中添加**

在 versionControl 对象中添加：

```json
"emptyStateTitle": "还没有版本记录",
"emptyStateDesc": "保存第一个版本，记录当前的比赛内容",
"saveFirstVersion": "保存当前版本",
"problemCount": "包含 {count} 道题目",
"problemList": "题目列表",
"branchBase": "基于",
"branchBaseEmpty": "空白创建",
"branchBaseVersion": "从版本创建",
"selectVersion": "选择版本"
```

**Step 2: 在英文文案中添加**

```json
"emptyStateTitle": "No versions yet",
"emptyStateDesc": "Save your first version to track your contest progress",
"saveFirstVersion": "Save Current Version",
"problemCount": "{count} problems",
"problemList": "Problem List",
"branchBase": "Based on",
"branchBaseEmpty": "Create from empty",
"branchBaseVersion": "Create from version",
"selectVersion": "Select version"
```

**Step 3: 提交**

```bash
git add src/i18n/locales/zh/messages.json src/i18n/locales/en/messages.json
git commit -m "feat: add i18n strings for version control improvements"
```

---

### 任务 6: 测试并修复问题

**Step 1: 运行构建测试**

```bash
npm run build
```

**Step 2: 验证功能**

1. 打开开发者工具，访问版本管理
2. 测试空状态引导是否显示
3. 测试保存版本功能
4. 测试版本卡片展开/折叠
5. 测试题目内容预览
6. 测试从版本创建分支

**Step 3: 提交**

```bash
git add .
git commit -m "fix: resolve any issues found during testing"
```

---

## 实现顺序

1. 任务 1: 添加空状态引导组件
2. 任务 2: 实现版本卡片展开/折叠功能
3. 任务 3: 添加版本预览功能
4. 任务 4: 修改新建分支弹窗支持基于版本创建
5. 任务 5: 添加 i18n 文案
6. 任务 6: 测试并修复问题

---

**Plan complete and saved to `docs/plans/2026-02-18-version-control-improvements.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
