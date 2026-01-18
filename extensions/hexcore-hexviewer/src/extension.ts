/*---------------------------------------------------------------------------------------------
 *  HexCore Hex Viewer Extension
 *  Copyright (c) HikariSystem. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { HexEditorProvider } from './hexEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
	// Register the custom editor provider
	context.subscriptions.push(
		HexEditorProvider.register(context)
	);

	// Register commands
	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.openHexView', async (uri?: vscode.Uri) => {
			if (!uri) {
				const uris = await vscode.window.showOpenDialog({
					canSelectMany: false,
					openLabel: 'Open in Hex View',
					filters: {
						'All Files': ['*'],
						'Binary Files': ['bin', 'exe', 'dll', 'so', 'dylib'],
						'Data Files': ['dat', 'raw']
					}
				});
				if (uris && uris.length > 0) {
					uri = uris[0];
				}
			}
			if (uri) {
				await vscode.commands.executeCommand('vscode.openWith', uri, 'hexcore.hexEditor');
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.goToOffset', async () => {
			const input = await vscode.window.showInputBox({
				prompt: 'Enter offset (hex or decimal)',
				placeHolder: '0x1000 or 4096',
				validateInput: (value) => {
					const num = value.startsWith('0x')
						? parseInt(value, 16)
						: parseInt(value, 10);
					if (isNaN(num) || num < 0) {
						return 'Please enter a valid positive number';
					}
					return null;
				}
			});
			if (input) {
				const offset = input.startsWith('0x')
					? parseInt(input, 16)
					: parseInt(input, 10);
				// Send message to webview
				vscode.commands.executeCommand('hexcore.internal.goToOffset', offset);
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('hexcore.searchHex', async () => {
			const input = await vscode.window.showInputBox({
				prompt: 'Enter hex pattern to search',
				placeHolder: '4D 5A 90 00 or 4D5A9000',
				validateInput: (value) => {
					const cleaned = value.replace(/\s/g, '');
					if (!/^[0-9A-Fa-f]*$/.test(cleaned)) {
						return 'Please enter valid hex characters only';
					}
					if (cleaned.length % 2 !== 0) {
						return 'Hex string must have even length';
					}
					return null;
				}
			});
			if (input) {
				vscode.commands.executeCommand('hexcore.internal.searchHex', input);
			}
		})
	);

	console.log('HexCore Hex Viewer extension activated');
}

export function deactivate(): void {
	// Cleanup if needed
}
