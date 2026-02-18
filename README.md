# XCPC Statement Generator

[![Gitea Stars](https://img.shields.io/github/stars/lihaoze123/xcpc-statement-generator)](https://github.com/lihaoze123/xcpc-statement-generator)
[![GitHub Release](https://img.shields.io/github/v/release/lihaoze123/xcpc-statement-generator)](https://github.com/lihaoze123/xcpc-statement-generator/releases/latest)
[![GitHub last commit (dev branch)](<https://img.shields.io/github/last-commit/lihaoze123/xcpc-statement-generator/main?label=last%20commit%20(main%20branch)>)](https://github.com/lihaoze123/xcpc-statement-generator/commits/main/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/lihaoze123/xcpc-statement-generator)

**[English](README.md) | [中文(Chinese)](README.cn.md)**

A web-based XCPC contest statement generator that converts Typst/Markdown/LaTeX format problems into professional XCPC-style PDF files directly in your browser.

![screenshot](assets/screenshot.png)

## ✨ Features

- **🌐 Native Browser Runtime**: No backend server required, runs entirely in your browser
- **📦 Polygon Package Import**: Direct import support for contest packages exported from Codeforces Polygon system
- **📝 Multi-format Support**: Supports Typst, Markdown, and LaTeX problem statement formats
- **⚡ Real-time Preview**: Instant compilation and preview with WYSIWYG editing
- **🎨 Professional Typesetting**: Almost pixel-perfect replica of XCPC contest statement styles
- **🔧 Flexible Configuration**: Support for custom contest information, problem lists, and other metadata
- **📄 Single Problem Export**: Export individual problems as separate PDF files
- **📱 Mobile Support**: Responsive layout with bottom navigation for mobile devices
- **📚 Version Control**: Save, restore, and compare contest versions with diff view
- **🔍 Vim Mode**: Optional Vim keybindings in the code editor

## 🚀 Quick Start

### Using Polygon Package Import

1. Export the contest package from the Codeforces Polygon system (ZIP format)
2. Click the **"Import Polygon Package"** button in the application
3. Select the downloaded ZIP file and wait for parsing to complete
4. Edit and refine problem information, then export the PDF file

### Local Development

```bash
# Clone the repository
git clone https://github.com/lihaoze123/xcpc-statement-generator.git
cd xcpc-statement-generator

# Configure the base item as ./ in vite.config.ts

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📄 License

This project is licensed under AGPL 3.0. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [cnoi-statement-generator](https://github.com/Mr-Python-in-China/cnoi-statement-generator) (some code referenced)
- Thanks to the Typst community for providing the excellent compiler