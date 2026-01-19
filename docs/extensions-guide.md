# HexCore Extensions Guide

Detailed documentation for each HexCore extension.

---

## Hex Viewer v1.2.0

The binary file viewer with professional features.

### Features

- **Virtual Scrolling** - Opens files of any size without loading entirely into memory
- **Data Inspector** - View selected bytes as various data types
- **Search** - Find hex patterns in the file
- **Go to Offset** - Jump directly to any position
- **Copy Selection** - Export as Hex, C Array, or Python bytes

### Data Inspector Types

| Type | Description |
|------|-------------|
| Int8/UInt8 | 8-bit signed/unsigned integer |
| Int16/UInt16 | 16-bit signed/unsigned integer |
| Int32/UInt32 | 32-bit signed/unsigned integer |
| Int64/UInt64 | 64-bit signed/unsigned integer |
| Float32 | 32-bit IEEE floating point |
| Float64 | 64-bit IEEE floating point |
| Binary | Binary representation |
| Unix Timestamp | Date from Unix epoch |

### Endianness

Toggle between Little Endian (LE) and Big Endian (BE) for multi-byte values.

---

## PE Analyzer v1.1.0

Comprehensive Portable Executable analysis.

### Supported Files

- `.exe` - Windows Executables
- `.dll` - Dynamic Link Libraries
- `.sys` - System Drivers
- `.ocx` - ActiveX Controls

### Analysis Sections

#### Headers
- **DOS Header** - MZ signature and PE offset
- **PE Header** - Machine type, timestamp, characteristics
- **Optional Header** - Entry point, image base, subsystem

#### Sections
Shows each PE section with:
- Name, virtual/raw size
- Entropy level
- Permissions (Read/Write/Execute)

#### Imports
Lists imported DLLs with their functions.

#### Security Analysis
- **ASLR** - Address Space Layout Randomization
- **DEP** - Data Execution Prevention
- **CFG** - Control Flow Guard

#### Packer Detection
Detects known packers:
- UPX, ASPack, PECompact
- Themida, VMProtect
- .NET obfuscators

### Export to JSON

Click **Export JSON** to save full analysis for documentation or automation.

---

## Hash Calculator v1.1.0

Calculate cryptographic hashes with algorithm selection.

### Algorithms

| Algorithm | Length | Use Case |
|-----------|--------|----------|
| MD5 | 32 chars | Legacy, VirusTotal |
| SHA-1 | 40 chars | Git, legacy |
| SHA-256 | 64 chars | Modern standard |
| SHA-512 | 128 chars | High security |

### Algorithm Selection

- **All** - Calculate all four algorithms
- **Quick (MD5+SHA256)** - Fast VirusTotal lookup
- **Individual** - Choose specific algorithm

### Quick Hash

Use **HexCore: Quick Hash (SHA-256)** for instant hash with clipboard copy.

### Hash Verification

Use **HexCore: Verify Hash** to compare a file against a known hash.

---

## Strings Extractor v1.1.0

Extract and categorize strings with memory-efficient streaming.

### Features

- **Streaming** - Processes files in 64KB chunks
- **ASCII and UTF-16LE** - Both encodings supported
- **Auto-categorization** - Groups by type
- **Configurable length** - Minimum 4 characters default

### Categories

| Category | Description |
|----------|-------------|
| URL | HTTP/HTTPS links |
| IP Address | IPv4 addresses |
| Email | Email addresses |
| File Path | Windows/Unix paths |
| Registry Key | HKEY_ entries |
| DLL | .dll filenames |
| Executable | .exe, .bat, etc. |
| Sensitive | Passwords, tokens, keys |
| WinAPI | Windows API functions |

---

## Entropy Analyzer v1.0.0

Visual entropy analysis for packer detection.

### Understanding Entropy

Entropy measures randomness/disorder in data (0-8 scale).

| Range | Meaning |
|-------|---------|
| 0-1 | Null bytes, repetitive |
| 1-3 | Simple text, patterns |
| 3-5 | Source code, text |
| 5-6.5 | Compiled code |
| 6.5-7.5 | Compressed (ZIP, PNG) |
| 7.5-8 | Encrypted/random |

### ASCII Graph

The report includes an ASCII graph showing entropy across the file.

### Packer Indicators

- High overall entropy (>7.5) = likely encrypted
- Mixed entropy = partial packing
- Single high-entropy section = encrypted payload

---

## Base64 Decoder v1.0.0

Detect and decode Base64 encoded strings.

### Detection

Automatically finds Base64 patterns (20+ characters).

### Output

- **Printable** - Decoded text shown directly
- **Binary** - Shows hex representation

### Use Cases

- Obfuscated PowerShell scripts
- Embedded payloads
- Hidden configurations

---

## File Type Detector v1.0.0

Identify true file type via magic bytes.

### Signature Database

50+ file signatures including:
- Executables (PE, ELF, Mach-O)
- Archives (ZIP, RAR, 7z, GZIP)
- Images (PNG, JPEG, GIF, BMP)
- Documents (PDF, Office, RTF)
- Audio/Video (MP3, MP4, AVI)
- Databases (SQLite)
- Virtual machines (VMDK, VDI)

### Extension Mismatch Warning

Shows **WARNING** when file extension doesn't match detected type - common malware technique.

---

**HikariSystem HexCore IDE** - Built for Security Professionals
