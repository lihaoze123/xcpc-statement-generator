# 单独导出题目 PDF - 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 支持单独导出某一道题目为 PDF，导出内容与预览一致

**Architecture:** 复用现有编译 worker，新增 problemKey 参数来编译单题；在 Sidebar 右键菜单和 EditorArea 顶部添加导出按钮

**Tech Stack:** React + TypeScript + Typst

---

## Task 1: Worker 支持单题编译

**Files:**
- Modify: `src/compiler/compiler.worker.ts:129-183`

**Step 1: 修改 buildTypstDocument 函数支持 problemKey 参数**

在 `buildTypstDocument` 函数中添加可选的 `problemKey` 参数，如果提供则只编译该题目：

```typescript
function buildTypstDocument(contest: ContestWithImages, problemKey?: string): string {
  let problems = contest.problems;

  // 如果指定了 problemKey，则只编译该题目
  if (problemKey) {
    problems = problems.filter(p => p.key === problemKey);
  }

  const data = {
    // ... 保持其他字段不变
    problems: problems.map((p) => ({
      // ... 保持不变
    })),
    // 导出单题时禁用标题页和题号列表
    enableTitlepage: problemKey ? false : contest.meta.enable_titlepage,
    enableHeaderFooter: contest.meta.enable_header_footer,
    enableProblemList: problemKey ? false : contest.meta.enable_problem_list,
    // ...
  };

  // ... 保持其余代码不变
}
```

**Step 2: 修改 compileToPdf 支持 problemKey 参数**

```typescript
async function compileToPdf(contest: ContestWithImages, problemKey?: string): Promise<Uint8Array> {
  if (!isInitialized) throw new Error("Typst compiler not initialized");

  await addImagesToFilesystem(contest);

  const doc = buildTypstDocument(contest, problemKey);
  $typst.addSource("/main.typ", doc);

  const pdf = await $typst.pdf({ mainFilePath: "/main.typ" });
  if (!pdf) throw new Error("PDF compilation returned empty result");
  return pdf;
}
```

**Step 3: 在 message handler 中添加 compileProblem 类型**

```typescript
case "compileProblem": {
  const { contest, problemKey } = data;
  const pdf = await compileToPdf(contest, problemKey);
  self.postMessage({ id, success: true, data: pdf });
  break;
}
```

**Step 4: Commit**

```bash
git add src/compiler/compiler.worker.ts
git commit -m "feat: add single problem compilation support in worker"
```

---

## Task 2: 暴露 compileProblemToPdf API

**Files:**
- Modify: `src/compiler/index.ts:242-246`

**Step 1: 添加 compileProblemToPdf 函数**

```typescript
export const compileProblemToPdf = (data: ContestWithImages, problemKey: string): Promise<Uint8Array> =>
  sendMessage("compileProblem", { contest: data, problemKey });
```

**Step 2: Commit**

```bash
git add src/compiler/index.ts
git commit -m "feat: expose compileProblemToPdf API"
```

---

## Task 3: 添加国际化文本

**Files:**
- Modify: `src/i18n/locales/zh/common.json`
- Modify: `src/i18n/locales/en/common.json`
- Modify: `src/i18n/locales/zh/editor.json`
- Modify: `src/i18n/locales/en/editor.json`

**Step 1: 添加翻译文本**

在 `zh/common.json` 添加:
```json
{
  "exportProblem": "导出题目"
}
```

在 `en/common.json` 添加:
```json
{
  "exportProblem": "Export Problem"
}
```

在 `zh/editor.json` 添加:
```json
{
  "exportSuccess": "题目导出成功",
  "exportFailed": "题目导出失败"
}
```

在 `en/editor.json` 添加:
```json
{
  "exportSuccess": "Problem exported successfully",
  "exportFailed": "Problem export failed"
}
```

**Step 2: Commit**

```bash
git add src/i18n/locales/
git commit -m "feat: add i18n for export problem feature"
```

---

## Task 4: Sidebar 右键菜单添加导出选项

**Files:**
- Modify: `src/contestEditor/Sidebar.tsx:1-198`
- Modify: `src/contestEditor/index.tsx`

**Step 1: 在 Sidebar Props 中添加 onExportProblem**

```typescript
interface SidebarProps {
  // ... 现有 props
  onExportProblem?: (key: string) => void;
}
```

**Step 2: 在右键菜单中添加导出按钮**

在 `Sidebar.tsx` 的右键菜单中添加:

```typescript
<button
  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
  onClick={() => { onExportProblem?.(menuState.problemKey); closeMenu(); }}
>
  <FontAwesomeIcon icon={faFilePdf} className="w-4" />
  <span>{t('common:exportProblem')}</span>
</button>
```

需要导入 `faFilePdf` 图标。

**Step 3: 在 index.tsx 中传递 onExportProblem**

```typescript
<Sidebar
  // ... 其他 props
  onExportProblem={(key) => {
    const problem = contestData.problems.find(p => p.key === key);
    if (!problem) return;

    compileProblemToPdf(contestData, key)
      .then(pdf => {
        const blob = new Blob([pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const index = contestData.problems.findIndex(p => p.key === key);
        const letter = String.fromCharCode(65 + index);
        a.download = `${contestData.meta.title || "contest"}-${letter}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t('editor:exportSuccess'), 'success');
      })
      .catch(err => {
        showToast(t('editor:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
      });
  }}
/>
```

**Step 4: Commit**

```bash
git add src/contestEditor/Sidebar.tsx src/contestEditor/index.tsx
git commit -m "feat: add export problem option in sidebar context menu"
```

---

## Task 5: EditorArea 顶部添加导出按钮

**Files:**
- Modify: `src/contestEditor/EditorArea.tsx`
- Modify: `src/contestEditor/index.tsx`

**Step 1: 在 EditorArea Props 中添加 onExportCurrentProblem**

```typescript
interface EditorAreaProps {
  // ... 现有 props
  onExportCurrentProblem?: () => void;
}
```

**Step 2: 在 EditorArea 顶部添加工具栏按钮**

在 EditorArea 顶部工具栏（"比赛设置"按钮旁边）添加导出按钮：

```typescript
{onExportCurrentProblem && (
  <button
    className="btn btn-ghost btn-sm"
    onClick={onExportCurrentProblem}
    title={t('common:exportProblem')}
  >
    <FontAwesomeIcon icon={faFilePdf} />
  </button>
)}
```

**Step 3: 在 index.tsx 中传递 onExportCurrentProblem**

```typescript
<EditorArea
  // ... 其他 props
  onExportCurrentProblem={() => {
    if (!activeId || activeId === 'config') return;

    compileProblemToPdf(contestData, activeId)
      .then(pdf => {
        const blob = new Blob([pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const index = contestData.problems.findIndex(p => p.key === activeId);
        const letter = String.fromCharCode(65 + index);
        a.download = `${contestData.meta.title || "contest"}-${letter}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(t('editor:exportSuccess'), 'success');
      })
      .catch(err => {
        showToast(t('editor:exportFailed') + ': ' + (err instanceof Error ? err.message : String(err)), 'error');
      });
  }}
/>
```

**Step 4: Commit**

```bash
git add src/contestEditor/EditorArea.tsx src/contestEditor/index.tsx
git commit -m "feat: add export button in editor area toolbar"
```

---

## 验证步骤

1. 启动开发服务器 `npm run dev`
2. 创建一个比赛，添加至少一道题目
3. 测试右键菜单导出：
   - 在左侧题目列表右键点击某题
   - 选择"导出 PDF"
   - 验证下载的文件是否正确
4. 测试编辑区按钮导出：
   - 选中一道题目
   - 点击编辑区顶部的导出按钮
   - 验证下载的文件是否正确
5. 检查导出 PDF 内容是否为单题内容
