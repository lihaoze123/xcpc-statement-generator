# Footer 设计文档

## 概述

在应用页面底部添加 footer，显示作者信息、版本号和 GitHub 仓库链接。

## 需求

- 在页面底部显示 footer
- 显示 GitHub 仓库链接和图标
- 显示应用名称（来自 package.json）
- 显示版本号（来自 package.json）
- 显示 Git commit hash
- 显示 "Developed by chumeng with ❤️"

## 实现方案

### 1. src/App.tsx

添加 footer 组件：

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { name as appName, version as appVersion } from "../../package.json";

// 在 return 中添加：
<footer>
  <div>
    <a href="https://github.com/lihaoze123/xcpc-statement-generator" target="_blank">
      <FontAwesomeIcon icon={faGithub} />
      {appName}
    </a>
    <span>v{appVersion}</span>
    <span>({GIT_COMMIT_INFO})</span>
  </div>
  <div>Developed by chumeng with ❤️</div>
</footer>
```

### 2. src/App.css

添加 footer 样式：

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

## 验收标准

- [x] Footer 显示在页面底部
- [x] 显示 GitHub 图标和仓库链接
- [x] 显示应用名称和版本号
- [x] 显示 Git commit hash
- [x] 显示 "Developed by chumeng with ❤️"
