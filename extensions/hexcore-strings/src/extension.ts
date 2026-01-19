/*---------------------------------------------------------------------------------------------
 *  HexCore Strings Extractor v1.0.0
 *  Extract ASCII and Unicode strings from binary files
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

export function activate(context: vscode.ExtensionContext) {
	console.log('HexCore Strings Extractor extension activated');

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

			await extractAndShowStrings(uri, minLength);
		})
	);
}

async function extractAndShowStrings(uri: vscode.Uri, minLength: number): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Extracting strings from ${fileName}...`,
		cancellable: true
	}, async (progress, token) => {
		try {
			const stats = fs.statSync(filePath);
			const maxSize = 50 * 1024 * 1024; // Limit to 50MB for performance

			if (stats.size > maxSize) {
				const proceed = await vscode.window.showWarningMessage(
					`File is ${formatBytes(stats.size)}. Extraction may be slow. Continue?`,
					'Yes', 'No'
				);
				if (proceed !== 'Yes') return;
			}

			progress.report({ increment: 0, message: 'Reading file...' });

			const buffer = fs.readFileSync(filePath);

			progress.report({ increment: 30, message: 'Extracting ASCII strings...' });
			if (token.isCancellationRequested) return;

			const asciiStrings = extractASCIIStrings(buffer, minLength);

			progress.report({ increment: 30, message: 'Extracting Unicode strings...' });
			if (token.isCancellationRequested) return;

			const unicodeStrings = extractUnicodeStrings(buffer, minLength);

			progress.report({ increment: 20, message: 'Categorizing strings...' });

			const allStrings = [...asciiStrings, ...unicodeStrings];
			categorizeStrings(allStrings);

			progress.report({ increment: 10, message: 'Generating report...' });

			// Sort by offset
			allStrings.sort((a, b) => a.offset - b.offset);

			const content = generateStringsReport(fileName, filePath, stats.size, allStrings, minLength);

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

function extractASCIIStrings(buffer: Buffer, minLength: number): ExtractedString[] {
	const strings: ExtractedString[] = [];
	let currentString = '';
	let startOffset = 0;

	for (let i = 0; i < buffer.length; i++) {
		const byte = buffer[i];

		// Printable ASCII range (32-126) plus tab, newline
		if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
			if (currentString.length === 0) {
				startOffset = i;
			}
			currentString += String.fromCharCode(byte);
		} else {
			if (currentString.length >= minLength) {
				strings.push({
					offset: startOffset,
					value: currentString.trim(),
					encoding: 'ASCII'
				});
			}
			currentString = '';
		}
	}

	// Don't forget the last string
	if (currentString.length >= minLength) {
		strings.push({
			offset: startOffset,
			value: currentString.trim(),
			encoding: 'ASCII'
		});
	}

	return strings;
}

function extractUnicodeStrings(buffer: Buffer, minLength: number): ExtractedString[] {
	const strings: ExtractedString[] = [];
	let currentString = '';
	let startOffset = 0;

	// UTF-16LE: each char is 2 bytes, with null byte as second for ASCII range
	for (let i = 0; i < buffer.length - 1; i += 2) {
		const low = buffer[i];
		const high = buffer[i + 1];

		// Check for printable UTF-16LE character
		if (high === 0 && ((low >= 32 && low <= 126) || low === 9 || low === 10 || low === 13)) {
			if (currentString.length === 0) {
				startOffset = i;
			}
			currentString += String.fromCharCode(low);
		} else {
			if (currentString.length >= minLength) {
				// Avoid duplicates with ASCII extraction
				strings.push({
					offset: startOffset,
					value: currentString.trim(),
					encoding: 'UTF-16LE'
				});
			}
			currentString = '';
		}
	}

	if (currentString.length >= minLength) {
		strings.push({
			offset: startOffset,
			value: currentString.trim(),
			encoding: 'UTF-16LE'
		});
	}

	return strings;
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
			for (const item of items.slice(0, 50)) { // Limit per category
				const escapedValue = item.value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
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
*Generated by HexCore Strings Extractor v1.0.0*
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
