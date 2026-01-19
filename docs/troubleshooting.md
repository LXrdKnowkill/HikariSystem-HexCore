# Troubleshooting

Common issues and solutions for HexCore IDE.

---

## Installation Issues

### Windows: Missing Visual C++ Redistributable

**Error:** "VCRUNTIME140.dll not found"

**Solution:**
1. Download [Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)
2. Install and restart HexCore

---

### Linux: Missing dependencies

**Error:** "libsecret" or "libkrb5" not found

**Solution:**
```bash
# Ubuntu/Debian
sudo apt install libsecret-1-0 libkrb5-3

# Fedora/RHEL
sudo dnf install libsecret krb5-libs
```

---

## Extension Issues

### PE Analyzer: "Not a valid PE file"

**Cause:** File is not a Windows executable or is corrupted.

**Solution:**
1. Verify file is actually a PE file
2. Check with File Type Detector first
3. Try opening in Hex Viewer to inspect headers

---

### Strings Extractor: Slow on large files

**Cause:** Very large files (>1GB) take time to process.

**Solution:**
1. Extension uses 64KB streaming - wait for completion
2. Progress percentage shown in notification
3. Cancel with the X button if needed

---

### Hash Calculator: Taking too long

**Cause:** Large files require more time.

**Solution:**
1. Use **Quick (MD5+SHA256)** instead of All
2. For quick checks, use **Quick Hash (SHA-256)** command

---

## Performance Issues

### High memory usage

**Cause:** Many files open or large files.

**Solution:**
1. Close unused editors
2. Hex Viewer uses virtual scrolling - memory is managed
3. Restart HexCore if needed

---

### Slow startup

**Cause:** First launch compiles extensions.

**Solution:**
1. Wait for initial compilation
2. Subsequent launches will be faster
3. Extensions are cached

---

## Reporting Issues

If you encounter bugs:

1. Check [existing issues](https://github.com/LXrdKnowkill/HikariSystem-HexCore/issues)
2. Open new issue with:
   - HexCore version
   - Operating system
   - Steps to reproduce
   - Error messages (if any)

---

**HikariSystem HexCore IDE** - Built for Security Professionals
