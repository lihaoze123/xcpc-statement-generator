# XCPC Statement Generator

[![Gitea Stars](https://img.shields.io/github/stars/lihaoze123/xcpc-statement-generator)](https://github.com/lihaoze123/xcpc-statement-generator)
[![GitHub Release](https://img.shields.io/github/v/release/lihaoze123/xcpc-statement-generator)](https://github.com/lihaoze123/xcpc-statement-generator/releases/latest)
[![GitHub last commit (dev branch)](<https://img.shields.io/github/last-commit/lihaoze123/xcpc-statement-generator/main?label=last%20commit%20(main%20branch)>)](https://github.com/lihaoze123/xcpc-statement-generator/commits/main/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lihaoze123/xcpc-statement-generator)

一个基于 Web 的 XCPC 竞赛题目册生成器，支持在浏览器中将 Typst/Markdown/LaTeX 格式的题目转化为专业的 XCPC 风格 PDF 文件。

![screenshot](assets/screenshot.png)

## ✨ 特性

- **🌐 浏览器原生运行**：无需后端服务器，完全在浏览器中运行
- **📝 多格式支持**：支持 Typst、Markdown、LaTeX 三种题面格式
- **⚡ 实时预览**：即时编译预览，所见即所得
- **🎨 专业排版**：几乎像素级复刻 XCPC 竞赛的题目册样式
- **🔧 灵活配置**：支持自定义竞赛信息、题目列表等元数据

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/lihaoze123/xcpc-statement-generator.git
cd xcpc-statement-generator

# 在 vite.config.ts 中配置 base 项为 ./

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

本项目采用 AGPL 3.0 许可证，详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- 灵感来源于 [cnoi-statement-generator](https://github.com/Mr-Python-in-China/cnoi-statement-generator) （部分代码有参考）
- 感谢 Typst 社区提供的优秀编译器