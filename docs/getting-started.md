# Getting Started with HexCore IDE

This guide will help you get started with HexCore IDE for malware analysis and reverse engineering.

---

## Installation

### Windows

1. Download `HexCore-win32-x64.zip` from the [Releases](https://github.com/LXrdKnowkill/HikariSystem-HexCore/releases) page
2. Extract to your preferred location (e.g., `C:\HexCore`)
3. Run `HexCore.exe`
4. (Optional) Add to PATH for command-line access

### Linux

1. Download `HexCore-linux-x64.tar.gz` from the [Releases](https://github.com/LXrdKnowkill/HikariSystem-HexCore/releases) page
2. Extract: `tar -xzvf HexCore-linux-x64.tar.gz`
3. Run: `./hexcore`
4. (Optional) Create desktop shortcut

---

## First Steps

### Opening a File for Analysis

1. Open HexCore IDE
2. Use **File > Open** or drag-and-drop a file
3. Right-click the file in the Explorer panel
4. Select one of the HexCore commands:
   - **HexCore: Open Hex View** - Binary viewer
   - **HexCore: Analyze PE File** - For .exe/.dll files
   - **HexCore: Calculate File Hashes** - Get checksums
   - **HexCore: Extract Strings** - Find text strings
   - **HexCore: Entropy Graph** - Detect encryption
   - **HexCore: Decode Base64** - Find encoded data
   - **HexCore: Detect File Type** - Magic bytes analysis

---

## Analyzing a Malware Sample

### Step 1: Calculate Hashes

1. Right-click the file
2. Select **HexCore: Calculate File Hashes**
3. Choose **Quick (MD5+SHA256)** for fast lookup
4. Click the VirusTotal link to check reputation

### Step 2: Check File Type

1. Right-click the file
2. Select **HexCore: Detect File Type**
3. Verify the extension matches the detected type
4. Look for **WARNING** if extension is mismatched

### Step 3: Analyze Entropy

1. Right-click the file
2. Select **HexCore: Entropy Graph**
3. High entropy (>7.0) may indicate:
   - Encryption
   - Compression
   - Packing (UPX, VMProtect, etc.)

### Step 4: Extract Strings

1. Right-click the file
2. Select **HexCore: Extract Strings**
3. Enter minimum length (4 recommended)
4. Look for interesting categories:
   - URLs and IP addresses
   - Registry keys
   - File paths
   - Suspicious keywords

### Step 5: PE Analysis (Windows Executables)

1. Right-click .exe or .dll file
2. Select **HexCore: Analyze PE File**
3. Review:
   - Headers and timestamps
   - Imported DLLs and functions
   - Section entropy
   - Packer detection results
   - Suspicious strings

---

## Tips for Malware Analysis

- **Always analyze in a VM** - Never run suspicious files on your main machine
- **Check VirusTotal first** - Hash lookup before deep analysis
- **High entropy = suspicious** - Most executables have entropy 5-6
- **Watch for packed files** - UPX, Themida, VMProtect detected automatically
- **Export to JSON** - Save PE analysis for documentation

---

## Next Steps

- Read the [Extensions Guide](extensions-guide.md) for detailed feature documentation
- Check [Keyboard Shortcuts](keyboard-shortcuts.md) for productivity tips
- See [Troubleshooting](troubleshooting.md) if you encounter issues

---

**HikariSystem HexCore IDE** - Built for Security Professionals
