/*---------------------------------------------------------------------------------------------
 *  HexCore Strings Extractor v1.1.0
 *  Extract ASCII and Unicode strings from binary files using streaming
 *  Copyright (c) HikariSystem. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedString {
	offset: number;
	value: string;
	encoding: 'ASCII' | 'UTF-16LE';
	category?: string;
}

// Chunk size: 64KB for streaming
const CHUNK_SIZE = 64 * 1024;

export function activate(context: vscode.ExtensionContext) {
	console.log('HexCore Strings Extractor v1.1.0 activated');

	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.strings.extract', async (uri?: vscode.Uri) => {
			if (!uri) {
				const files = await vscode.window.showOpenDialog({
					canSelectMany: false,
					canSelectFiles: true,
					title: 'Select file to extract strings from'
				});
				if (files && files.length > 0) {
					uri = files[0];
				} else {
					return;
				}
			}

			// Ask for minimum string length
			const minLengthInput = await vscode.window.showInputBox({
				prompt: 'Minimum string length',
				value: '4',
				validateInput: (val) => {
					const num = parseInt(val);
					if (isNaN(num) || num < 1 || num > 100) {
						return 'Please enter a number between 1 and 100';
					}
					return null;
				}
			});

			if (!minLengthInput) return;
			const minLength = parseInt(minLengthInput);

			await extractStringsWithStreaming(uri, minLength);
		})
	);
}

async function extractStringsWithStreaming(uri: vscode.Uri, minLength: number): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Extracting strings from ${fileName}...`,
		cancellable: true
	}, async (progress, token) => {
		try {
			const stats = fs.statSync(filePath);
			const totalSize = stats.size;

			// Use streaming for large files (>10MB) or always for safety
			const allStrings: ExtractedString[] = [];

			// State for cross-chunk string detection
			let asciiCarryover = '';
			let asciiCarryoverOffset = 0;
			let unicodeCarryover = Buffer.alloc(0);
			let unicodeCarryoverOffset = 0;

			// Open file for async reading
			const fd = fs.openSync(filePath, 'r');
			let offset = 0;

			try {
				while (offset < totalSize && !token.isCancellationRequested) {
					const bytesToRead = Math.min(CHUNK_SIZE, totalSize - offset);
					const buffer = Buffer.alloc(bytesToRead);
					fs.readSync(fd, buffer, 0, bytesToRead, offset);

					// Extract ASCII strings from chunk
					const { strings: asciiStrings, carryover: newAsciiCarryover, carryoverOffset: newAsciiOffset } =
						extractASCIIFromChunk(buffer, offset, minLength, asciiCarryover, asciiCarryoverOffset);
					allStrings.push(...asciiStrings);
					asciiCarryover = newAsciiCarryover;
					asciiCarryoverOffset = newAsciiOffset;

					// Extract Unicode strings from chunk
					const { strings: unicodeStrings, carryover: newUnicodeCarryover, carryoverOffset: newUnicodeOffset } =
						extractUnicodeFromChunk(buffer, offset, minLength, unicodeCarryover, unicodeCarryoverOffset);
					allStrings.push(...unicodeStrings);
					unicodeCarryover = Buffer.from(newUnicodeCarryover);
					unicodeCarryoverOffset = newUnicodeOffset;

					offset += bytesToRead;

					// Report progress
					const pct = Math.round((offset / totalSize) * 100);
					progress.report({ increment: (bytesToRead / totalSize) * 100, message: `${pct}% - ${allStrings.length} strings found` });

					// Limit total strings to prevent memory issues
					if (allStrings.length > 50000) {
						break;
					}
				}

				// Handle remaining carryover
				if (asciiCarryover.length >= minLength) {
					allStrings.push({
						offset: asciiCarryoverOffset,
						value: asciiCarryover.trim(),
						encoding: 'ASCII'
					});
				}

			} finally {
				fs.closeSync(fd);
			}

			if (token.isCancellationRequested) {
				vscode.window.showInformationMessage('String extraction cancelled.');
				return;
			}

			// Categorize strings
			categorizeStrings(allStrings);

			// Sort by offset and deduplicate
			allStrings.sort((a, b) => a.offset - b.offset);
			const uniqueStrings = deduplicateStrings(allStrings);

			// Generate report
			const content = generateStringsReport(fileName, filePath, totalSize, uniqueStrings, minLength);

			const doc = await vscode.workspace.openTextDocument({
				content: content,
				language: 'markdown'
			});

			await vscode.window.showTextDocument(doc, { preview: false });

		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to extract strings: ${error.message}`);
		}
	});
}

interface ChunkResult {
	strings: ExtractedString[];
	carryover: string;
	carryoverOffset: number;
}

interface UnicodeChunkResult {
	strings: ExtractedString[];
	carryover: Buffer;
	carryoverOffset: number;
}

function extractASCIIFromChunk(
	buffer: Buffer,
	baseOffset: number,
	minLength: number,
	carryover: string,
	carryoverOffset: number
): ChunkResult {
	const strings: ExtractedString[] = [];
	let currentString = carryover;
	let startOffset = carryover.length > 0 ? carryoverOffset : baseOffset;

	for (let i = 0; i < buffer.length; i++) {
		const byte = buffer[i];

		if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
			if (currentString.length === 0) {
				startOffset = baseOffset + i;
			}
			currentString += String.fromCharCode(byte);
		} else {
			if (currentString.length >= minLength) {
				const trimmed = currentString.trim();
				if (trimmed.length >= minLength) {
					strings.push({
						offset: startOffset,
						value: trimmed,
						encoding: 'ASCII'
					});
				}
			}
			currentString = '';
		}
	}

	return {
		strings,
		carryover: currentString,
		carryoverOffset: startOffset
	};
}

function extractUnicodeFromChunk(
	buffer: Buffer,
	baseOffset: number,
	minLength: number,
	carryover: Buffer,
	carryoverOffset: number
): UnicodeChunkResult {
	const strings: ExtractedString[] = [];

	// Combine carryover with new buffer
	const combined = carryover.length > 0 ? Buffer.concat([carryover, buffer]) : buffer;
	const combinedOffset = carryover.length > 0 ? carryoverOffset : baseOffset;

	let currentString = '';
	let startOffset = combinedOffset;

	for (let i = 0; i < combined.length - 1; i += 2) {
		const low = combined[i];
		const high = combined[i + 1];

		if (high === 0 && ((low >= 32 && low <= 126) || low === 9 || low === 10 || low === 13)) {
			if (currentString.length === 0) {
				startOffset = combinedOffset + i - (carryover.length > 0 ? carryover.length : 0) + baseOffset;
			}
			currentString += String.fromCharCode(low);
		} else {
			if (currentString.length >= minLength) {
				const trimmed = currentString.trim();
				if (trimmed.length >= minLength) {
					strings.push({
						offset: startOffset,
						value: trimmed,
						encoding: 'UTF-16LE'
					});
				}
			}
			currentString = '';
		}
	}

	// Handle odd byte at end
	const newCarryover = combined.length % 2 === 1 ? Buffer.from(combined.subarray(-1)) : Buffer.alloc(0);

	return {
		strings,
		carryover: newCarryover,
		carryoverOffset: baseOffset + buffer.length - 1
	};
}

function deduplicateStrings(strings: ExtractedString[]): ExtractedString[] {
	const seen = new Set<string>();
	return strings.filter(s => {
		const key = `${s.offset}-${s.value.substring(0, 50)}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function categorizeStrings(strings: ExtractedString[]): void {
	const patterns: Array<{ category: string; regex: RegExp }> = [
		{ category: 'URL', regex: /^https?:\/\//i },
		{ category: 'IP Address', regex: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/ },
		{ category: 'Email', regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ },
		{ category: 'File Path', regex: /^[a-zA-Z]:\\|^\\\\|^\/[a-zA-Z]/i },
		{ category: 'Registry Key', regex: /^HKEY_|^HKLM\\|^HKCU\\/i },
		{ category: 'DLL', regex: /\.dll$/i },
		{ category: 'Executable', regex: /\.(exe|com|bat|cmd|ps1|vbs|js)$/i },
		{ category: 'Sensitive', regex: /password|passwd|secret|token|api[_-]?key|credential/i },
		{ category: 'Function', regex: /^(Get|Set|Create|Delete|Read|Write|Open|Close|Load|Unload)[A-Z]/i },
		{ category: 'WinAPI', regex: /^(Nt|Zw|Rtl|Ldr|Crypt|Virtual|Heap|Process|Thread|Reg|File)/i },
	];

	for (const str of strings) {
		for (const pattern of patterns) {
			if (pattern.regex.test(str.value)) {
				str.category = pattern.category;
				break;
			}
		}
	}
}

function generateStringsReport(
	fileName: string,
	filePath: string,
	fileSize: number,
	strings: ExtractedString[],
	minLength: number
): string {
	const asciiCount = strings.filter(s => s.encoding === 'ASCII').length;
	const unicodeCount = strings.filter(s => s.encoding === 'UTF-16LE').length;

	// Group by category
	const categorized = new Map<string, ExtractedString[]>();
	for (const str of strings) {
		const cat = str.category || 'General';
		if (!categorized.has(cat)) {
			categorized.set(cat, []);
		}
		categorized.get(cat)!.push(str);
	}

	let report = `# HexCore Strings Extractor Report

## File Information

| Property | Value |
|----------|-------|
| **File Name** | ${fileName} |
| **File Path** | ${filePath} |
| **File Size** | ${formatBytes(fileSize)} |
| **Min Length** | ${minLength} characters |
| **Processing** | Streaming (memory efficient) |

---

## Summary

| Type | Count |
|------|-------|
| **ASCII Strings** | ${asciiCount} |
| **Unicode Strings** | ${unicodeCount} |
| **Total** | ${strings.length} |

---

## Interesting Strings by Category

`;

	// Priority order for categories
	const priorityCategories = ['URL', 'IP Address', 'Email', 'Registry Key', 'Sensitive', 'File Path', 'DLL', 'Executable', 'WinAPI', 'Function'];

	for (const cat of priorityCategories) {
		const items = categorized.get(cat);
		if (items && items.length > 0) {
			report += `### ${cat} (${items.length})\n\n`;
			report += '| Offset | Encoding | Value |\n';
			report += '|--------|----------|-------|\n';
			for (const item of items.slice(0, 50)) {
				const escapedValue = item.value.replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 80);
				report += `| 0x${item.offset.toString(16).toUpperCase().padStart(8, '0')} | ${item.encoding} | \`${escapedValue}\` |\n`;
			}
			if (items.length > 50) {
				report += `| ... | ... | *${items.length - 50} more* |\n`;
			}
			report += '\n';
		}
	}

	// General strings (limited)
	const generalStrings = categorized.get('General') || [];
	if (generalStrings.length > 0) {
		report += `### General Strings (showing first 100 of ${generalStrings.length})\n\n`;
		report += '| Offset | Encoding | Value |\n';
		report += '|--------|----------|-------|\n';
		for (const item of generalStrings.slice(0, 100)) {
			const escapedValue = item.value.replace(/\|/g, '\\|').replace(/\n/g, ' ').substring(0, 80);
			const truncated = item.value.length > 80 ? '...' : '';
			report += `| 0x${item.offset.toString(16).toUpperCase().padStart(8, '0')} | ${item.encoding} | \`${escapedValue}${truncated}\` |\n`;
		}
		report += '\n';
	}

	report += `---
*Generated by HexCore Strings Extractor v1.1.0 (Streaming)*
`;

	return report;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function deactivate() { }
