# HikariSystem HexCore

<p align="center">
  <img alt="HikariSystem HexCore Logo" src="BatHexCore.png" width="256">
</p>

<p align="center">
  <strong>🦇 A next-generation code editor built for developers</strong>
</p>

<p align="center">
  <a href="https://github.com/LXrdknowkill/hexcore/issues">Report Bug</a>
  ·
  <a href="https://github.com/LXrdknowkill/hexcore/issues">Request Feature</a>
</p>

---

## About

**HikariSystem HexCore** is a powerful, open-source code editor forked from Visual Studio Code. Built with performance and developer experience in mind, HexCore combines the extensibility of VS Code with a unique identity and streamlined experience.

## Features

- 🚀 **Fast & Lightweight** - Optimized for speed and low memory usage
- 🧩 **Full Extension Support** - Compatible with the VS Code marketplace
- 🎨 **Beautiful Interface** - Dark theme optimized with the iconic purple bat logo
- 🔧 **Highly Customizable** - Make it yours with settings and extensions
- 💻 **Cross-Platform** - Windows, macOS, and Linux support

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) (v18.x or later)
- [Git](https://git-scm.com)
- [Python](https://python.org) (v3.x)
- C++ Build Tools (Windows: Visual Studio Build Tools, macOS: Xcode, Linux: gcc)

### Build Instructions

```bash
# Clone the repository
git clone https://github.com/LXrdknowkill/hexcore.git
cd hexcore

# Install dependencies
npm install

# Compile
npm run compile

# Run
npm run electron
```

### Building Installers

```bash
# Windows
npm run gulp vscode-win32-x64

# macOS
npm run gulp vscode-darwin-x64

# Linux
npm run gulp vscode-linux-x64
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Copyright (c) HikariSystem. All rights reserved.

Licensed under the [MIT](LICENSE.txt) license.

---

<p align="center">
  Made with 💜 by <strong>HikariSystem</strong>
</p>
