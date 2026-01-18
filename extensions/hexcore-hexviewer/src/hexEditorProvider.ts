/*---------------------------------------------------------------------------------------------
 *  HexCore Hex Viewer - Custom Editor Provider
 *  Copyright (c) HikariSystem. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class HexEditorProvider implements vscode.CustomReadonlyEditorProvider<HexDocument> {

	public static readonly viewType = 'hexcore.hexEditor';

	private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<HexDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	constructor(private readonly context: vscode.ExtensionContext) { }

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new HexEditorProvider(context);
		return vscode.window.registerCustomEditorProvider(
			HexEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true
				},
				supportsMultipleEditorsPerDocument: false
			}
		);
	}

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken
	): Promise<HexDocument> {
		const data = await vscode.workspace.fs.readFile(uri);
		return new HexDocument(uri, data);
	}

	async resolveCustomEditor(
		document: HexDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		webviewPanel.webview.options = {
			enableScripts: true
		};

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document);

		// Handle messages from webview
		webviewPanel.webview.onDidReceiveMessage(message => {
			switch (message.type) {
				case 'ready':
					webviewPanel.webview.postMessage({
						type: 'setData',
						data: Array.from(document.data),
						fileName: document.uri.fsPath
					});
					break;
				case 'copyToClipboard':
					vscode.env.clipboard.writeText(message.text);
					vscode.window.showInformationMessage('Copied to clipboard');
					break;
			}
		});
	}

	private getHtmlForWebview(webview: vscode.Webview, document: HexDocument): string {
		const config = vscode.workspace.getConfiguration('hexcore.hexViewer');
		const bytesPerRow = config.get<number>('bytesPerRow', 16);
		const showAscii = config.get<boolean>('showAscii', true);
		const uppercase = config.get<boolean>('uppercase', true);

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Hex Viewer</title>
	<style>
		:root {
			--bg-primary: #1e1e2e;
			--bg-secondary: #181825;
			--bg-hover: #313244;
			--text-primary: #cdd6f4;
			--text-secondary: #a6adc8;
			--text-muted: #6c7086;
			--accent: #cba6f7;
			--accent-dim: #9366b4;
			--border: #45475a;
			--offset-color: #89b4fa;
			--hex-color: #f5c2e7;
			--ascii-color: #a6e3a1;
			--highlight: rgba(203, 166, 247, 0.3);
		}

		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}

		body {
			font-family: 'Consolas', 'Courier New', monospace;
			background-color: var(--bg-primary);
			color: var(--text-primary);
			padding: 0;
			overflow: hidden;
		}

		.toolbar {
			display: flex;
			align-items: center;
			gap: 16px;
			padding: 12px 16px;
			background: var(--bg-secondary);
			border-bottom: 1px solid var(--border);
			position: sticky;
			top: 0;
			z-index: 100;
		}

		.toolbar-group {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.toolbar-label {
			color: var(--text-muted);
			font-size: 12px;
		}

		.toolbar-value {
			color: var(--accent);
			font-size: 12px;
			font-weight: bold;
		}

		.toolbar-divider {
			width: 1px;
			height: 24px;
			background: var(--border);
		}

		.search-box {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-left: auto;
		}

		.search-box input {
			background: var(--bg-primary);
			border: 1px solid var(--border);
			color: var(--text-primary);
			padding: 6px 12px;
			border-radius: 4px;
			font-family: inherit;
			font-size: 12px;
			width: 200px;
		}

		.search-box input:focus {
			outline: none;
			border-color: var(--accent);
		}

		.search-box input::placeholder {
			color: var(--text-muted);
		}

		.btn {
			background: var(--accent-dim);
			color: var(--bg-primary);
			border: none;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: pointer;
			font-size: 12px;
			font-weight: bold;
			transition: background 0.2s;
		}

		.btn:hover {
			background: var(--accent);
		}

		.container {
			display: flex;
			height: calc(100vh - 50px);
		}

		.hex-view {
			flex: 1;
			overflow: auto;
			padding: 16px;
		}

		.hex-table {
			font-size: 13px;
			line-height: 1.6;
		}

		.hex-row {
			display: flex;
			align-items: center;
		}

		.hex-row:hover {
			background: var(--bg-hover);
		}

		.offset {
			color: var(--offset-color);
			min-width: 80px;
			user-select: none;
		}

		.hex-bytes {
			display: flex;
			gap: 4px;
			margin: 0 16px;
		}

		.hex-byte {
			width: 22px;
			text-align: center;
			color: var(--hex-color);
			cursor: pointer;
			border-radius: 2px;
		}

		.hex-byte:hover {
			background: var(--highlight);
		}

		.hex-byte.selected {
			background: var(--accent);
			color: var(--bg-primary);
		}

		.hex-byte.null {
			color: var(--text-muted);
		}

		.ascii {
			color: var(--ascii-color);
			border-left: 1px solid var(--border);
			padding-left: 16px;
			letter-spacing: 1px;
		}

		.ascii-char {
			cursor: pointer;
		}

		.ascii-char:hover {
			background: var(--highlight);
		}

		.ascii-char.non-printable {
			color: var(--text-muted);
		}

		.sidebar {
			width: 280px;
			background: var(--bg-secondary);
			border-left: 1px solid var(--border);
			padding: 16px;
			overflow-y: auto;
		}

		.sidebar h3 {
			color: var(--accent);
			font-size: 14px;
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--border);
		}

		.info-row {
			display: flex;
			justify-content: space-between;
			padding: 6px 0;
			font-size: 12px;
		}

		.info-label {
			color: var(--text-muted);
		}

		.info-value {
			color: var(--text-primary);
			font-weight: bold;
		}

		.selection-info {
			margin-top: 16px;
		}

		.copy-buttons {
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-top: 16px;
		}

		.copy-btn {
			width: 100%;
			text-align: left;
			padding: 8px 12px;
		}

		.loading {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--text-muted);
		}

		.loading-spinner {
			width: 40px;
			height: 40px;
			border: 3px solid var(--border);
			border-top-color: var(--accent);
			border-radius: 50%;
			animation: spin 1s linear infinite;
			margin-right: 16px;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}
	</style>
</head>
<body>
	<div class="toolbar">
		<div class="toolbar-group">
			<span class="toolbar-label">File:</span>
			<span class="toolbar-value" id="fileName">Loading...</span>
		</div>
		<div class="toolbar-divider"></div>
		<div class="toolbar-group">
			<span class="toolbar-label">Size:</span>
			<span class="toolbar-value" id="fileSize">-</span>
		</div>
		<div class="toolbar-divider"></div>
		<div class="toolbar-group">
			<span class="toolbar-label">Offset:</span>
			<span class="toolbar-value" id="currentOffset">0x00000000</span>
		</div>
		<div class="search-box">
			<input type="text" id="searchInput" placeholder="Search hex pattern (e.g., 4D 5A)">
			<button class="btn" id="searchBtn">Search</button>
		</div>
	</div>

	<div class="container">
		<div class="hex-view" id="hexView">
			<div class="loading">
				<div class="loading-spinner"></div>
				<span>Loading file...</span>
			</div>
		</div>

		<div class="sidebar">
			<h3>File Information</h3>
			<div class="info-row">
				<span class="info-label">Total Bytes</span>
				<span class="info-value" id="totalBytes">-</span>
			</div>
			<div class="info-row">
				<span class="info-label">MD5</span>
				<span class="info-value" id="md5Hash">-</span>
			</div>
			<div class="info-row">
				<span class="info-label">SHA256</span>
				<span class="info-value" id="sha256Hash" style="font-size: 10px; word-break: break-all;">-</span>
			</div>

			<div class="selection-info">
				<h3>Selection</h3>
				<div class="info-row">
					<span class="info-label">Start</span>
					<span class="info-value" id="selStart">-</span>
				</div>
				<div class="info-row">
					<span class="info-label">End</span>
					<span class="info-value" id="selEnd">-</span>
				</div>
				<div class="info-row">
					<span class="info-label">Length</span>
					<span class="info-value" id="selLength">-</span>
				</div>

				<div class="copy-buttons">
					<button class="btn copy-btn" id="copyHex">Copy as Hex</button>
					<button class="btn copy-btn" id="copyC">Copy as C Array</button>
					<button class="btn copy-btn" id="copyPython">Copy as Python</button>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const BYTES_PER_ROW = ${bytesPerRow};
		const SHOW_ASCII = ${showAscii};
		const UPPERCASE = ${uppercase};

		let fileData = [];
		let selectedStart = -1;
		let selectedEnd = -1;

		// Notify extension we're ready
		vscode.postMessage({ type: 'ready' });

		// Handle messages from extension
		window.addEventListener('message', event => {
			const message = event.data;
			switch (message.type) {
				case 'setData':
					fileData = message.data;
					document.getElementById('fileName').textContent = message.fileName.split(/[\\/]/).pop();
					renderHexView();
					updateFileInfo();
					break;
			}
		});

		function renderHexView() {
			const container = document.getElementById('hexView');
			const rows = Math.ceil(fileData.length / BYTES_PER_ROW);

			let html = '<div class="hex-table">';

			for (let row = 0; row < rows; row++) {
				const offset = row * BYTES_PER_ROW;
				const offsetStr = UPPERCASE
					? offset.toString(16).toUpperCase().padStart(8, '0')
					: offset.toString(16).padStart(8, '0');

				html += '<div class="hex-row">';
				html += '<span class="offset">0x' + offsetStr + '</span>';
				html += '<span class="hex-bytes">';

				// Hex bytes
				for (let col = 0; col < BYTES_PER_ROW; col++) {
					const idx = offset + col;
					if (idx < fileData.length) {
						const byte = fileData[idx];
						const hexStr = UPPERCASE
							? byte.toString(16).toUpperCase().padStart(2, '0')
							: byte.toString(16).padStart(2, '0');
						const isNull = byte === 0;
						html += '<span class="hex-byte' + (isNull ? ' null' : '') + '" data-offset="' + idx + '">' + hexStr + '</span>';
					} else {
						html += '<span class="hex-byte">  </span>';
					}
				}

				html += '</span>';

				// ASCII representation
				if (SHOW_ASCII) {
					html += '<span class="ascii">';
					for (let col = 0; col < BYTES_PER_ROW; col++) {
						const idx = offset + col;
						if (idx < fileData.length) {
							const byte = fileData[idx];
							const isPrintable = byte >= 32 && byte <= 126;
							const char = isPrintable ? String.fromCharCode(byte) : '.';
							html += '<span class="ascii-char' + (!isPrintable ? ' non-printable' : '') + '" data-offset="' + idx + '">' + escapeHtml(char) + '</span>';
						}
					}
					html += '</span>';
				}

				html += '</div>';
			}

			html += '</div>';
			container.innerHTML = html;

			// Add click handlers
			container.querySelectorAll('.hex-byte[data-offset], .ascii-char[data-offset]').forEach(el => {
				el.addEventListener('click', (e) => {
					const offset = parseInt(el.dataset.offset);
					handleByteClick(offset, e.shiftKey);
				});
			});
		}

		function handleByteClick(offset, isShift) {
			if (isShift && selectedStart !== -1) {
				selectedEnd = offset;
			} else {
				selectedStart = offset;
				selectedEnd = offset;
			}
			updateSelection();
		}

		function updateSelection() {
			// Clear previous selection
			document.querySelectorAll('.hex-byte.selected, .ascii-char.selected').forEach(el => {
				el.classList.remove('selected');
			});

			if (selectedStart === -1) return;

			const start = Math.min(selectedStart, selectedEnd);
			const end = Math.max(selectedStart, selectedEnd);

			for (let i = start; i <= end; i++) {
				document.querySelectorAll('[data-offset="' + i + '"]').forEach(el => {
					el.classList.add('selected');
				});
			}

			// Update sidebar
			document.getElementById('selStart').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selEnd').textContent = '0x' + end.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selLength').textContent = (end - start + 1) + ' bytes';
			document.getElementById('currentOffset').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');
		}

		function updateFileInfo() {
			document.getElementById('fileSize').textContent = formatBytes(fileData.length);
			document.getElementById('totalBytes').textContent = fileData.length.toLocaleString();

			// Calculate hashes asynchronously
			calculateHash('MD5').then(hash => {
				document.getElementById('md5Hash').textContent = hash.substring(0, 16) + '...';
				document.getElementById('md5Hash').title = hash;
			});

			calculateHash('SHA-256').then(hash => {
				document.getElementById('sha256Hash').textContent = hash;
			});
		}

		async function calculateHash(algorithm) {
			try {
				const hashBuffer = await crypto.subtle.digest(algorithm, new Uint8Array(fileData));
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
			} catch (e) {
				return 'N/A';
			}
		}

		function formatBytes(bytes) {
			if (bytes === 0) return '0 B';
			const k = 1024;
			const sizes = ['B', 'KB', 'MB', 'GB'];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
		}

		function escapeHtml(text) {
			const div = document.createElement('div');
			div.textContent = text;
			return div.innerHTML;
		}

		function getSelectedBytes() {
			if (selectedStart === -1) return [];
			const start = Math.min(selectedStart, selectedEnd);
			const end = Math.max(selectedStart, selectedEnd);
			return fileData.slice(start, end + 1);
		}

		// Copy buttons
		document.getElementById('copyHex').addEventListener('click', () => {
			const bytes = getSelectedBytes();
			if (bytes.length === 0) return;
			const hex = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
			vscode.postMessage({ type: 'copyToClipboard', text: hex });
		});

		document.getElementById('copyC').addEventListener('click', () => {
			const bytes = getSelectedBytes();
			if (bytes.length === 0) return;
			const c = 'unsigned char data[] = { ' + bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ') + ' };';
			vscode.postMessage({ type: 'copyToClipboard', text: c });
		});

		document.getElementById('copyPython').addEventListener('click', () => {
			const bytes = getSelectedBytes();
			if (bytes.length === 0) return;
			const py = 'data = b"' + bytes.map(b => '\\\\x' + b.toString(16).padStart(2, '0')).join('') + '"';
			vscode.postMessage({ type: 'copyToClipboard', text: py });
		});

		// Search
		document.getElementById('searchBtn').addEventListener('click', () => {
			const pattern = document.getElementById('searchInput').value.replace(/\\s/g, '');
			if (!pattern || pattern.length % 2 !== 0) return;

			const searchBytes = [];
			for (let i = 0; i < pattern.length; i += 2) {
				searchBytes.push(parseInt(pattern.substr(i, 2), 16));
			}

			// Search in data
			for (let i = 0; i <= fileData.length - searchBytes.length; i++) {
				let found = true;
				for (let j = 0; j < searchBytes.length; j++) {
					if (fileData[i + j] !== searchBytes[j]) {
						found = false;
						break;
					}
				}
				if (found) {
					selectedStart = i;
					selectedEnd = i + searchBytes.length - 1;
					updateSelection();
					// Scroll to selection
					const el = document.querySelector('[data-offset="' + i + '"]');
					if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
					return;
				}
			}

			alert('Pattern not found');
		});
	</script>
</body>
</html>`;
	}
}

class HexDocument implements vscode.CustomDocument {
	constructor(
		public readonly uri: vscode.Uri,
		public readonly data: Uint8Array
	) { }

	dispose(): void {
		// Cleanup
	}
}
