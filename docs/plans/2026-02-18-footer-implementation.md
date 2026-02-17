# Footer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在应用页面底部添加 footer，显示作者信息、版本号和 GitHub 仓库链接。

**Architecture:** 在 App.tsx 中添加 footer 组件，使用 App.css 定义样式。GIT_COMMIT_INFO 已在 vite.config.ts 中定义。

**Tech Stack:** React, TypeScript, FontAwesome

---

### Task 1: Modify src/App.tsx - 添加 footer 组件

**Files:**
- Modify: `src/App.tsx:1-21`

**Step 1: 添加 imports**

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { name as appName, version as appVersion } from "../package.json";
```

**Step 2: 修改 App 组件 return**

修改 `src/App.tsx` 的 return，将 `ContestEditor` 包裹在 main 中，并在后面添加 footer：

```tsx
<div className="w-screen h-screen overflow-hidden text-gray-800 flex flex-col">
  <main className="flex-1 min-h-0">
    <ContestEditor />
  </main>
  <footer>
    <div>
      <a
        href="https://github.com/lihaoze123/xcpc-statement-generator"
        target="_blank"
        rel="noopener noreferrer"
      >
        <FontAwesomeIcon icon={faGithub} className="mr-1" />
        {appName}
      </a>
      <span className="ml-2">v{appVersion}</span>
      <span className="ml-1">({GIT_COMMIT_INFO})</span>
    </div>
    <div>Developed by chumeng with ❤️</div>
  </footer>
</div>
```

**Step 3: 验证构建**

Run: `npm run build`
Expected: 构建成功，无错误

**Step 4: Commit**

Run: `git add src/App.tsx && git commit -m "feat: add footer with author info and version"`
---

### Task 2: Modify src/App.css - 添加 footer 样式

**Files:**
- Modify: `src/App.css:1-16`

**Step 1: 添加 footer 样式**

在 `src/App.css` 末尾添加：

```css
.app > footer {
  flex-shrink: 0;
  padding: 8px 16px;
  text-align: center;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app > footer a {
  color: inherit;
  text-decoration: none;
}

.app > footer a:hover {
  text-decoration: underline;
}

.app > footer > div:first-child {
  display: flex;
  justify-content: center;
  gap: 8px;
  align-items: center;
}
```

**Step 2: 验证样式**

Run: `npm run dev`
Expected: 页面底部显示 footer，内容正确

**Step 3: Commit**

Run: `git add src/App.css && git commit -m "feat: add footer styles"`
---

### Task 3: 验证功能

**Step 1: 验证显示内容**

- GitHub 图标和链接
- 应用名称和版本号
- Git commit hash
- "Developed by chumeng with ❤️"

**Step 2: Commit**

Run: `git add . && git commit -m "feat: add footer with author info and version (footer)"`
