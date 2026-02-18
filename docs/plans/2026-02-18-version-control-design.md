# 版本管理功能设计

**日期**: 2026-02-18

## 需求概述

为 XCPC Statement Generator 添加版本管理功能，支持：
1. 手动保存版本 - 用户主动创建快照，支持备注版本说明
2. 版本对比 - 展示版本间的差异（diff）
3. 分支管理 - 允许创建不同的版本分支（如 A 版、B 版）
4. 导出/导入 - 支持导出版本包，方便分享或备份

## 技术选型

| 功能 | 推荐库 | 说明 |
|------|--------|------|
| Diff 对比 | `diff` | 成熟的文本差异对比库 |
| UI 组件 | `daisyui` | 已在使用，用 timeline 展示版本线 |

## 数据结构

```typescript
// 版本/快照
interface Version {
  id: string;
  name: string;              // 版本名称（如 "v1.0"）
  description?: string;      // 版本说明
  createdAt: number;        // 时间戳
  branchId: string;         // 所属分支
  parentVersionId?: string; // 父版本（用于分支）
  contest: Contest;          // 比赛数据（不含图片 blob）
  images: ImageMeta[];      // 图片元数据
}

// 分支
interface Branch {
  id: string;
  name: string;             // 分支名（如 "main", "draft-A"）
  createdAt: number;
  currentVersionId: string;  // 当前版本 ID
}
```

## 存储方式

- **本地优先**: 使用 IndexedDB 存储
- **新增 Store**: `versions` 和 `branches` 两个 object store
- **导出格式**: JSON 文件（包含 branches + versions + images base64）

## 核心功能

| 功能 | 描述 |
|------|------|
| **保存版本** | 将当前 contest + images 序列化存储到 IndexedDB |
| **分支管理** | 从某版本创建新 branch 记录，指向该版本 |
| **版本回滚** | 从版本记录中恢复数据到当前编辑区 |
| **版本对比** | 用 `diff` 库对比两个版本的题目内容 |
| **导出/导入** | 将 versions + branches 导出为 JSON |

## UI 设计

在设置面板添加「版本管理」入口：

```
┌─────────────────────────────────────────┐
│  版本管理                          [X]  │
├──────────────┬──────────────────────────┤
│  分支列表    │  版本时间线              │
│  ─────────  │  ──────────────────────  │
│  ○ main    │  ● v1.0  2024-01-15     │
│  ○ draft-A │  ● v0.9  2024-01-10     │
│  ○ draft-B │  ● v0.5  2024-01-05     │
│             │                          │
│  [+ 新分支] │  [保存当前版本]           │
│             │                          │
│             │  [选择两个版本对比]       │
└──────────────┴──────────────────────────┘
```

- **Diff 视图**: 按题目逐个对比，绿色标注新增，红色标注删除

## 涉及文件

| 文件 | 改动 |
|------|------|
| `package.json` | 添加 `diff` 依赖 |
| `src/types/contest.ts` | 新增 Version, Branch 类型 |
| `src/utils/versionControl.ts` | 新建：版本管理的 CRUD 操作 |
| `src/components/VersionManager.tsx` | 新建：版本管理 UI 组件 |
| `src/contestEditor/index.tsx` | 添加入口和集成 |
| `src/i18n/` | 新增国际化文案 |

## 实现顺序

1. 添加 `diff` 依赖
2. 定义类型 + 版本控制工具函数
3. 版本保存/列表/恢复
4. 分支管理
5. 版本对比（diff）
6. 导出/导入
