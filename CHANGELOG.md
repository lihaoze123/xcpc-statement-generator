# Changelog

All notable changes of this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-02-22

### Fixed
- 修改 typst 模板以匹配 olymp.sty 样式
- 将 FiraCode Nerd Font 替换为 CMU Typewriter Text
- 移除未使用的导入和变量

## [0.2.2] - 2026-02-19

### Added
- 云同步功能 - 支持将竞赛数据同步到云端（阿里云 OSS、腾讯云 COS、AWS S3）
- GitHub 目录支持 - 云同步时可选择 GitHub 仓库目录
- Tab/Shift+Tab 支持 - CodeMirror 编辑器的键盘导航
- 自定义模板编辑器 - 支持在设置中编辑自定义 Typst 模板
- 预览缩放功能 - Canvas 渲染预览并支持缩放

### Fixed
- 保存版本时未选择分支的错误提示

## [0.2.1] - 2026-02-18

### Added
- 单题导出 PDF 功能（侧边栏右键菜单和编辑区工具栏）
- 响应式移动端布局及底部标签导航
- 竞赛编辑的版本控制系统（支持历史版本查看与回滚）

### Fixed
- 移除主容器外边距并改进底部导航栏样式
- 修复非输入内容可选择的问题

## [0.2.0] - 2026-02-18

### Added
- 侧边栏及问题管理功能
- 问题项右键上下文菜单
- 拖放排序功能
- 设置中的题目重排序选项
- 封面与题目独立语言设置
- 题目间页面跳转功能

### Changed
- 使用 CodeMirror 6 替换 Monaco 编辑器，并添加基于标签页的编辑器
- 从 Ant Design 迁移至 daisyUI + Tailwind CSS
- 重新组织竞赛编辑器结构

### Fixed
- 编辑器切换渗透及单一问题预览问题
- 首次导入和刷新时图片加载失败的竞态条件
- 拖放排序状态的问题键生成问题

## [0.1.5] - 2025-12-11

### Added
- 可折叠题目卡片
- 拖放排序支持

## [0.1.4] - 2025-12-10

### Added
- 国际化（i18n）支持
- 封面与题目独立语言设置

## [0.1.3] - 2025-12-08

### Added
- 多语言支持
- 图片上传功能

### Fixed
- 宋体粗体样式支持

## [0.1.2] - 2025-12-08

### Added
- Monaco 编辑器集成
- 格式支持增强

## [0.1.1] - 2025-12-04

### Added
- Polygon 包导入功能
- GitHub Pages 部署工作流

## [0.1.0] - 2025-11-27

### Added
- 初始版本发布
- Typst 编译器集成
- 竞赛编辑器核心功能
