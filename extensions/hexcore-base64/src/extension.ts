/*---------------------------------------------------------------------------------------------
 *  HexCore Base64 Decoder v1.0.0
 *  Detect and decode Base64 encoded strings
 *  Copyright (c) HikariSystem. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface Base64Match {
	offset: number;
	encoded: string;
	decoded: string;
	decodedHex: string;
	isPrintable: boolean;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('HexCore Base64 Decoder extension activated');

	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.base64.decode', async (uri?: vscode.Uri) => {
			if (!uri) {
				const files = await vscode.window.showOpenDialog({
					canSelectMany: false,
					canSelectFiles: true,
					title: 'Select file to scan for Base64'
				});
				if (files && files.length > 0) {
					uri = files[0];
				} else {
					return;
				}
			}

			await decodeBase64InFile(uri);
		})
	);
}

async function decodeBase64InFile(uri: vscode.Uri): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Scanning ${fileName} for Base64...`,
		cancellable: false
	}, async (progress) => {
		try {
			const buffer = fs.readFileSync(filePath);
			const content = buffer.toString('binary');

			progress.report({ increment: 30, message: 'Finding Base64 patterns...' });

			const matches = findBase64Strings(content);

			progress.report({ increment: 40, message: 'Decoding...' });

			const decodedMatches = decodeMatches(matches);

			progress.report({ increment: 20, message: 'Generating report...' });

			const report = generateReport(fileName, filePath, buffer.length, decodedMatches);

			const doc = await vscode.workspace.openTextDocument({
				content: report,
				language: 'markdown'
			});

			await vscode.window.showTextDocument(doc, { preview: false });

		} catch (error: any) {
			vscode.window.showErrorMessage(`Base64 scan failed: ${error.message}`);
		}
	});
}

function findBase64Strings(content: string): Array<{ offset: number; match: string }> {
	const results: Array<{ offset: number; match: string }> = [];

	// Base64 pattern: at least 20 chars, valid base64 alphabet
	const base64Regex = /[A-Za-z0-9+/]{20,}={0,2}/g;

	let match;
	while ((match = base64Regex.exec(content)) !== null) {
		// Validate it's actually Base64 (length must be divisible by 4 or close)
		const str = match[0];
		if (isLikelyBase64(str)) {
			results.push({
				offset: match.index,
				match: str
			});
		}
	}

	return results;
}

function isLikelyBase64(str: string): boolean {
	// Must be at least 20 chars
	if (str.length < 20) return false;

	// Check for proper Base64 structure
	const withoutPadding = str.replace(/=+$/, '');

	// Should have mostly valid base64 chars
	const validChars = withoutPadding.replace(/[A-Za-z0-9+/]/g, '');
	if (validChars.length > 0) return false;

	// Try to decode and check if result makes sense
	try {
		const decoded = Buffer.from(str, 'base64');

		// Check if decoded length is reasonable
		if (decoded.length < 10) return false;

		// Reject if too many null bytes (likely not real base64)
		const nullCount = decoded.filter(b => b === 0).length;
		if (nullCount > decoded.length * 0.5) return false;

		return true;
	} catch {
		return false;
	}
}

function decodeMatches(matches: Array<{ offset: number; match: string }>): Base64Match[] {
	const results: Base64Match[] = [];

	for (const { offset, match } of matches) {
		try {
			const decoded = Buffer.from(match, 'base64');
			const decodedStr = decoded.toString('utf8');
			const decodedHex = decoded.toString('hex').toUpperCase();

			// Check if decoded is printable
			let printableCount = 0;
			for (const byte of decoded) {
				if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
					printableCount++;
				}
			}
			const isPrintable = printableCount > decoded.length * 0.7;

			results.push({
				offset,
				encoded: match,
				decoded: isPrintable ? decodedStr : '[Binary Data]',
				decodedHex: decodedHex.substring(0, 64) + (decodedHex.length > 64 ? '...' : ''),
				isPrintable
			});
		} catch {
			// Skip invalid base64
		}
	}

	return results;
}

function generateReport(
	fileName: string,
	filePath: string,
	fileSize: number,
	matches: Base64Match[]
): string {
	const printableMatches = matches.filter(m => m.isPrintable);
	const binaryMatches = matches.filter(m => !m.isPrintable);

	let report = `# HexCore Base64 Decoder Report

## File Information

| Property | Value |
|----------|-------|
| **File Name** | ${fileName} |
| **File Path** | ${filePath} |
| **File Size** | ${formatBytes(fileSize)} |

---

## Summary

| Type | Count |
|------|-------|
| **Total Base64 Strings** | ${matches.length} |
| **Printable (Text)** | ${printableMatches.length} |
| **Binary Data** | ${binaryMatches.length} |

---

## Decoded Strings (Printable)

`;

	if (printableMatches.length > 0) {
		for (const match of printableMatches.slice(0, 50)) {
			const truncatedEncoded = match.encoded.length > 60
				? match.encoded.substring(0, 60) + '...'
				: match.encoded;
			const escapedDecoded = match.decoded
				.replace(/\|/g, '\\|')
				.replace(/\n/g, '\\n')
				.replace(/\r/g, '');

			report += `### Offset 0x${match.offset.toString(16).toUpperCase().padStart(8, '0')}

**Encoded:**
\`\`\`
${truncatedEncoded}
\`\`\`

**Decoded:**
\`\`\`
${escapedDecoded.substring(0, 500)}${escapedDecoded.length > 500 ? '...' : ''}
\`\`\`

---

`;
		}
		if (printableMatches.length > 50) {
			report += `*... and ${printableMatches.length - 50} more printable strings*\n\n`;
		}
	} else {
		report += '*No printable Base64 strings found.*\n\n';
	}

	report += `## Binary Data (First 10)

`;

	if (binaryMatches.length > 0) {
		report += '| Offset | Length | First Bytes (Hex) |\n';
		report += '|--------|--------|------------------|\n';
		for (const match of binaryMatches.slice(0, 10)) {
			report += `| 0x${match.offset.toString(16).toUpperCase().padStart(8, '0')} | ${match.encoded.length} | \`${match.decodedHex}\` |\n`;
		}
		if (binaryMatches.length > 10) {
			report += `| ... | ... | *${binaryMatches.length - 10} more* |\n`;
		}
	} else {
		report += '*No binary Base64 data found.*\n';
	}

	report += `

---
*Generated by HexCore Base64 Decoder v1.0.0*
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
