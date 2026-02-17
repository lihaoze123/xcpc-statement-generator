# 单独导出题目 PDF - 设计文档

## 功能概述

支持单独导出某一道题目为 PDF，导出内容与当前预览区域显示的内容一致。

## 实现方案

### 1. 编译层面

新增 `compileProblemToPdf(data: ContestWithImages, problemKey: string): Promise<Uint8Array>` 函数：
- 复用现有的 `compiler/index.ts` 和 `compiler.worker.ts`
- worker 接收 problemKey 参数，编译时只处理该题目的内容
- 编译模板保持不变，只是输入数据只包含单题

### 2. 触发方式

**右键菜单**
- 在 Sidebar 的题目右键菜单中添加"导出 PDF"选项
- 现有右键菜单已有：编辑、删除

**编辑区按钮**
- 在 EditorArea 顶部添加导出按钮（与"比赛设置"按钮并排）

### 3. 文件命名

导出文件名格式: `{比赛标题}-{题目字母}.pdf`（如 `ICPC-2024-A.pdf`）

## 技术细节

### Worker 改造

在 `compiler.worker.ts` 中：
1. 接收 problemKey 参数
2. 从完整比赛数据中提取对应题目
3. 构造只含单题的 ContestWithImages 对象进行编译

### 组件修改

**Sidebar.tsx**
- 右键菜单添加导出按钮
- 接收新的 onExportProblem 回调

**EditorArea.tsx**
- 顶部工具栏添加导出按钮
- 接收新的 onExportProblem 回调

**contestEditor/index.tsx**
- 实现 onExportProblem 回调
- 调用 compileProblemToPdf 并触发下载
