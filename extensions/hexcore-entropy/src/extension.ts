/*---------------------------------------------------------------------------------------------
 *  HexCore Entropy Analyzer v1.0.0
 *  Visual entropy analysis with ASCII graph
 *  Copyright (c) HikariSystem. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface EntropyBlock {
	offset: number;
	size: number;
	entropy: number;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('HexCore Entropy Analyzer extension activated');

	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.entropy.analyze', async (uri?: vscode.Uri) => {
			if (!uri) {
				const files = await vscode.window.showOpenDialog({
					canSelectMany: false,
					canSelectFiles: true,
					title: 'Select file for entropy analysis'
				});
				if (files && files.length > 0) {
					uri = files[0];
				} else {
					return;
				}
			}

			await analyzeEntropy(uri);
		})
	);
}

async function analyzeEntropy(uri: vscode.Uri): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Analyzing entropy of ${fileName}...`,
		cancellable: false
	}, async (progress) => {
		try {
			const stats = fs.statSync(filePath);
			const buffer = fs.readFileSync(filePath);

			progress.report({ increment: 30, message: 'Calculating entropy blocks...' });

			// Calculate entropy in 256-byte blocks
			const blockSize = 256;
			const blocks: EntropyBlock[] = [];

			for (let offset = 0; offset < buffer.length; offset += blockSize) {
				const end = Math.min(offset + blockSize, buffer.length);
				const chunk = buffer.subarray(offset, end);
				const entropy = calculateEntropy(chunk);
				blocks.push({ offset, size: end - offset, entropy });
			}

			progress.report({ increment: 40, message: 'Generating report...' });

			const report = generateEntropyReport(fileName, filePath, stats.size, blocks);

			const doc = await vscode.workspace.openTextDocument({
				content: report,
				language: 'markdown'
			});

			await vscode.window.showTextDocument(doc, { preview: false });

		} catch (error: any) {
			vscode.window.showErrorMessage(`Entropy analysis failed: ${error.message}`);
		}
	});
}

function calculateEntropy(buffer: Buffer): number {
	if (buffer.length === 0) return 0;

	const freq = new Array(256).fill(0);
	for (let i = 0; i < buffer.length; i++) {
		freq[buffer[i]]++;
	}

	let entropy = 0;
	for (let i = 0; i < 256; i++) {
		if (freq[i] > 0) {
			const p = freq[i] / buffer.length;
			entropy -= p * Math.log2(p);
		}
	}

	return entropy;
}

function generateEntropyReport(
	fileName: string,
	filePath: string,
	fileSize: number,
	blocks: EntropyBlock[]
): string {
	// Calculate statistics
	const entropies = blocks.map(b => b.entropy);
	const avgEntropy = entropies.reduce((a, b) => a + b, 0) / entropies.length;
	const maxEntropy = Math.max(...entropies);
	const minEntropy = Math.min(...entropies);

	// Detect suspicious regions
	const highEntropyBlocks = blocks.filter(b => b.entropy > 7.0);
	const lowEntropyBlocks = blocks.filter(b => b.entropy < 1.0);

	// Determine overall assessment
	let assessment = 'Normal';
	let assessmentDetails = 'File appears to be uncompressed and unencrypted.';

	if (avgEntropy > 7.5) {
		assessment = 'Highly Encrypted/Compressed';
		assessmentDetails = 'Very high entropy suggests encryption or strong compression.';
	} else if (avgEntropy > 6.5) {
		assessment = 'Possibly Packed';
		assessmentDetails = 'Elevated entropy may indicate packing or compression.';
	} else if (highEntropyBlocks.length > blocks.length * 0.5) {
		assessment = 'Mixed Content';
		assessmentDetails = 'Significant portions have high entropy - possible encrypted sections.';
	}

	// Generate ASCII graph
	const graphWidth = 60;
	const graphHeight = 20;
	const graph = generateAsciiGraph(blocks, graphWidth, graphHeight);

	let report = `# HexCore Entropy Analysis Report

## File Information

| Property | Value |
|----------|-------|
| **File Name** | ${fileName} |
| **File Path** | ${filePath} |
| **File Size** | ${formatBytes(fileSize)} |
| **Block Size** | 256 bytes |
| **Total Blocks** | ${blocks.length} |

---

## Entropy Statistics

| Metric | Value |
|--------|-------|
| **Average Entropy** | ${avgEntropy.toFixed(4)} / 8.00 |
| **Maximum Entropy** | ${maxEntropy.toFixed(4)} |
| **Minimum Entropy** | ${minEntropy.toFixed(4)} |
| **High Entropy Blocks (>7.0)** | ${highEntropyBlocks.length} (${((highEntropyBlocks.length / blocks.length) * 100).toFixed(1)}%) |
| **Low Entropy Blocks (<1.0)** | ${lowEntropyBlocks.length} (${((lowEntropyBlocks.length / blocks.length) * 100).toFixed(1)}%) |

---

## Assessment

**${assessment}**

${assessmentDetails}

---

## Entropy Graph

\`\`\`
${graph}
\`\`\`

**Legend:** Each column represents a block. Height shows entropy (0-8).
- Low entropy (0-3): Likely plaintext, null bytes, or repetitive data
- Medium entropy (3-6): Code, structured data
- High entropy (6-8): Encrypted, compressed, or random data

---

## High Entropy Regions (>7.0)

`;

	if (highEntropyBlocks.length > 0) {
		report += '| Offset | Entropy |\n';
		report += '|--------|--------|\n';
		for (const block of highEntropyBlocks.slice(0, 20)) {
			report += `| 0x${block.offset.toString(16).toUpperCase().padStart(8, '0')} | ${block.entropy.toFixed(4)} |\n`;
		}
		if (highEntropyBlocks.length > 20) {
			report += `| ... | *${highEntropyBlocks.length - 20} more regions* |\n`;
		}
	} else {
		report += '*No high entropy regions detected.*\n';
	}

	report += `
---

## Entropy Scale Reference

| Range | Typical Content |
|-------|-----------------|
| 0.0 - 1.0 | Null bytes, single repeated byte |
| 1.0 - 3.0 | Simple text, repetitive patterns |
| 3.0 - 5.0 | English text, source code |
| 5.0 - 6.5 | Compiled code, mixed content |
| 6.5 - 7.5 | Compressed data (ZIP, PNG) |
| 7.5 - 8.0 | Encrypted or random data |

---
*Generated by HexCore Entropy Analyzer v1.0.0*
`;

	return report;
}

function generateAsciiGraph(blocks: EntropyBlock[], width: number, height: number): string {
	const lines: string[] = [];

	// Sample blocks to fit width
	const step = Math.max(1, Math.floor(blocks.length / width));
	const sampledBlocks: number[] = [];

	for (let i = 0; i < width && i * step < blocks.length; i++) {
		const startIdx = i * step;
		const endIdx = Math.min(startIdx + step, blocks.length);
		let maxEntropy = 0;
		for (let j = startIdx; j < endIdx; j++) {
			if (blocks[j].entropy > maxEntropy) {
				maxEntropy = blocks[j].entropy;
			}
		}
		sampledBlocks.push(maxEntropy);
	}

	// Build graph rows
	for (let row = height - 1; row >= 0; row--) {
		const threshold = (row / height) * 8;
		let line = '';

		// Y-axis label
		if (row === height - 1) {
			line = '8.0|';
		} else if (row === Math.floor(height / 2)) {
			line = '4.0|';
		} else if (row === 0) {
			line = '0.0|';
		} else {
			line = '   |';
		}

		for (const entropy of sampledBlocks) {
			if (entropy >= threshold) {
				if (entropy > 7.0) {
					line += '#'; // High entropy
				} else if (entropy > 5.0) {
					line += '='; // Medium-high
				} else if (entropy > 3.0) {
					line += '-'; // Medium
				} else {
					line += '.'; // Low
				}
			} else {
				line += ' ';
			}
		}
		lines.push(line);
	}

	// X-axis
	lines.push('   +' + '-'.repeat(sampledBlocks.length));
	lines.push('    0' + ' '.repeat(Math.floor(sampledBlocks.length / 2) - 3) + 'Offset' + ' '.repeat(Math.floor(sampledBlocks.length / 2) - 6) + 'EOF');

	return lines.join('\n');
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function deactivate() { }
