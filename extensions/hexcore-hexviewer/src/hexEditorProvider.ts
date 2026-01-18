/*---------------------------------------------------------------------------------------------
 *  HexCore Hex Viewer - Custom Editor Provider
 *  Copyright (c) HikariSystem. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs';

export class HexEditorProvider implements vscode.CustomReadonlyEditorProvider<HexDocument> {

	public static readonly viewType = 'hexcore.hexEditor';

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
		const stat = await vscode.workspace.fs.stat(uri);
		return new HexDocument(uri, stat.size);
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

		webviewPanel.webview.onDidReceiveMessage(async message => {
			switch (message.type) {
				case 'ready':
					webviewPanel.webview.postMessage({
						type: 'init',
						fileSize: document.fileSize,
						fileName: document.uri.fsPath
					});
					break;

				case 'requestData':
					try {
						const { offset, length } = message;
						const data = await this.readChunk(document.uri, offset, length);
						webviewPanel.webview.postMessage({
							type: 'chunkData',
							offset: offset,
							data: Array.from(data)
						});
					} catch (e) {
						vscode.window.showErrorMessage('Failed to read file chunk: ' + e);
					}
					break;

				case 'copyToClipboard':
					vscode.env.clipboard.writeText(message.text);
					vscode.window.showInformationMessage('Copied to clipboard');
					break;
			}
		});
	}

	private async readChunk(uri: vscode.Uri, offset: number, length: number): Promise<Uint8Array> {
		// Using Node fs for local files for performance random access
		if (uri.scheme === 'file') {
			return new Promise((resolve, reject) => {
				fs.open(uri.fsPath, 'r', (err, fd) => {
					if (err) return reject(err);
					const buffer = Buffer.alloc(length);
					fs.read(fd, buffer, 0, length, offset, (err, bytesRead) => {
						fs.close(fd, () => { });
						if (err) return reject(err);
						resolve(buffer.slice(0, bytesRead));
					});
				});
			});
		} else {
			// Fallback for non-local schemes (slower, reads full file usually, but API constrained)
			const allData = await vscode.workspace.fs.readFile(uri);
			return allData.slice(offset, offset + length);
		}
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
			--font-mono: 'Consolas', 'Courier New', monospace;
			--row-height: 24px;
		}

		* { margin: 0; padding: 0; box-sizing: border-box; }

		body {
			font-family: var(--font-mono);
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 0;
			overflow: hidden;
			font-size: 13px;
			user-select: none;
		}

		/* Toolbar */
		.toolbar {
			display: flex;
			align-items: center;
			gap: 16px;
			padding: 8px 16px;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
			height: 40px;
		}

		.toolbar-item {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 12px;
		}

		.label { color: var(--vscode-descriptionForeground); }
		.value { color: var(--vscode-textLink-foreground); font-weight: bold; }
		.divider { width: 1px; height: 16px; background: var(--vscode-panel-border); }

		/* Main Layout */
		.container {
			display: flex;
			height: calc(100vh - 40px);
		}

		/* Virtual Scroll Area */
		.hex-view-container {
			flex: 1;
			position: relative;
			overflow-y: auto;
			overflow-x: hidden;
			outline: none;
		}

		.phantom-spacer {
			position: absolute;
			top: 0;
			left: 0;
			width: 1px;
			visibility: hidden;
		}

		.content-layer {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			will-change: transform;
		}

		.hex-row {
			height: var(--row-height);
			display: flex;
			align-items: center;
			padding: 0 10px;
		}

		.hex-row:hover { background-color: var(--vscode-list-hoverBackground); }

		.offset-col {
			color: var(--vscode-editorLineNumber-foreground);
			width: 90px;
			flex-shrink: 0;
		}

		.bytes-col {
			display: flex;
			gap: 4px;
			margin-left: 20px;
			font-family: var(--font-mono);
		}

		.byte {
			display: inline-block;
			width: 2.2ch;
			text-align: center;
			color: var(--vscode-editor-foreground);
			cursor: default;
			border-radius: 2px;
		}
		.byte.null { color: var(--vscode-descriptionForeground); opacity: 0.5; }
		.byte:hover { background-color: var(--vscode-editor-selectionBackground); }
		.byte.selected { background-color: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-selectionForeground); }

		.ascii-col {
			margin-left: 30px;
			border-left: 1px solid var(--vscode-panel-border);
			padding-left: 10px;
			display: flex;
		}
		.char {
			width: 1ch;
			text-align: center;
		}
		.char.selected { background-color: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-selectionForeground); }
		.char.non-print { color: var(--vscode-descriptionForeground); opacity: 0.5; }

		/* Sidebar / Data Inspector */
		.sidebar {
			width: 280px;
			background-color: var(--vscode-sideBar-background);
			border-left: 1px solid var(--vscode-panel-border);
			padding: 16px;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 20px;
		}

		.section-header {
			text-transform: uppercase;
			font-size: 11px;
			font-weight: bold;
			color: var(--vscode-sideBarTitle-foreground);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 4px;
			margin-bottom: 8px;
		}

		.data-grid {
			display: grid;
			grid-template-columns: 70px 1fr;
			gap: 6px;
			font-size: 12px;
		}

		.data-label { color: var(--vscode-descriptionForeground); text-align: right; padding-right: 8px; }
		.data-value {
			font-family: var(--font-mono);
			color: var(--vscode-editor-foreground);
			user-select: text;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.endian-toggle {
			display: flex;
			gap: 8px;
			margin-bottom: 12px;
		}
		.endian-btn {
			padding: 4px 8px;
			font-size: 11px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-panel-border);
			cursor: pointer;
			border-radius: 3px;
		}
		.endian-btn.active {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
	</style>
</head>
<body>
	<div class="toolbar">
		<div class="toolbar-item">
			<span class="label">FILE:</span>
			<span class="value" id="fileName">-</span>
		</div>
		<div class="divider"></div>
		<div class="toolbar-item">
			<span class="label">SIZE:</span>
			<span class="value" id="fileSize">-</span>
		</div>
		<div class="divider"></div>
		<div class="toolbar-item">
			<span class="label">OFFSET:</span>
			<span class="value" id="cursorOffset">0x00000000</span>
		</div>
	</div>

	<div class="container">
		<div class="hex-view-container" id="scrollContainer" tabindex="0">
			<div class="phantom-spacer" id="phantomSpacer"></div>
			<div class="content-layer" id="contentLayer"></div>
		</div>

		<div class="sidebar">
			<div>
				<div class="section-header">Data Inspector</div>
				<div class="endian-toggle">
					<button class="endian-btn active" id="btnLE">Little Endian</button>
					<button class="endian-btn" id="btnBE">Big Endian</button>
				</div>
				<div class="data-grid" id="dataInspector">
					<div class="data-label">Int8</div><div class="data-value" id="valInt8">-</div>
					<div class="data-label">UInt8</div><div class="data-value" id="valUInt8">-</div>
					<div class="data-label">Int16</div><div class="data-value" id="valInt16">-</div>
					<div class="data-label">UInt16</div><div class="data-value" id="valUInt16">-</div>
					<div class="data-label">Int32</div><div class="data-value" id="valInt32">-</div>
					<div class="data-label">UInt32</div><div class="data-value" id="valUInt32">-</div>
					<div class="data-label">Int64</div><div class="data-value" id="valInt64">-</div>
					<div class="data-label">UInt64</div><div class="data-value" id="valUInt64">-</div>
					<div class="data-label">Float32</div><div class="data-value" id="valFloat32">-</div>
					<div class="data-label">Float64</div><div class="data-value" id="valFloat64">-</div>
					<div class="data-label">Binary</div><div class="data-value" id="valBinary">-</div>
					<div class="data-label">Unix Time</div><div class="data-value" id="valUnixTime">-</div>
				</div>
			</div>

			<div>
				<div class="section-header">Selection</div>
				<div class="data-grid">
					<div class="data-label">Start</div><div class="data-value" id="selStart">-</div>
					<div class="data-label">End</div><div class="data-value" id="selEnd">-</div>
					<div class="data-label">Length</div><div class="data-value" id="selLen">-</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		// Configuration
		const BYTES_PER_ROW = ${bytesPerRow};
		const ROW_HEIGHT = 24;
		const UPPERCASE = ${uppercase};
		const SHOW_ASCII = ${showAscii};
		const CHUNK_SIZE = 8192; // 8KB chunks for better performance

		// State
		let totalFileSize = 0;
		let totalRows = 0;
		let cachedChunks = new Map(); // offset -> Uint8Array
		let pendingRequests = new Set(); // Track in-flight requests
		let selection = { start: -1, end: -1 };
		let littleEndian = true;

		const scrollContainer = document.getElementById('scrollContainer');
		const phantomSpacer = document.getElementById('phantomSpacer');
		const contentLayer = document.getElementById('contentLayer');

		// Endian toggle buttons
		document.getElementById('btnLE').addEventListener('click', () => {
			littleEndian = true;
			document.getElementById('btnLE').classList.add('active');
			document.getElementById('btnBE').classList.remove('active');
			updateInspector();
		});

		document.getElementById('btnBE').addEventListener('click', () => {
			littleEndian = false;
			document.getElementById('btnBE').classList.add('active');
			document.getElementById('btnLE').classList.remove('active');
			updateInspector();
		});

		// Initialization
		vscode.postMessage({ type: 'ready' });

		window.addEventListener('message', e => {
			const msg = e.data;
			switch (msg.type) {
				case 'init':
					totalFileSize = msg.fileSize;
					totalRows = Math.ceil(totalFileSize / BYTES_PER_ROW);
					document.getElementById('fileName').textContent = msg.fileName.split(/[\\\\/]/).pop();
					document.getElementById('fileSize').textContent = formatBytes(totalFileSize);

					// Setup virtual scroll phantom height
					phantomSpacer.style.height = (totalRows * ROW_HEIGHT) + 'px';

					// Initial render
					onScroll();
					break;

				case 'chunkData':
					const { offset, data } = msg;
					cachedChunks.set(offset, new Uint8Array(data));
					pendingRequests.delete(offset);
					// Re-render to show loaded data
					renderVisibleRows();
					// If selection active, update inspector
					if (selection.start !== -1) updateInspector();
					break;
			}
		});

		// Virtual Scroll Logic
		scrollContainer.addEventListener('scroll', onScroll);

		let scrollRAF = null;
		function onScroll() {
			if (scrollRAF) return;
			scrollRAF = requestAnimationFrame(() => {
				scrollRAF = null;
				renderVisibleRows();
			});
		}

		function renderVisibleRows() {
			const scrollTop = scrollContainer.scrollTop;
			const viewportHeight = scrollContainer.clientHeight;

			const startRow = Math.floor(scrollTop / ROW_HEIGHT);
			const visibleRowCount = Math.ceil(viewportHeight / ROW_HEIGHT);

			// Buffer rows for smooth scrolling
			const buffer = 10;
			const renderStartRow = Math.max(0, startRow - buffer);
			const renderEndRow = Math.min(totalRows, startRow + visibleRowCount + buffer);

			// Position content layer using transform for performance
			contentLayer.style.transform = 'translateY(' + (renderStartRow * ROW_HEIGHT) + 'px)';

			// Generate HTML for visible rows
			let html = '';
			const missingChunks = new Set();

			for (let row = renderStartRow; row < renderEndRow; row++) {
				const rowOffset = row * BYTES_PER_ROW;
				const rowData = getRowData(rowOffset);

				if (!rowData) {
					// Detect missing chunk
					const chunkStart = Math.floor(rowOffset / CHUNK_SIZE) * CHUNK_SIZE;
					if (!cachedChunks.has(chunkStart) && !pendingRequests.has(chunkStart)) {
						missingChunks.add(chunkStart);
					}
				}

				html += generateRowHtml(row, rowOffset, rowData);
			}

			contentLayer.innerHTML = html;

			// Request missing data chunks
			missingChunks.forEach(chunkOffset => {
				pendingRequests.add(chunkOffset);
				vscode.postMessage({
					type: 'requestData',
					offset: chunkOffset,
					length: CHUNK_SIZE
				});
			});
		}

		function getRowData(offset) {
			// Find chunk containing this offset
			const chunkStart = Math.floor(offset / CHUNK_SIZE) * CHUNK_SIZE;
			const chunk = cachedChunks.get(chunkStart);

			if (chunk) {
				const relOffset = offset - chunkStart;
				const endOffset = Math.min(relOffset + BYTES_PER_ROW, chunk.length);
				if (relOffset < chunk.length) {
					return chunk.subarray(relOffset, endOffset);
				}
			}
			return null;
		}

		function generateRowHtml(row, offset, data) {
			const offsetStr = UPPERCASE
				? offset.toString(16).toUpperCase().padStart(8, '0')
				: offset.toString(16).padStart(8, '0');

			let hexHtml = '';
			let asciiHtml = '';

			for (let i = 0; i < BYTES_PER_ROW; i++) {
				const currentOffset = offset + i;
				if (currentOffset >= totalFileSize) break;

				let byteVal = null;
				if (data && i < data.length) {
					byteVal = data[i];
				}

				const isSelected = selection.start !== -1 &&
					currentOffset >= Math.min(selection.start, selection.end) &&
					currentOffset <= Math.max(selection.start, selection.end);

				const selClass = isSelected ? ' selected' : '';

				// Hex byte
				if (byteVal !== null) {
					const hex = UPPERCASE
						? byteVal.toString(16).toUpperCase().padStart(2, '0')
						: byteVal.toString(16).padStart(2, '0');
					const nullClass = byteVal === 0 ? ' null' : '';
					hexHtml += '<span class="byte' + nullClass + selClass + '" data-o="' + currentOffset + '">' + hex + '</span>';
				} else {
					hexHtml += '<span class="byte null' + selClass + '">..</span>';
				}

				// ASCII character
				if (SHOW_ASCII) {
					if (byteVal !== null) {
						const isPrint = byteVal >= 32 && byteVal <= 126;
						const char = isPrint ? String.fromCharCode(byteVal) : '.';
						const npClass = !isPrint ? ' non-print' : '';
						asciiHtml += '<span class="char' + npClass + selClass + '" data-o="' + currentOffset + '">' + escapeHtml(char) + '</span>';
					} else {
						asciiHtml += '<span class="char non-print' + selClass + '">.</span>';
					}
				}
			}

			return '<div class="hex-row">' +
				'<span class="offset-col">0x' + offsetStr + '</span>' +
				'<div class="bytes-col">' + hexHtml + '</div>' +
				(SHOW_ASCII ? '<div class="ascii-col">' + asciiHtml + '</div>' : '') +
				'</div>';
		}

		// Selection handling
		let isSelecting = false;

		scrollContainer.addEventListener('mousedown', e => {
			const target = e.target;
			if (target.dataset && target.dataset.o) {
				const offset = parseInt(target.dataset.o, 10);
				if (e.shiftKey && selection.start !== -1) {
					selection.end = offset;
				} else {
					selection.start = offset;
					selection.end = offset;
				}
				isSelecting = true;
				renderVisibleRows();
				updateInspector();
			}
		});

		scrollContainer.addEventListener('mousemove', e => {
			if (!isSelecting) return;
			const target = e.target;
			if (target.dataset && target.dataset.o) {
				const offset = parseInt(target.dataset.o, 10);
				selection.end = offset;
				renderVisibleRows();
				updateInspector();
			}
		});

		window.addEventListener('mouseup', () => {
			isSelecting = false;
		});

		function updateInspector() {
			if (selection.start === -1) return;

			const start = Math.min(selection.start, selection.end);
			const end = Math.max(selection.start, selection.end);
			const len = end - start + 1;

			document.getElementById('selStart').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selEnd').textContent = '0x' + end.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selLen').textContent = len + ' bytes';
			document.getElementById('cursorOffset').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');

			// Get bytes for data inspector
			const bytes = getBytesAt(start, 8);
			if (!bytes || bytes.length === 0) {
				clearInspector();
				return;
			}

			// Create a DataView with proper alignment
			const buffer = new ArrayBuffer(8);
			const uint8View = new Uint8Array(buffer);
			for (let i = 0; i < Math.min(bytes.length, 8); i++) {
				uint8View[i] = bytes[i];
			}
			const view = new DataView(buffer);

			// Update inspector values
			document.getElementById('valInt8').textContent = bytes.length >= 1 ? view.getInt8(0) : '-';
			document.getElementById('valUInt8').textContent = bytes.length >= 1 ? view.getUint8(0) : '-';
			document.getElementById('valInt16').textContent = bytes.length >= 2 ? view.getInt16(0, littleEndian) : '-';
			document.getElementById('valUInt16').textContent = bytes.length >= 2 ? view.getUint16(0, littleEndian) : '-';
			document.getElementById('valInt32').textContent = bytes.length >= 4 ? view.getInt32(0, littleEndian) : '-';
			document.getElementById('valUInt32').textContent = bytes.length >= 4 ? view.getUint32(0, littleEndian) : '-';

			// Int64/UInt64 with BigInt
			if (bytes.length >= 8) {
				try {
					document.getElementById('valInt64').textContent = view.getBigInt64(0, littleEndian).toString();
					document.getElementById('valUInt64').textContent = view.getBigUint64(0, littleEndian).toString();
				} catch (e) {
					document.getElementById('valInt64').textContent = '-';
					document.getElementById('valUInt64').textContent = '-';
				}
			} else {
				document.getElementById('valInt64').textContent = '-';
				document.getElementById('valUInt64').textContent = '-';
			}

			document.getElementById('valFloat32').textContent = bytes.length >= 4 ? view.getFloat32(0, littleEndian).toPrecision(7) : '-';
			document.getElementById('valFloat64').textContent = bytes.length >= 8 ? view.getFloat64(0, littleEndian).toPrecision(15) : '-';

			// Binary representation of first byte
			document.getElementById('valBinary').textContent = bytes.length >= 1 ? bytes[0].toString(2).padStart(8, '0') : '-';

			// Unix timestamp (4 bytes)
			if (bytes.length >= 4) {
				const timestamp = view.getUint32(0, littleEndian);
				if (timestamp > 0 && timestamp < 4294967295) {
					try {
						const date = new Date(timestamp * 1000);
						document.getElementById('valUnixTime').textContent = date.toISOString().replace('T', ' ').substring(0, 19);
					} catch (e) {
						document.getElementById('valUnixTime').textContent = '-';
					}
				} else {
					document.getElementById('valUnixTime').textContent = '-';
				}
			} else {
				document.getElementById('valUnixTime').textContent = '-';
			}
		}

		function getBytesAt(offset, count) {
			const result = [];
			for (let i = 0; i < count && (offset + i) < totalFileSize; i++) {
				const chunkStart = Math.floor((offset + i) / CHUNK_SIZE) * CHUNK_SIZE;
				const chunk = cachedChunks.get(chunkStart);
				if (chunk) {
					const relOffset = (offset + i) - chunkStart;
					if (relOffset < chunk.length) {
						result.push(chunk[relOffset]);
					}
				}
			}
			return result;
		}

		function clearInspector() {
			const ids = ['valInt8', 'valUInt8', 'valInt16', 'valUInt16', 'valInt32', 'valUInt32',
						 'valInt64', 'valUInt64', 'valFloat32', 'valFloat64', 'valBinary', 'valUnixTime'];
			ids.forEach(id => {
				document.getElementById(id).textContent = '-';
			});
		}

		function formatBytes(bytes) {
			if (bytes === 0) return '0 B';
			const k = 1024;
			const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
		}

		function escapeHtml(text) {
			const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
			return text.replace(/[&<>"']/g, m => map[m]);
		}
	</script>
</body>
</html>`;
	}
}

class HexDocument implements vscode.CustomDocument {
	constructor(
		public readonly uri: vscode.Uri,
		public readonly fileSize: number
	) { }

	dispose(): void { }
}
