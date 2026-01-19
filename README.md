# HikariSystem HexCore

<p align="center">
  <img alt="HikariSystem HexCore" src="BatHexCore.png" width="200">
</p>

<p align="center">
  <strong>A specialized IDE for malware analysis and reverse engineering</strong>
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#extensions">Extensions</a> |
  <a href="#installation">Installation</a> |
  <a href="#usage">Usage</a> |
  <a href="#license">License</a>
</p>

---

## Features

HikariSystem HexCore is built on the VS Code foundation with custom extensions designed for security professionals:

- Professional binary file analysis
- PE executable parsing and inspection
- Cryptographic hash calculation
- String extraction and categorization
- Packer and obfuscation detection

---

## Extensions

### Hex Viewer v1.2.0
Professional binary file viewer with virtual scrolling for large files.

- **Virtual Scrolling** - Handles files of any size efficiently
- **Data Inspector** - View bytes as Int8/16/32/64, Float, Unix timestamp
- **Search** - Find hex patterns (e.g., `4D 5A` for PE headers)
- **Go to Offset** - Jump directly to any offset
- **Copy Selection** - Export as Hex, C Array, or Python bytes
- **Little/Big Endian** toggle

### PE Analyzer v1.1.0
Comprehensive Portable Executable analysis for Windows binaries.

- **DOS/PE/Optional Headers** - Complete header parsing
- **Sections** - Name, size, entropy, permissions (R/W/X)
- **Imports** - DLLs with imported functions
- **Entropy Analysis** - Visual entropy bar with compression detection
- **Packer Detection** - UPX, VMProtect, Themida, ASPack, and more
- **Suspicious Strings** - Automatic URL, IP, registry key extraction
- **Security Flags** - ASLR, DEP, CFG detection
- **Export to JSON** - Save analysis for external tools

### Hash Calculator v1.0.0
Fast file hashing with multiple algorithms.

- **Algorithms** - MD5, SHA-1, SHA-256, SHA-512
- **Verify Hash** - Compare file against known hash
- **VirusTotal Links** - Quick lookup for malware analysis
- **Progress Indicator** - For large files

### Strings Extractor v1.0.0
Extract and categorize strings from binary files.

- **ASCII and UTF-16LE** extraction
- **Auto-categorization**: URLs, IPs, file paths, registry keys, DLLs, Windows API functions, sensitive keywords
- **Configurable minimum length**
- **Markdown report** with tables

### Entropy Analyzer v1.0.0
Visual entropy analysis with ASCII graph for detecting packed or encrypted regions.

- **Block-by-block entropy** calculation
- **ASCII graph** visualization
- **High entropy region** detection
- **Packer/encryption** assessment
- **Entropy scale** reference

### Base64 Decoder v1.0.0
Detect and decode Base64 encoded strings in binary files.

- **Automatic detection** of Base64 patterns
- **Decodes** both printable text and binary data
- **Shows offset** location of each string
- **Categorizes** printable vs binary results

### File Type Detector v1.0.0
Identify true file type using magic bytes signature detection.

- **50+ file signatures** database
- **Extension mismatch** detection (security warning)
- **Categories**: Executable, Archive, Image, Document, Audio, Video, Database, Crypto
- **Magic bytes** display

---

## Installation

### Development Mode

```powershell
# Clone the repository
git clone https://github.com/LXrdKnowkill/HikariSystem-HexCore.git
cd HikariSystem-HexCore

# Install dependencies
npm install

# Run in development mode
$env:VSCODE_SKIP_NODE_VERSION_CHECK="1"
.\scripts\code.bat
```

### Requirements

- Node.js 18.x or higher
- npm 8.x or higher
- Windows 10/11
- Visual Studio Build Tools (for native modules)

---

## Usage

### Hex Viewer
- Open any file and select **"Open With..." > "HexCore Hex Editor"**
- Or right-click a file and select **"HexCore: Open Hex View"**

### PE Analyzer
- Right-click any `.exe`, `.dll`, `.sys`, or `.ocx` file
- Select **"HexCore: Analyze PE File"**
- View analysis in the sidebar panel

### Hash Calculator
- Right-click any file
- Select **"HexCore: Calculate File Hashes"**
- View MD5, SHA-1, SHA-256, SHA-512 in a new document

### Strings Extractor
- Right-click any file
- Select **"HexCore: Extract Strings"**
- Choose minimum string length
- View categorized strings report

---

## Project Structure

```
HikariSystem-HexCore/
├── extensions/
│   ├── hexcore-hexviewer/     # Binary file viewer
│   ├── hexcore-peanalyzer/    # PE file analyzer
│   ├── hexcore-hashcalc/      # Hash calculator
│   └── hexcore-strings/       # Strings extractor
├── src/                       # Core IDE source
├── resources/                 # Icons and assets
├── build/                     # Build scripts
└── product.json               # Product configuration
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the [LICENSE.txt](LICENSE.txt) file for details.

---

<p align="center">
  <strong>HikariSystem</strong> - Security Tools for Professionals
</p>
