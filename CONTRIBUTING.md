# Contributing to HexCore IDE

Thank you for your interest in contributing to HexCore IDE!

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Git
- Visual Studio Build Tools (Windows)

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/LXrdKnowkill/HikariSystem-HexCore.git
cd HikariSystem-HexCore

# Install dependencies
npm install

# Compile extensions
cd extensions/hexcore-hexviewer && npm install && npm run compile && cd ../..
cd extensions/hexcore-peanalyzer && npm install && npm run compile && cd ../..
# ... repeat for other extensions

# Run in development mode
./scripts/code.bat  # Windows
./scripts/code.sh   # Linux
```

---

## Project Structure

```
HikariSystem-HexCore/
├── extensions/           # HexCore extensions
│   ├── hexcore-hexviewer/
│   ├── hexcore-peanalyzer/
│   ├── hexcore-hashcalc/
│   ├── hexcore-strings/
│   ├── hexcore-entropy/
│   ├── hexcore-base64/
│   ├── hexcore-filetype/
│   └── hexcore-common/
├── docs/                 # Documentation
├── .github/workflows/    # CI/CD
├── product.json          # Product configuration
└── README.md
```

---

## Contributing Code

### 1. Fork the Repository

Create your own fork on GitHub.

### 2. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow TypeScript best practices
- No implicit `any` types
- Add comments for complex logic
- Test locally before submitting

### 4. Commit with Conventional Commits

```bash
git commit -m "feat: Add new feature"
git commit -m "fix: Resolve bug in PE parser"
git commit -m "docs: Update getting started guide"
```

### 5. Submit Pull Request

Push to your fork and open a PR against `main`.

---

## Extension Development

### Creating a New Extension

1. Copy an existing extension as template
2. Update `package.json` with new name and commands
3. Implement functionality in `src/extension.ts`
4. Add to `hexcore-build.yml` workflow
5. Update documentation

### Extension Guidelines

- Use streaming for large files
- Provide progress indicators
- Generate Markdown reports
- Handle errors gracefully
- No third-party dependencies (prefer Node.js built-ins)

---

## Code Style

- **TypeScript** - Strict mode enabled
- **Indentation** - Tabs
- **Semicolons** - Required
- **Types** - Explicit, no `any`
- **Comments** - English, JSDoc for public APIs

---

## Testing

### Local Testing

```bash
# Run HexCore in dev mode
./scripts/code.bat

# Test extension on sample files
# Right-click → HexCore commands
```

### CI Testing

All PRs must pass GitHub Actions checks:
- Build all extensions
- Lint TypeScript

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**HikariSystem** - Security Tools for Professionals
