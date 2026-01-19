/*---------------------------------------------------------------------------------------------
 *  HexCore Hex Viewer v1.2.0 - Custom Editor Provider
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

				case 'search':
					try {
						const results = await this.searchHex(document.uri, document.fileSize, message.pattern);
						webviewPanel.webview.postMessage({
							type: 'searchResults',
							results: results
						});
					} catch (e) {
						vscode.window.showErrorMessage('Search failed: ' + e);
					}
					break;

				case 'goToOffset':
					webviewPanel.webview.postMessage({
						type: 'jumpToOffset',
						offset: message.offset
					});
					break;
			}
		});
	}

	private async readChunk(uri: vscode.Uri, offset: number, length: number): Promise<Uint8Array> {
		if (uri.scheme === 'file') {
			return new Promise((resolve, reject) => {
				fs.open(uri.fsPath, 'r', (err: NodeJS.ErrnoException | null, fd: number) => {
					if (err) return reject(err);
					const buffer = Buffer.alloc(length);
					fs.read(fd, buffer, 0, length, offset, (readErr: NodeJS.ErrnoException | null, bytesRead: number) => {
						fs.close(fd, () => { });
						if (readErr) return reject(readErr);
						resolve(buffer.slice(0, bytesRead));
					});
				});
			});
		} else {
			const allData = await vscode.workspace.fs.readFile(uri);
			return allData.slice(offset, offset + length);
		}
	}

	private async searchHex(uri: vscode.Uri, fileSize: number, pattern: string): Promise<number[]> {
		const results: number[] = [];
		const hexPattern = pattern.replace(/\s+/g, '').toUpperCase();

		if (hexPattern.length === 0 || hexPattern.length % 2 !== 0) {
			return results;
		}

		const searchBytes: number[] = [];
		for (let i = 0; i < hexPattern.length; i += 2) {
			const byte = parseInt(hexPattern.substr(i, 2), 16);
			if (isNaN(byte)) return results;
			searchBytes.push(byte);
		}

		const chunkSize = 65536;
		const overlap = searchBytes.length - 1;

		for (let offset = 0; offset < fileSize && results.length < 1000; offset += chunkSize - overlap) {
			const length = Math.min(chunkSize, fileSize - offset);
			const data = await this.readChunk(uri, offset, length);

			for (let i = 0; i <= data.length - searchBytes.length; i++) {
				let match = true;
				for (let j = 0; j < searchBytes.length; j++) {
					if (data[i + j] !== searchBytes[j]) {
						match = false;
						break;
					}
				}
				if (match) {
					const absoluteOffset = offset + i;
					if (results.length === 0 || results[results.length - 1] !== absoluteOffset) {
						results.push(absoluteOffset);
					}
				}
			}
		}

		return results;
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
			--row-height: 22px;
		}

		* { margin: 0; padding: 0; box-sizing: border-box; }

		body {
			font-family: var(--font-mono);
			background-color: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			font-size: 13px;
			overflow: hidden;
			user-select: none;
		}

		/* Toolbar */
		.toolbar {
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 6px 12px;
			background: var(--vscode-editor-background);
			border-bottom: 1px solid var(--vscode-panel-border);
			height: 36px;
		}

		.toolbar-item {
			display: flex;
			align-items: center;
			gap: 6px;
			font-size: 11px;
		}

		.label { color: var(--vscode-descriptionForeground); }
		.value { color: var(--vscode-textLink-foreground); font-weight: bold; }
		.divider { width: 1px; height: 16px; background: var(--vscode-panel-border); }

		/* Search and Go to Offset */
		.toolbar-input {
			display: flex;
			align-items: center;
			gap: 4px;
		}

		.toolbar-input input {
			background: var(--vscode-input-background);
			border: 1px solid var(--vscode-input-border);
			color: var(--vscode-input-foreground);
			padding: 3px 6px;
			font-size: 11px;
			font-family: var(--font-mono);
			width: 120px;
			border-radius: 3px;
		}

		.toolbar-input input:focus {
			outline: 1px solid var(--vscode-focusBorder);
		}

		.toolbar-btn {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: none;
			padding: 4px 8px;
			font-size: 11px;
			cursor: pointer;
			border-radius: 3px;
		}

		.toolbar-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}

		/* Main Layout */
		.container {
			display: flex;
			height: calc(100vh - 36px);
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
		.hex-row.highlight { background-color: var(--vscode-editor-findMatchHighlightBackground); }

		.offset-col {
			color: var(--vscode-editorLineNumber-foreground);
			width: 80px;
			flex-shrink: 0;
			font-size: 11px;
		}

		.bytes-col {
			display: flex;
			gap: 3px;
			margin-left: 16px;
			font-family: var(--font-mono);
		}

		.byte {
			display: inline-block;
			width: 2ch;
			text-align: center;
			font-size: 12px;
			cursor: default;
			border-radius: 2px;
		}
		.byte.null { color: var(--vscode-descriptionForeground); opacity: 0.4; }
		.byte:hover { background-color: var(--vscode-editor-selectionBackground); }
		.byte.selected { background-color: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-selectionForeground); }
		.byte.search-match { background-color: var(--vscode-editor-findMatchBackground); color: var(--vscode-editor-findMatchForeground); }

		.ascii-col {
			margin-left: 24px;
			border-left: 1px solid var(--vscode-panel-border);
			padding-left: 10px;
			display: flex;
			font-size: 11px;
		}
		.char {
			width: 1ch;
			text-align: center;
		}
		.char.selected { background-color: var(--vscode-editor-selectionBackground); color: var(--vscode-editor-selectionForeground); }
		.char.non-print { color: var(--vscode-descriptionForeground); opacity: 0.4; }

		/* Sidebar */
		.sidebar {
			width: 260px;
			background-color: var(--vscode-sideBar-background);
			border-left: 1px solid var(--vscode-panel-border);
			padding: 12px;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 16px;
		}

		.section-header {
			text-transform: uppercase;
			font-size: 10px;
			font-weight: bold;
			color: var(--vscode-sideBarTitle-foreground);
			border-bottom: 1px solid var(--vscode-panel-border);
			padding-bottom: 4px;
			margin-bottom: 6px;
		}

		.data-grid {
			display: grid;
			grid-template-columns: 65px 1fr;
			gap: 4px;
			font-size: 11px;
		}

		.data-label { color: var(--vscode-descriptionForeground); text-align: right; padding-right: 6px; }
		.data-value {
			font-family: var(--font-mono);
			color: var(--vscode-editor-foreground);
			user-select: text;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			font-size: 11px;
		}
		.data-value.loading { color: var(--vscode-descriptionForeground); font-style: italic; }

		.endian-toggle {
			display: flex;
			gap: 4px;
			margin-bottom: 8px;
		}
		.endian-btn {
			padding: 3px 6px;
			font-size: 10px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-panel-border);
			cursor: pointer;
			border-radius: 2px;
		}
		.endian-btn.active {
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}

		/* Copy Buttons */
		.copy-section {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.copy-btn {
			padding: 4px 8px;
			font-size: 10px;
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
			border: 1px solid var(--vscode-panel-border);
			cursor: pointer;
			border-radius: 3px;
			text-align: left;
		}
		.copy-btn:hover {
			background: var(--vscode-button-secondaryHoverBackground);
		}
		.copy-btn:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}

		/* Search Results */
		.search-results {
			max-height: 150px;
			overflow-y: auto;
			font-size: 10px;
		}
		.search-result-item {
			padding: 3px 6px;
			cursor: pointer;
			border-radius: 2px;
		}
		.search-result-item:hover {
			background: var(--vscode-list-hoverBackground);
		}
		.search-info {
			font-size: 10px;
			color: var(--vscode-descriptionForeground);
			margin-bottom: 4px;
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
		<div class="divider"></div>
		<div class="toolbar-input">
			<input type="text" id="searchInput" placeholder="Search hex (4D 5A)" />
			<button class="toolbar-btn" id="searchBtn">Find</button>
		</div>
		<div class="toolbar-input">
			<input type="text" id="gotoInput" placeholder="Go to offset" />
			<button class="toolbar-btn" id="gotoBtn">Go</button>
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
					<button class="endian-btn active" id="btnLE">LE</button>
					<button class="endian-btn" id="btnBE">BE</button>
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
					<div class="data-label">Unix</div><div class="data-value" id="valUnixTime">-</div>
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

			<div>
				<div class="section-header">Copy Selection</div>
				<div class="copy-section">
					<button class="copy-btn" id="copyHex" disabled>Copy as Hex</button>
					<button class="copy-btn" id="copyCArray" disabled>Copy as C Array</button>
					<button class="copy-btn" id="copyPython" disabled>Copy as Python</button>
				</div>
			</div>

			<div id="searchResultsSection" style="display: none;">
				<div class="section-header">Search Results</div>
				<div class="search-info" id="searchInfo">-</div>
				<div class="search-results" id="searchResults"></div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		// Configuration
		const BYTES_PER_ROW = ${bytesPerRow};
		const ROW_HEIGHT = 22;
		const UPPERCASE = ${uppercase};
		const SHOW_ASCII = ${showAscii};
		const CHUNK_SIZE = 8192;

		// State
		let totalFileSize = 0;
		let totalRows = 0;
		let cachedChunks = new Map();
		let pendingRequests = new Set();
		let selection = { start: -1, end: -1 };
		let littleEndian = true;
		let isSelecting = false;
		let searchMatches = [];
		let inspectorPendingOffset = -1;

		const scrollContainer = document.getElementById('scrollContainer');
		const phantomSpacer = document.getElementById('phantomSpacer');
		const contentLayer = document.getElementById('contentLayer');

		// Endian toggle
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

		// Search functionality
		document.getElementById('searchBtn').addEventListener('click', doSearch);
		document.getElementById('searchInput').addEventListener('keydown', e => {
			if (e.key === 'Enter') doSearch();
		});

		function doSearch() {
			const pattern = document.getElementById('searchInput').value.trim();
			if (pattern) {
				document.getElementById('searchInfo').textContent = 'Searching...';
				document.getElementById('searchResultsSection').style.display = 'block';
				vscode.postMessage({ type: 'search', pattern: pattern });
			}
		}

		// Go to offset
		document.getElementById('gotoBtn').addEventListener('click', doGoto);
		document.getElementById('gotoInput').addEventListener('keydown', e => {
			if (e.key === 'Enter') doGoto();
		});

		function doGoto() {
			const input = document.getElementById('gotoInput').value.trim();
			let offset = 0;
			if (input.toLowerCase().startsWith('0x')) {
				offset = parseInt(input, 16);
			} else {
				offset = parseInt(input, 10);
			}
			if (!isNaN(offset) && offset >= 0 && offset < totalFileSize) {
				jumpToOffset(offset);
			}
		}

		function jumpToOffset(offset) {
			const row = Math.floor(offset / BYTES_PER_ROW);
			scrollContainer.scrollTop = row * ROW_HEIGHT;
			selection.start = offset;
			selection.end = offset;
			renderVisibleRows();
			updateInspector();
		}

		// Copy buttons
		document.getElementById('copyHex').addEventListener('click', () => copySelection('hex'));
		document.getElementById('copyCArray').addEventListener('click', () => copySelection('carray'));
		document.getElementById('copyPython').addEventListener('click', () => copySelection('python'));

		function copySelection(format) {
			if (selection.start === -1) return;
			const start = Math.min(selection.start, selection.end);
			const end = Math.max(selection.start, selection.end);
			const bytes = getBytesRange(start, end - start + 1);
			if (bytes.length === 0) return;

			let text = '';
			if (format === 'hex') {
				text = bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
			} else if (format === 'carray') {
				text = 'unsigned char data[] = { ' + bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ') + ' };';
			} else if (format === 'python') {
				text = 'b"' + bytes.map(b => '\\\\x' + b.toString(16).padStart(2, '0')).join('') + '"';
			}

			vscode.postMessage({ type: 'copyToClipboard', text: text });
		}

		function getBytesRange(start, count) {
			const result = [];
			for (let i = 0; i < count && (start + i) < totalFileSize; i++) {
				const chunkStart = Math.floor((start + i) / CHUNK_SIZE) * CHUNK_SIZE;
				const chunk = cachedChunks.get(chunkStart);
				if (chunk) {
					const relOffset = (start + i) - chunkStart;
					if (relOffset < chunk.length) {
						result.push(chunk[relOffset]);
					}
				}
			}
			return result;
		}

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
					phantomSpacer.style.height = (totalRows * ROW_HEIGHT) + 'px';
					onScroll();
					break;

				case 'chunkData':
					cachedChunks.set(msg.offset, new Uint8Array(msg.data));
					pendingRequests.delete(msg.offset);
					renderVisibleRows();
					// Update inspector if we were waiting for this data
					if (inspectorPendingOffset !== -1) {
						const chunkStart = Math.floor(inspectorPendingOffset / CHUNK_SIZE) * CHUNK_SIZE;
						if (chunkStart === msg.offset) {
							updateInspector();
						}
					}
					break;

				case 'searchResults':
					searchMatches = msg.results;
					document.getElementById('searchInfo').textContent = msg.results.length + ' matches found' + (msg.results.length >= 1000 ? ' (limited)' : '');
					const resultsDiv = document.getElementById('searchResults');
					resultsDiv.innerHTML = msg.results.slice(0, 100).map(offset =>
						'<div class="search-result-item" data-offset="' + offset + '">0x' + offset.toString(16).toUpperCase().padStart(8, '0') + '</div>'
					).join('');
					resultsDiv.querySelectorAll('.search-result-item').forEach(el => {
						el.addEventListener('click', () => jumpToOffset(parseInt(el.dataset.offset)));
					});
					renderVisibleRows();
					break;

				case 'jumpToOffset':
					jumpToOffset(msg.offset);
					break;
			}
		});

		// Virtual Scroll
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
			const buffer = 5;
			const renderStartRow = Math.max(0, startRow - buffer);
			const renderEndRow = Math.min(totalRows, startRow + visibleRowCount + buffer);

			contentLayer.style.transform = 'translateY(' + (renderStartRow * ROW_HEIGHT) + 'px)';

			let html = '';
			const missingChunks = new Set();

			for (let row = renderStartRow; row < renderEndRow; row++) {
				const rowOffset = row * BYTES_PER_ROW;
				const rowData = getRowData(rowOffset);

				if (!rowData) {
					const chunkStart = Math.floor(rowOffset / CHUNK_SIZE) * CHUNK_SIZE;
					if (!cachedChunks.has(chunkStart) && !pendingRequests.has(chunkStart)) {
						missingChunks.add(chunkStart);
					}
				}

				html += generateRowHtml(row, rowOffset, rowData);
			}

			contentLayer.innerHTML = html;

			missingChunks.forEach(chunkOffset => {
				pendingRequests.add(chunkOffset);
				vscode.postMessage({ type: 'requestData', offset: chunkOffset, length: CHUNK_SIZE });
			});
		}

		function getRowData(offset) {
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
				if (data && i < data.length) byteVal = data[i];

				const isSelected = selection.start !== -1 &&
					currentOffset >= Math.min(selection.start, selection.end) &&
					currentOffset <= Math.max(selection.start, selection.end);

				const isSearchMatch = searchMatches.includes(currentOffset);

				let classes = 'byte';
				if (byteVal === 0) classes += ' null';
				if (isSelected) classes += ' selected';
				if (isSearchMatch) classes += ' search-match';

				if (byteVal !== null) {
					const hex = UPPERCASE
						? byteVal.toString(16).toUpperCase().padStart(2, '0')
						: byteVal.toString(16).padStart(2, '0');
					hexHtml += '<span class="' + classes + '" data-o="' + currentOffset + '">' + hex + '</span>';
				} else {
					hexHtml += '<span class="byte null">..</span>';
				}

				if (SHOW_ASCII) {
					if (byteVal !== null) {
						const isPrint = byteVal >= 32 && byteVal <= 126;
						const char = isPrint ? String.fromCharCode(byteVal) : '.';
						const charClasses = 'char' + (isSelected ? ' selected' : '') + (!isPrint ? ' non-print' : '');
						asciiHtml += '<span class="' + charClasses + '" data-o="' + currentOffset + '">' + escapeHtml(char) + '</span>';
					} else {
						asciiHtml += '<span class="char non-print">.</span>';
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
				updateCopyButtons();
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
				updateCopyButtons();
			}
		});

		window.addEventListener('mouseup', () => {
			isSelecting = false;
		});

		function updateCopyButtons() {
			const hasSelection = selection.start !== -1;
			document.getElementById('copyHex').disabled = !hasSelection;
			document.getElementById('copyCArray').disabled = !hasSelection;
			document.getElementById('copyPython').disabled = !hasSelection;
		}

		function updateInspector() {
			if (selection.start === -1) return;

			const start = Math.min(selection.start, selection.end);
			const end = Math.max(selection.start, selection.end);
			const len = end - start + 1;

			document.getElementById('selStart').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selEnd').textContent = '0x' + end.toString(16).toUpperCase().padStart(8, '0');
			document.getElementById('selLen').textContent = len + ' bytes';
			document.getElementById('cursorOffset').textContent = '0x' + start.toString(16).toUpperCase().padStart(8, '0');

			// Get 8 bytes starting at selection for inspector
			const bytes = getBytesRange(start, 8);

			if (bytes.length === 0) {
				// Request the chunk if not loaded
				const chunkStart = Math.floor(start / CHUNK_SIZE) * CHUNK_SIZE;
				if (!cachedChunks.has(chunkStart) && !pendingRequests.has(chunkStart)) {
					inspectorPendingOffset = start;
					pendingRequests.add(chunkStart);
					vscode.postMessage({ type: 'requestData', offset: chunkStart, length: CHUNK_SIZE });
					setInspectorLoading();
				}
				return;
			}

			inspectorPendingOffset = -1;

			// Create DataView
			const buffer = new ArrayBuffer(8);
			const uint8View = new Uint8Array(buffer);
			for (let i = 0; i < Math.min(bytes.length, 8); i++) {
				uint8View[i] = bytes[i];
			}
			const view = new DataView(buffer);

			// Update values
			document.getElementById('valInt8').textContent = bytes.length >= 1 ? view.getInt8(0) : '-';
			document.getElementById('valUInt8').textContent = bytes.length >= 1 ? view.getUint8(0) : '-';
			document.getElementById('valInt16').textContent = bytes.length >= 2 ? view.getInt16(0, littleEndian) : '-';
			document.getElementById('valUInt16').textContent = bytes.length >= 2 ? view.getUint16(0, littleEndian) : '-';
			document.getElementById('valInt32').textContent = bytes.length >= 4 ? view.getInt32(0, littleEndian) : '-';
			document.getElementById('valUInt32').textContent = bytes.length >= 4 ? view.getUint32(0, littleEndian) : '-';

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

			document.getElementById('valFloat32').textContent = bytes.length >= 4 ? view.getFloat32(0, littleEndian).toPrecision(6) : '-';
			document.getElementById('valFloat64').textContent = bytes.length >= 8 ? view.getFloat64(0, littleEndian).toPrecision(10) : '-';
			document.getElementById('valBinary').textContent = bytes.length >= 1 ? bytes[0].toString(2).padStart(8, '0') : '-';

			if (bytes.length >= 4) {
				const ts = view.getUint32(0, littleEndian);
				if (ts > 0 && ts < 4294967295) {
					try {
						document.getElementById('valUnixTime').textContent = new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
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

		function setInspectorLoading() {
			const ids = ['valInt8', 'valUInt8', 'valInt16', 'valUInt16', 'valInt32', 'valUInt32',
						 'valInt64', 'valUInt64', 'valFloat32', 'valFloat64', 'valBinary', 'valUnixTime'];
			ids.forEach(id => {
				const el = document.getElementById(id);
				el.textContent = '...';
				el.classList.add('loading');
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
