# 题目编辑器重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 彻底重构题目编辑器，使用 CodeMirror 替换 Monaco Editor，采用标签页导航，提供更大的编辑区域。

**Architecture:** 采用组件化设计，将 SingleProblemEditor 拆分为多个小组件：标签栏、编辑器面板、样例管理。使用 CodeMirror 6 作为编辑器核心，支持 markdown/latex/typst 语言。

**Tech Stack:** React 19, CodeMirror 6, @codemirror/lang-markdown, @codemirror/lang-latex, use-immer

---

### Task 1: 安装 CodeMirror 6 依赖

**Files:**
- Modify: `package.json`

**Step 1: 添加 CodeMirror 6 依赖**

```bash
npm install @codemirror/state @codemirror/view @codemirror/lang-markdown @codemirror/lang-latex @codemirror/language @codemirror/commands @codemirror/search
```

**Step 2: 验证安装**

Run: `npm list @codemirror/state @codemirror/view`
Expected: 显示已安装的版本

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add codemirror 6 dependencies"
```

---

### Task 2: 创建 CodeMirror 编辑器组件

**Files:**
- Create: `src/components/CodeMirrorEditor.tsx`

**Step 1: 创建基础 CodeMirror 组件**

```tsx
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { latex } from "@codemirror/lang-latex";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodeMirrorEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: "markdown" | "latex" | "typst" | "plaintext";
  placeholder?: string;
  minHeight?: string;
}

const getLanguageExtension = (lang: string) => {
  switch (lang) {
    case "markdown": return markdown();
    case "latex": return latex();
    case "typst": return latex(); // Typst uses LaTeX-like syntax
    default: return [];
  }
};

const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  language,
  minHeight = "200px"
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        onChange(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        getLanguageExtension(language),
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          "&": { minHeight },
          ".cm-scroller": { overflow: "auto" },
          ".cm-content": { fontSize: "14px", fontFamily: "monospace" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
  }, [language]);

  // Update content when value changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (currentValue !== value) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value }
        });
      }
    }
  }, [value]);

  return <div ref={containerRef} className="codemirror-container border border-gray-300 rounded-lg overflow-hidden" />;
};

export default CodeMirrorEditor;
```

**Step 2: 验证组件可以正常渲染**

Run: `npm run dev`
Expected: 开发服务器启动成功，无编译错误

**Step 3: Commit**

```bash
git add src/components/CodeMirrorEditor.tsx
git commit -m "feat: create CodeMirror editor component"
```

---

### Task 3: 创建标签栏组件

**Files:**
- Create: `src/components/TabBar.tsx`

**Step 1: 创建标签栏组件**

```tsx
import { FC } from "react";

export type TabId = "description" | "input" | "output" | "notes" | "samples";

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "description", label: "描述" },
  { id: "input", label: "输入" },
  { id: "output", label: "输出" },
  { id: "notes", label: "提示" },
  { id: "samples", label: "样例" },
];

const TabBar: FC<TabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex border-b border-gray-200 px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-[#1D71B7]"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1D71B7]" />
          )}
        </button>
      ))}
    </div>
  );
};

export default TabBar;
```

**Step 2: Commit**

```bash
git add src/components/TabBar.tsx
git commit -m "feat: create tab bar component"
```

---

### Task 4: 创建样例编辑器组件

**Files:**
- Create: `src/components/SamplesEditor.tsx`

**Step 1: 创建样例编辑器组件**

```tsx
import { FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTrash, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import CodeMirrorEditor from "./CodeMirrorEditor";
import type { Sample } from "@/types/contest";

interface SamplesEditorProps {
  samples: Sample[];
  onUpdate: (samples: Sample[]) => void;
}

const SamplesEditor: FC<SamplesEditorProps> = ({ samples, onUpdate }) => {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleAddSample = () => {
    onUpdate([...samples, { input: "", output: "" }]);
    setExpandedIndex(samples.length);
  };

  const handleDeleteSample = (index: number) => {
    const newSamples = samples.filter((_, i) => i !== index);
    onUpdate(newSamples);
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  };

  const handleUpdateSample = (index: number, field: "input" | "output", value: string) => {
    const newSamples = [...samples];
    newSamples[index] = { ...newSamples[index], [field]: value };
    onUpdate(newSamples);
  };

  return (
    <div className="space-y-3">
      {samples.map((sample, index) => (
        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2 bg-gray-50 cursor-pointer"
            onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
          >
            <span className="font-medium text-sm">
              {t('editor:sampleNumber', { number: index + 1 })}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-xs text-gray-400 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); handleDeleteSample(index); }}
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <FontAwesomeIcon
                icon={expandedIndex === index ? faChevronUp : faChevronDown}
                className="text-gray-400"
              />
            </div>
          </div>
          {expandedIndex === index && (
            <div className="p-4 space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('editor:input')}</label>
                <CodeMirrorEditor
                  value={sample.input}
                  onChange={(val) => handleUpdateSample(index, "input", val)}
                  language="plaintext"
                  minHeight="100px"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('editor:output')}</label>
                <CodeMirrorEditor
                  value={sample.output}
                  onChange={(val) => handleUpdateSample(index, "output", val)}
                  language="plaintext"
                  minHeight="100px"
                />
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        className="btn btn-outline btn-sm w-full"
        onClick={handleAddSample}
      >
        <FontAwesomeIcon icon={faPlus} className="mr-2" />
        {t('editor:addSample')}
      </button>
    </div>
  );
};

export default SamplesEditor;
```

**Step 2: Commit**

```bash
git add src/components/SamplesEditor.tsx
git commit -m "feat: create samples editor component"
```

---

### Task 5: 重构 EditorArea - 创建新的题目编辑器

**Files:**
- Modify: `src/contestEditor/EditorArea.tsx`

**Step 1: 重写 SingleProblemEditor 为新的结构**

```tsx
import { type FC, useState } from "react";
import type { ContestWithImages, Problem, ProblemFormat, Sample } from "@/types/contest";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import TabBar, { type TabId } from "@/components/TabBar";
import CodeMirrorEditor from "@/components/CodeMirrorEditor";
import SamplesEditor from "@/components/SamplesEditor";

interface SingleProblemEditorProps {
  problem: Problem;
  index: number;
  onUpdate: (updater: (p: Problem) => void) => void;
  onDelete: () => void;
}

const SingleProblemEditor: FC<SingleProblemEditorProps> = ({ problem, index, onUpdate, onDelete }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("description");

  const lang = problem.problem.format === "markdown" ? "markdown"
    : problem.problem.format === "typst" ? "typst"
    : "latex";

  const renderEditor = () => {
    switch (activeTab) {
      case "description":
        return (
          <CodeMirrorEditor
            value={problem.statement.description}
            onChange={(val) => onUpdate((p) => { p.statement.description = val; })}
            language={lang}
            minHeight="calc(100vh - 200px)"
          />
        );
      case "input":
        return (
          <CodeMirrorEditor
            value={problem.statement.input || ""}
            onChange={(val) => onUpdate((p) => { p.statement.input = val; })}
            language={lang}
            minHeight="calc(100vh - 200px)"
          />
        );
      case "output":
        return (
          <CodeMirrorEditor
            value={problem.statement.output || ""}
            onChange={(val) => onUpdate((p) => { p.statement.output = val; })}
            language={lang}
            minHeight="calc(100vh - 200px)"
          />
        );
      case "notes":
        return (
          <CodeMirrorEditor
            value={problem.statement.notes || ""}
            onChange={(val) => onUpdate((p) => { p.statement.notes = val; })}
            language={lang}
            minHeight="calc(100vh - 200px)"
          />
        );
      case "samples":
        return (
          <SamplesEditor
            samples={problem.problem.samples}
            onUpdate={(samples) => onUpdate((p) => { p.problem.samples = samples; })}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          {String.fromCharCode(65 + index)}. {problem.problem.display_name}
        </h2>
        <div className="flex items-center gap-2">
          <select
            className="select select-bordered select-sm w-32"
            value={problem.problem.format || "latex"}
            onChange={(e) => onUpdate((p) => { p.problem.format = e.target.value as ProblemFormat; })}
          >
            <option value="latex">LaTeX</option>
            <option value="markdown">Markdown</option>
            <option value="typst">Typst</option>
          </select>
          <button
            className="btn btn-sm btn-ghost text-gray-400 hover:text-red-500"
            onClick={onDelete}
            title={t('common:delete')}
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </div>

      {/* Problem Name */}
      <div className="px-4 py-3 border-b border-gray-100">
        <input
          type="text"
          className="input input-bordered w-full"
          value={problem.problem.display_name}
          onChange={(e) => onUpdate((p) => { p.problem.display_name = e.target.value; })}
          placeholder={t('editor:problemName')}
        />
      </div>

      {/* Tab Bar */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden p-4">
        {renderEditor()}
      </div>
    </div>
  );
};
```

**Step 2: 运行验证**

Run: `npm run dev`
Expected: 编辑器正常显示，标签页可以切换

**Step 3: Commit**

```bash
git add src/contestEditor/EditorArea.tsx
git commit -m "refactor: rewrite problem editor with tab navigation"
```

---

### Task 6: 调整编辑器样式

**Files:**
- Create: `src/components/CodeMirrorEditor.css`
- Modify: `src/contestEditor/index.css`

**Step 1: 创建 CodeMirror 样式文件**

```css
.codemirror-container {
  background-color: #fff;
}

.codemirror-container .cm-editor {
  height: 100%;
}

.codemirror-container .cm-scroller {
  font-family: 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace;
}

.codemirror-container .cm-gutters {
  background-color: #f9fafb;
  border-right: 1px solid #e5e7eb;
  color: #9ca3af;
}

.codemirror-container .cm-activeLineGutter {
  background-color: #f3f4f6;
}

.codemirror-container .cm-activeLine {
  background-color: #f9fafb;
}
```

**Step 2: 在 EditorArea 中引入样式**

在 CodeMirrorEditor.tsx 中添加：
```tsx
import "./CodeMirrorEditor.css";
```

**Step 3: Commit**

```bash
git add src/components/CodeMirrorEditor.css src/components/CodeMirrorEditor.tsx
git commit -m "style: add CodeMirror editor styles"
```

---

### Task 7: 验证整体功能

**Files:**
- 测试整个编辑流程

**Step 1: 测试标签页切换**

- 打开题目编辑器
- 点击各个标签页，确认切换正常

**Step 2: 测试编辑功能**

- 在描述标签页编辑内容
- 切换到其他标签页，再切回来，内容应该保留

**Step 3: 测试样例管理**

- 切换到样例标签页
- 添加新样例
- 删除样例
- 展开/折叠样例

**Step 4: 测试预览区联动**

- 隐藏预览区，验证编辑器自动扩展
- 显示预览区，验证布局正常

**Step 5: Commit**

```bash
git commit -m "test: verify editor functionality"
```

---

### Task 8: 最终提交

**Step 1: 检查状态**

```bash
git status
```

**Step 2: 提交所有更改**

```bash
git add -A
git commit -m "feat: refactor problem editor with CodeMirror and tab navigation"
```
