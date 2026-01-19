/*---------------------------------------------------------------------------------------------
 *  HexCore Hash Calculator v1.1.0
 *  Calculate MD5, SHA1, SHA256, SHA512 hashes with algorithm selection
 *  Copyright (c) HikariSystem. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha512';

interface HashResults {
	[key: string]: string;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('HexCore Hash Calculator v1.1.0 activated');

	// Calculate hashes command
	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.hashcalc.calculate', async (uri?: vscode.Uri) => {
			if (!uri) {
				const files = await vscode.window.showOpenDialog({
					canSelectMany: false,
					canSelectFiles: true,
					canSelectFolders: false,
					title: 'Select file to hash'
				});
				if (files && files.length > 0) {
					uri = files[0];
				} else {
					return;
				}
			}

			// Let user choose algorithms
			const algorithms = await vscode.window.showQuickPick(
				[
					{ label: 'All (MD5, SHA-1, SHA-256, SHA-512)', value: 'all', picked: true },
					{ label: 'MD5', value: 'md5' },
					{ label: 'SHA-1', value: 'sha1' },
					{ label: 'SHA-256', value: 'sha256' },
					{ label: 'SHA-512', value: 'sha512' },
					{ label: 'Quick (MD5 + SHA-256)', value: 'quick' },
				],
				{
					placeHolder: 'Select hash algorithm(s)',
					title: 'HexCore Hash Calculator'
				}
			);

			if (!algorithms) return;

			let selectedAlgorithms: HashAlgorithm[];
			switch (algorithms.value) {
				case 'all':
					selectedAlgorithms = ['md5', 'sha1', 'sha256', 'sha512'];
					break;
				case 'quick':
					selectedAlgorithms = ['md5', 'sha256'];
					break;
				default:
					selectedAlgorithms = [algorithms.value as HashAlgorithm];
			}

			await calculateAndShowHashes(uri, selectedAlgorithms);
		})
	);

	// Quick hash command (SHA-256 only)
	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.hashcalc.quick', async (uri?: vscode.Uri) => {
			if (!uri) {
				const files = await vscode.window.showOpenDialog({
					canSelectMany: false,
					canSelectFiles: true,
					title: 'Select file for quick hash (SHA-256)'
				});
				if (files && files.length > 0) {
					uri = files[0];
				} else {
					return;
				}
			}

			await calculateQuickHash(uri);
		})
	);

	// Verify hash command
	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.hashcalc.verify', async () => {
			const expectedHash = await vscode.window.showInputBox({
				prompt: 'Enter the expected hash to verify',
				placeHolder: 'e.g., d41d8cd98f00b204e9800998ecf8427e'
			});

			if (!expectedHash) return;

			const files = await vscode.window.showOpenDialog({
				canSelectMany: false,
				canSelectFiles: true,
				title: 'Select file to verify'
			});

			if (!files || files.length === 0) return;

			await verifyHash(files[0], expectedHash.trim().toLowerCase());
		})
	);
}

async function calculateQuickHash(uri: vscode.Uri): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Calculating SHA-256 for ${fileName}...`,
		cancellable: false
	}, async () => {
		try {
			const hash = await calculateSingleHash(filePath, 'sha256');

			// Copy to clipboard and show
			await vscode.env.clipboard.writeText(hash);
			vscode.window.showInformationMessage(`SHA-256: ${hash} (copied to clipboard)`);

		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to calculate hash: ${error.message}`);
		}
	});
}

async function calculateSingleHash(filePath: string, algorithm: HashAlgorithm): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash(algorithm);
		const stream = fs.createReadStream(filePath);

		stream.on('data', (chunk: Buffer) => hash.update(chunk));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', reject);
	});
}

async function calculateAndShowHashes(uri: vscode.Uri, algorithms: HashAlgorithm[]): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Calculating hashes for ${fileName}...`,
		cancellable: false
	}, async (progress) => {
		try {
			const stats = fs.statSync(filePath);
			const fileSize = stats.size;

			progress.report({ increment: 0, message: 'Reading file...' });

			// Calculate selected hashes using streaming
			const hashes = await calculateHashesStreaming(filePath, algorithms, (pct) => {
				progress.report({ message: `Processing... ${Math.round(pct)}%` });
			});

			// Show results in a new document
			const content = generateHashReport(fileName, filePath, fileSize, hashes, algorithms);

			const doc = await vscode.workspace.openTextDocument({
				content: content,
				language: 'markdown'
			});

			await vscode.window.showTextDocument(doc, { preview: false });

		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to calculate hashes: ${error.message}`);
		}
	});
}

async function calculateHashesStreaming(
	filePath: string,
	algorithms: HashAlgorithm[],
	onProgress?: (percent: number) => void
): Promise<HashResults> {
	return new Promise((resolve, reject) => {
		const hashers: Map<HashAlgorithm, crypto.Hash> = new Map();

		for (const algo of algorithms) {
			hashers.set(algo, crypto.createHash(algo));
		}

		const stats = fs.statSync(filePath);
		const totalSize = stats.size;
		let bytesRead = 0;

		const stream = fs.createReadStream(filePath);

		stream.on('data', (chunk: Buffer) => {
			for (const hasher of hashers.values()) {
				hasher.update(chunk);
			}

			bytesRead += chunk.length;
			if (onProgress) {
				onProgress((bytesRead / totalSize) * 100);
			}
		});

		stream.on('end', () => {
			const results: HashResults = {};
			for (const [algo, hasher] of hashers) {
				results[algo] = hasher.digest('hex');
			}
			resolve(results);
		});

		stream.on('error', reject);
	});
}

function generateHashReport(
	fileName: string,
	filePath: string,
	fileSize: number,
	hashes: HashResults,
	algorithms: HashAlgorithm[]
): string {
	const sizeFormatted = formatBytes(fileSize);
	const timestamp = new Date().toISOString();

	let report = `# HexCore Hash Calculator Report

## File Information

| Property | Value |
|----------|-------|
| **File Name** | ${fileName} |
| **File Path** | ${filePath} |
| **File Size** | ${sizeFormatted} (${fileSize.toLocaleString()} bytes) |
| **Calculated** | ${timestamp} |
| **Algorithms** | ${algorithms.map(a => a.toUpperCase()).join(', ')} |

---

## Hash Values

`;

	// Add each algorithm's result
	const algoNames: Record<HashAlgorithm, string> = {
		'md5': 'MD5',
		'sha1': 'SHA-1',
		'sha256': 'SHA-256',
		'sha512': 'SHA-512'
	};

	for (const algo of algorithms) {
		if (hashes[algo]) {
			report += `### ${algoNames[algo]}
\`\`\`
${hashes[algo]}
\`\`\`

`;
		}
	}

	report += `---

## Quick Copy

| Algorithm | Hash |
|-----------|------|
`;

	for (const algo of algorithms) {
		if (hashes[algo]) {
			report += `| ${algoNames[algo]} | \`${hashes[algo]}\` |\n`;
		}
	}

	// VirusTotal links
	report += `
---

## VirusTotal Links

`;

	if (hashes['md5']) {
		report += `- [Search MD5 on VirusTotal](https://www.virustotal.com/gui/search/${hashes['md5']})\n`;
	}
	if (hashes['sha256']) {
		report += `- [Search SHA-256 on VirusTotal](https://www.virustotal.com/gui/search/${hashes['sha256']})\n`;
	}

	report += `
---
*Generated by HexCore Hash Calculator v1.1.0*
`;

	return report;
}

async function verifyHash(uri: vscode.Uri, expectedHash: string): Promise<void> {
	const filePath = uri.fsPath;
	const fileName = path.basename(filePath);

	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: `Verifying hash for ${fileName}...`,
		cancellable: false
	}, async () => {
		try {
			// Determine which hash type based on length
			let hashType: HashAlgorithm;
			let hashTypeName: string;

			switch (expectedHash.length) {
				case 32:
					hashType = 'md5';
					hashTypeName = 'MD5';
					break;
				case 40:
					hashType = 'sha1';
					hashTypeName = 'SHA-1';
					break;
				case 64:
					hashType = 'sha256';
					hashTypeName = 'SHA-256';
					break;
				case 128:
					hashType = 'sha512';
					hashTypeName = 'SHA-512';
					break;
				default:
					vscode.window.showErrorMessage(
						`Unknown hash format (${expectedHash.length} characters). Expected MD5 (32), SHA-1 (40), SHA-256 (64), or SHA-512 (128).`
					);
					return;
			}

			const calculatedHash = await calculateSingleHash(filePath, hashType);

			if (calculatedHash === expectedHash) {
				vscode.window.showInformationMessage(`MATCH: ${hashTypeName} hash verified successfully for ${fileName}`);
			} else {
				vscode.window.showWarningMessage(
					`MISMATCH: ${hashTypeName} hash does NOT match!\n\nExpected: ${expectedHash}\nCalculated: ${calculatedHash}`
				);
			}

		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to verify hash: ${error.message}`);
		}
	});
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function deactivate() { }
