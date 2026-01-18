# HikariSystem HexCore

<p align="center">
  <img alt="HikariSystem HexCore" src="BatHexCore.png" width="200">
</p>

<p align="center">
  <strong>A modern, open-source code editor</strong>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#installation">Installation</a> |
  <a href="#building-from-source">Building</a> |
  <a href="#contributing">Contributing</a> |
  <a href="#license">License</a>
</p>

---

## Overview

**HikariSystem HexCore** is an open-source code editor built on the Visual Studio Code foundation. It combines powerful editing capabilities with a streamlined, customizable experience for developers.

## Features

- **IntelliSense**: Smart code completion for variables, methods, and modules
- **Debugging**: Built-in debugging support for multiple languages
- **Git Integration**: Native source control management
- **Extensions**: Compatible with the VS Code extension marketplace
- **Cross-Platform**: Available for Windows, macOS, and Linux
- **Customizable**: Extensive theming and configuration options

## Installation

### Pre-built Binaries

Download the latest release from the [Releases](https://github.com/LXrdKnowkill/HikariSystem-HexCore/releases) page.

### Building from Source

#### Prerequisites

- [Node.js](https://nodejs.org) v22.x or later
- [Git](https://git-scm.com)
- [Python](https://python.org) 3.x
- C++ Build Tools:
  - **Windows**: Visual Studio 2022 with "Desktop development with C++" workload
  - **macOS**: Xcode Command Line Tools
  - **Linux**: GCC and related build tools

#### Build Instructions

```bash
# Clone the repository
git clone https://github.com/LXrdKnowkill/HikariSystem-HexCore.git
cd HikariSystem-HexCore

# Install dependencies
npm install

# Compile the source
npm run compile

# Run the application
./scripts/code.bat      # Windows
./scripts/code.sh       # macOS/Linux
```

#### Building Installers

```bash
# Windows x64
npm run gulp vscode-win32-x64

# macOS x64
npm run gulp vscode-darwin-x64

# Linux x64
npm run gulp vscode-linux-x64
```

## Development

### Project Structure

```
HikariSystem-HexCore/
├── src/                    # Core source code
├── extensions/             # Built-in extensions
├── resources/              # Platform-specific resources
├── build/                  # Build scripts and configuration
└── out/                    # Compiled output
```

### Running Tests

```bash
npm run test
```

### Code Style

This project follows the coding guidelines established in the original VS Code repository. Please review the contribution guidelines before submitting changes.

## Contributing

Contributions are welcome. Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE.txt) file for details.

---

<p align="center">
  <strong>HikariSystem</strong>
</p>
