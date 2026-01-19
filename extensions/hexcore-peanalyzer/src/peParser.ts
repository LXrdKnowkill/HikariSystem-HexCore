/*---------------------------------------------------------------------------------------------
 *  HexCore PE Analyzer - PE Parser
 *  Parses PE (Portable Executable) files according to Microsoft specification
 *  Copyright (c) HikariSystem. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PEAnalysis {
	fileName: string;
	fileSize: number;
	filePath: string;
	isPE: boolean;
	error?: string;

	// Headers
	dosHeader?: DOSHeader;
	peHeader?: PEHeader;
	optionalHeader?: OptionalHeader;

	// Sections
	sections: SectionHeader[];

	// Imports/Exports
	imports: ImportEntry[];
	exports: ExportEntry[];

	// Analysis
	entropy: number;
	suspiciousStrings: string[];
	packerSignatures: string[];
	timestamps: TimestampInfo;
}

export interface DOSHeader {
	magic: string;           // MZ
	lastPageBytes: number;
	pagesInFile: number;
	relocations: number;
	headerSizeInParagraphs: number;
	peHeaderOffset: number;  // e_lfanew
}

export interface PEHeader {
	signature: string;       // PE\0\0
	machine: string;
	machineRaw: number;
	numberOfSections: number;
	timeDateStamp: number;
	timeDateStampHuman: string;
	pointerToSymbolTable: number;
	numberOfSymbols: number;
	sizeOfOptionalHeader: number;
	characteristics: string[];
	characteristicsRaw: number;
}

export interface OptionalHeader {
	magic: string;           // PE32 or PE32+
	is64Bit: boolean;
	majorLinkerVersion: number;
	minorLinkerVersion: number;
	sizeOfCode: number;
	sizeOfInitializedData: number;
	sizeOfUninitializedData: number;
	addressOfEntryPoint: number;
	baseOfCode: number;
	imageBase: bigint;
	sectionAlignment: number;
	fileAlignment: number;
	majorOSVersion: number;
	minorOSVersion: number;
	majorImageVersion: number;
	minorImageVersion: number;
	majorSubsystemVersion: number;
	minorSubsystemVersion: number;
	sizeOfImage: number;
	sizeOfHeaders: number;
	checksum: number;
	subsystem: string;
	subsystemRaw: number;
	dllCharacteristics: string[];
	dllCharacteristicsRaw: number;
	sizeOfStackReserve: bigint;
	sizeOfStackCommit: bigint;
	sizeOfHeapReserve: bigint;
	sizeOfHeapCommit: bigint;
	numberOfRvaAndSizes: number;
	dataDirectories: DataDirectory[];
}

export interface DataDirectory {
	name: string;
	virtualAddress: number;
	size: number;
}

export interface SectionHeader {
	name: string;
	virtualSize: number;
	virtualAddress: number;
	sizeOfRawData: number;
	pointerToRawData: number;
	characteristics: string[];
	characteristicsRaw: number;
	entropy: number;
}

export interface ImportEntry {
	dllName: string;
	functions: string[];
}

export interface ExportEntry {
	ordinal: number;
	name: string;
	address: number;
}

export interface TimestampInfo {
	compile: string;
	compileUnix: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MACHINE_TYPES: Record<number, string> = {
	0x0: 'Unknown',
	0x14c: 'i386 (x86)',
	0x8664: 'AMD64 (x64)',
	0x1c0: 'ARM',
	0xaa64: 'ARM64',
	0x1c4: 'ARM Thumb-2',
	0x200: 'IA64 (Itanium)',
};

const SUBSYSTEMS: Record<number, string> = {
	0: 'Unknown',
	1: 'Native',
	2: 'Windows GUI',
	3: 'Windows Console',
	5: 'OS/2 Console',
	7: 'POSIX Console',
	9: 'Windows CE GUI',
	10: 'EFI Application',
	11: 'EFI Boot Service Driver',
	12: 'EFI Runtime Driver',
	13: 'EFI ROM',
	14: 'Xbox',
	16: 'Windows Boot Application',
};

const PE_CHARACTERISTICS: Record<number, string> = {
	0x0001: 'RELOCS_STRIPPED',
	0x0002: 'EXECUTABLE_IMAGE',
	0x0004: 'LINE_NUMS_STRIPPED',
	0x0008: 'LOCAL_SYMS_STRIPPED',
	0x0010: 'AGGRESSIVE_WS_TRIM',
	0x0020: 'LARGE_ADDRESS_AWARE',
	0x0080: 'BYTES_REVERSED_LO',
	0x0100: '32BIT_MACHINE',
	0x0200: 'DEBUG_STRIPPED',
	0x0400: 'REMOVABLE_RUN_FROM_SWAP',
	0x0800: 'NET_RUN_FROM_SWAP',
	0x1000: 'SYSTEM',
	0x2000: 'DLL',
	0x4000: 'UP_SYSTEM_ONLY',
	0x8000: 'BYTES_REVERSED_HI',
};

const SECTION_CHARACTERISTICS: Record<number, string> = {
	0x00000020: 'CODE',
	0x00000040: 'INITIALIZED_DATA',
	0x00000080: 'UNINITIALIZED_DATA',
	0x02000000: 'DISCARDABLE',
	0x04000000: 'NOT_CACHED',
	0x08000000: 'NOT_PAGED',
	0x10000000: 'SHARED',
	0x20000000: 'EXECUTE',
	0x40000000: 'READ',
	0x80000000: 'WRITE',
};

const DLL_CHARACTERISTICS: Record<number, string> = {
	0x0020: 'HIGH_ENTROPY_VA',
	0x0040: 'DYNAMIC_BASE (ASLR)',
	0x0080: 'FORCE_INTEGRITY',
	0x0100: 'NX_COMPAT (DEP)',
	0x0200: 'NO_ISOLATION',
	0x0400: 'NO_SEH',
	0x0800: 'NO_BIND',
	0x1000: 'APPCONTAINER',
	0x2000: 'WDM_DRIVER',
	0x4000: 'GUARD_CF',
	0x8000: 'TERMINAL_SERVER_AWARE',
};

const DATA_DIRECTORY_NAMES = [
	'Export Table',
	'Import Table',
	'Resource Table',
	'Exception Table',
	'Certificate Table',
	'Base Relocation Table',
	'Debug',
	'Architecture',
	'Global Ptr',
	'TLS Table',
	'Load Config Table',
	'Bound Import',
	'IAT',
	'Delay Import Descriptor',
	'CLR Runtime Header',
	'Reserved',
];

const PACKER_SIGNATURES: Array<{ name: string; pattern: RegExp | string }> = [
	{ name: 'UPX', pattern: 'UPX0' },
	{ name: 'UPX', pattern: 'UPX1' },
	{ name: 'UPX', pattern: 'UPX!' },
	{ name: 'ASPack', pattern: '.aspack' },
	{ name: 'ASPack', pattern: 'ByDwing' },
	{ name: 'PECompact', pattern: 'PEC2' },
	{ name: 'Themida', pattern: '.themida' },
	{ name: 'VMProtect', pattern: '.vmp0' },
	{ name: 'VMProtect', pattern: '.vmp1' },
	{ name: 'Enigma', pattern: '.enigma' },
	{ name: 'MPRESS', pattern: '.MPRESS' },
	{ name: 'Petite', pattern: '.petite' },
	{ name: 'NSPack', pattern: '.nsp0' },
	{ name: 'PELock', pattern: 'PELock' },
	{ name: 'Armadillo', pattern: '.text1' },
	{ name: '.NET', pattern: 'mscoree.dll' },
];

// ============================================================================
// MAIN PARSER
// ============================================================================

export async function analyzePEFile(filePath: string): Promise<PEAnalysis> {
	const stats = fs.statSync(filePath);
	const fileName = filePath.split(/[\\/]/).pop() || 'Unknown';

	const analysis: PEAnalysis = {
		fileName,
		fileSize: stats.size,
		filePath,
		isPE: false,
		sections: [],
		imports: [],
		exports: [],
		entropy: 0,
		suspiciousStrings: [],
		packerSignatures: [],
		timestamps: { compile: 'Unknown', compileUnix: 0 },
	};

	try {
		const fd = fs.openSync(filePath, 'r');
		const buffer = Buffer.alloc(Math.min(stats.size, 1024 * 1024)); // Read up to 1MB
		fs.readSync(fd, buffer, 0, buffer.length, 0);

		// Parse DOS Header
		if (buffer.length < 64) {
			analysis.error = 'File too small to be a valid PE';
			fs.closeSync(fd);
			return analysis;
		}

		const dosHeader = parseDOSHeader(buffer);
		if (dosHeader.magic !== 'MZ') {
			analysis.error = 'Invalid DOS header (not MZ)';
			fs.closeSync(fd);
			return analysis;
		}
		analysis.dosHeader = dosHeader;

		// Check PE signature
		const peOffset = dosHeader.peHeaderOffset;
		if (peOffset + 4 > buffer.length) {
			analysis.error = 'PE header offset beyond file size';
			fs.closeSync(fd);
			return analysis;
		}

		const peSignature = buffer.toString('ascii', peOffset, peOffset + 4);
		if (peSignature !== 'PE\x00\x00') {
			analysis.error = 'Invalid PE signature';
			fs.closeSync(fd);
			return analysis;
		}

		analysis.isPE = true;

		// Parse PE Header (COFF)
		const peHeader = parsePEHeader(buffer, peOffset + 4);
		analysis.peHeader = peHeader;
		analysis.timestamps = {
			compile: peHeader.timeDateStampHuman,
			compileUnix: peHeader.timeDateStamp,
		};

		// Parse Optional Header
		const optionalHeaderOffset = peOffset + 24;
		if (peHeader.sizeOfOptionalHeader > 0) {
			const optionalHeader = parseOptionalHeader(buffer, optionalHeaderOffset, peHeader.sizeOfOptionalHeader);
			analysis.optionalHeader = optionalHeader;
		}

		// Parse Section Headers
		const sectionOffset = optionalHeaderOffset + peHeader.sizeOfOptionalHeader;
		analysis.sections = parseSectionHeaders(buffer, sectionOffset, peHeader.numberOfSections, fd);

		// Parse Imports
		if (analysis.optionalHeader && analysis.optionalHeader.dataDirectories[1]?.size > 0) {
			analysis.imports = parseImports(fd, buffer, analysis.optionalHeader.dataDirectories[1], analysis.sections);
		}

		// Calculate overall entropy
		analysis.entropy = calculateEntropy(buffer);

		// Detect packers
		analysis.packerSignatures = detectPackers(buffer, analysis.sections);

		// Extract suspicious strings
		analysis.suspiciousStrings = extractSuspiciousStrings(buffer);

		fs.closeSync(fd);
	} catch (error: any) {
		analysis.error = error.message;
	}

	return analysis;
}

// ============================================================================
// HEADER PARSERS
// ============================================================================

function parseDOSHeader(buffer: Buffer): DOSHeader {
	return {
		magic: buffer.toString('ascii', 0, 2),
		lastPageBytes: buffer.readUInt16LE(2),
		pagesInFile: buffer.readUInt16LE(4),
		relocations: buffer.readUInt16LE(6),
		headerSizeInParagraphs: buffer.readUInt16LE(8),
		peHeaderOffset: buffer.readUInt32LE(60), // e_lfanew
	};
}

function parsePEHeader(buffer: Buffer, offset: number): PEHeader {
	const machine = buffer.readUInt16LE(offset);
	const characteristics = buffer.readUInt16LE(offset + 18);
	const timestamp = buffer.readUInt32LE(offset + 4);

	return {
		signature: 'PE',
		machine: MACHINE_TYPES[machine] || `Unknown (0x${machine.toString(16)})`,
		machineRaw: machine,
		numberOfSections: buffer.readUInt16LE(offset + 2),
		timeDateStamp: timestamp,
		timeDateStampHuman: timestamp > 0 ? new Date(timestamp * 1000).toISOString() : 'Invalid',
		pointerToSymbolTable: buffer.readUInt32LE(offset + 8),
		numberOfSymbols: buffer.readUInt32LE(offset + 12),
		sizeOfOptionalHeader: buffer.readUInt16LE(offset + 16),
		characteristics: parseFlags(characteristics, PE_CHARACTERISTICS),
		characteristicsRaw: characteristics,
	};
}

function parseOptionalHeader(buffer: Buffer, offset: number, size: number): OptionalHeader {
	const magic = buffer.readUInt16LE(offset);
	const is64Bit = magic === 0x20b;

	const subsystem = buffer.readUInt16LE(offset + (is64Bit ? 68 : 68));
	const dllCharacteristics = buffer.readUInt16LE(offset + (is64Bit ? 70 : 70));

	// Parse data directories
	const numberOfRvaAndSizes = buffer.readUInt32LE(offset + (is64Bit ? 108 : 92));
	const dataDirectoriesOffset = offset + (is64Bit ? 112 : 96);
	const dataDirectories: DataDirectory[] = [];

	for (let i = 0; i < Math.min(numberOfRvaAndSizes, 16); i++) {
		const ddOffset = dataDirectoriesOffset + i * 8;
		if (ddOffset + 8 <= buffer.length) {
			dataDirectories.push({
				name: DATA_DIRECTORY_NAMES[i] || `Directory ${i}`,
				virtualAddress: buffer.readUInt32LE(ddOffset),
				size: buffer.readUInt32LE(ddOffset + 4),
			});
		}
	}

	return {
		magic: is64Bit ? 'PE32+ (64-bit)' : 'PE32 (32-bit)',
		is64Bit,
		majorLinkerVersion: buffer.readUInt8(offset + 2),
		minorLinkerVersion: buffer.readUInt8(offset + 3),
		sizeOfCode: buffer.readUInt32LE(offset + 4),
		sizeOfInitializedData: buffer.readUInt32LE(offset + 8),
		sizeOfUninitializedData: buffer.readUInt32LE(offset + 12),
		addressOfEntryPoint: buffer.readUInt32LE(offset + 16),
		baseOfCode: buffer.readUInt32LE(offset + 20),
		imageBase: is64Bit ? buffer.readBigUInt64LE(offset + 24) : BigInt(buffer.readUInt32LE(offset + 28)),
		sectionAlignment: buffer.readUInt32LE(offset + (is64Bit ? 32 : 32)),
		fileAlignment: buffer.readUInt32LE(offset + (is64Bit ? 36 : 36)),
		majorOSVersion: buffer.readUInt16LE(offset + (is64Bit ? 40 : 40)),
		minorOSVersion: buffer.readUInt16LE(offset + (is64Bit ? 42 : 42)),
		majorImageVersion: buffer.readUInt16LE(offset + (is64Bit ? 44 : 44)),
		minorImageVersion: buffer.readUInt16LE(offset + (is64Bit ? 46 : 46)),
		majorSubsystemVersion: buffer.readUInt16LE(offset + (is64Bit ? 48 : 48)),
		minorSubsystemVersion: buffer.readUInt16LE(offset + (is64Bit ? 50 : 50)),
		sizeOfImage: buffer.readUInt32LE(offset + (is64Bit ? 56 : 56)),
		sizeOfHeaders: buffer.readUInt32LE(offset + (is64Bit ? 60 : 60)),
		checksum: buffer.readUInt32LE(offset + (is64Bit ? 64 : 64)),
		subsystem: SUBSYSTEMS[subsystem] || `Unknown (${subsystem})`,
		subsystemRaw: subsystem,
		dllCharacteristics: parseFlags(dllCharacteristics, DLL_CHARACTERISTICS),
		dllCharacteristicsRaw: dllCharacteristics,
		sizeOfStackReserve: is64Bit ? buffer.readBigUInt64LE(offset + 72) : BigInt(buffer.readUInt32LE(offset + 72)),
		sizeOfStackCommit: is64Bit ? buffer.readBigUInt64LE(offset + 80) : BigInt(buffer.readUInt32LE(offset + 76)),
		sizeOfHeapReserve: is64Bit ? buffer.readBigUInt64LE(offset + 88) : BigInt(buffer.readUInt32LE(offset + 80)),
		sizeOfHeapCommit: is64Bit ? buffer.readBigUInt64LE(offset + 96) : BigInt(buffer.readUInt32LE(offset + 84)),
		numberOfRvaAndSizes,
		dataDirectories,
	};
}

function parseSectionHeaders(buffer: Buffer, offset: number, count: number, fd: number): SectionHeader[] {
	const sections: SectionHeader[] = [];

	for (let i = 0; i < count; i++) {
		const secOffset = offset + i * 40;
		if (secOffset + 40 > buffer.length) break;

		const name = buffer.toString('ascii', secOffset, secOffset + 8).replace(/\x00/g, '');
		const characteristics = buffer.readUInt32LE(secOffset + 36);
		const pointerToRawData = buffer.readUInt32LE(secOffset + 20);
		const sizeOfRawData = buffer.readUInt32LE(secOffset + 16);

		// Calculate section entropy
		let entropy = 0;
		if (sizeOfRawData > 0 && pointerToRawData > 0) {
			try {
				const sectionBuffer = Buffer.alloc(Math.min(sizeOfRawData, 65536));
				fs.readSync(fd, sectionBuffer, 0, sectionBuffer.length, pointerToRawData);
				entropy = calculateEntropy(sectionBuffer);
			} catch (e) {
				entropy = 0;
			}
		}

		sections.push({
			name,
			virtualSize: buffer.readUInt32LE(secOffset + 8),
			virtualAddress: buffer.readUInt32LE(secOffset + 12),
			sizeOfRawData,
			pointerToRawData,
			characteristics: parseFlags(characteristics, SECTION_CHARACTERISTICS),
			characteristicsRaw: characteristics,
			entropy,
		});
	}

	return sections;
}

// ============================================================================
// IMPORT PARSER
// ============================================================================

function parseImports(fd: number, headerBuffer: Buffer, importDir: DataDirectory, sections: SectionHeader[]): ImportEntry[] {
	const imports: ImportEntry[] = [];

	if (importDir.virtualAddress === 0 || importDir.size === 0) {
		return imports;
	}

	// Find section containing import directory
	const fileOffset = rvaToFileOffset(importDir.virtualAddress, sections);
	if (fileOffset === 0) return imports;

	// Determine if 32-bit or 64-bit based on Optional Header magic (already parsed)
	// For simplicity, we'll try to detect from the imports themselves

	try {
		const importBuffer = Buffer.alloc(Math.min(importDir.size, 16384));
		fs.readSync(fd, importBuffer, 0, importBuffer.length, fileOffset);

		let offset = 0;
		while (offset + 20 <= importBuffer.length && imports.length < 200) {
			const originalFirstThunk = importBuffer.readUInt32LE(offset); // ILT RVA
			const nameRVA = importBuffer.readUInt32LE(offset + 12);
			const firstThunk = importBuffer.readUInt32LE(offset + 16); // IAT RVA

			if (nameRVA === 0) break;

			// Read DLL name
			const nameOffset = rvaToFileOffset(nameRVA, sections);
			if (nameOffset > 0) {
				const nameBuffer = Buffer.alloc(256);
				fs.readSync(fd, nameBuffer, 0, 256, nameOffset);
				const dllName = readNullTerminatedString(nameBuffer);

				// Parse imported functions from ILT or IAT
				const functions: string[] = [];
				const thunkRVA = originalFirstThunk || firstThunk;

				if (thunkRVA > 0) {
					const thunkOffset = rvaToFileOffset(thunkRVA, sections);
					if (thunkOffset > 0) {
						const thunkBuffer = Buffer.alloc(2048);
						fs.readSync(fd, thunkBuffer, 0, thunkBuffer.length, thunkOffset);

						let thunkPos = 0;
						while (thunkPos + 4 <= thunkBuffer.length && functions.length < 100) {
							const thunkValue = thunkBuffer.readUInt32LE(thunkPos);
							if (thunkValue === 0) break;

							// Check if import by ordinal (high bit set for 32-bit)
							if (thunkValue & 0x80000000) {
								const ordinal = thunkValue & 0xFFFF;
								functions.push(`Ordinal ${ordinal}`);
							} else {
								// Import by name - thunkValue is RVA to IMAGE_IMPORT_BY_NAME
								const hintNameOffset = rvaToFileOffset(thunkValue, sections);
								if (hintNameOffset > 0) {
									const hintNameBuffer = Buffer.alloc(256);
									fs.readSync(fd, hintNameBuffer, 0, 256, hintNameOffset);
									// Skip 2-byte hint, read name
									const funcName = readNullTerminatedString(hintNameBuffer.subarray(2));
									if (funcName.length > 0 && funcName.length < 200) {
										functions.push(funcName);
									}
								}
							}

							thunkPos += 4; // 32-bit thunk size
						}
					}
				}

				imports.push({
					dllName,
					functions: functions.slice(0, 50), // Limit to 50 functions per DLL
				});
			}

			offset += 20; // Size of IMAGE_IMPORT_DESCRIPTOR
		}
	} catch (e) {
		// Ignore parsing errors
	}

	return imports;
}

// ============================================================================
// UTILITIES
// ============================================================================

function parseFlags(value: number, flagMap: Record<number, string>): string[] {
	const flags: string[] = [];
	for (const [flag, name] of Object.entries(flagMap)) {
		if (value & parseInt(flag)) {
			flags.push(name);
		}
	}
	return flags;
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

	return Math.round(entropy * 100) / 100;
}

function rvaToFileOffset(rva: number, sections: SectionHeader[]): number {
	for (const section of sections) {
		if (rva >= section.virtualAddress && rva < section.virtualAddress + section.virtualSize) {
			return section.pointerToRawData + (rva - section.virtualAddress);
		}
	}
	return 0;
}

function readNullTerminatedString(buffer: Buffer): string {
	let end = buffer.indexOf(0);
	if (end === -1) end = buffer.length;
	return buffer.toString('ascii', 0, end);
}

function detectPackers(buffer: Buffer, sections: SectionHeader[]): string[] {
	const detected: Set<string> = new Set();
	const bufferStr = buffer.toString('binary');

	for (const sig of PACKER_SIGNATURES) {
		if (typeof sig.pattern === 'string') {
			if (bufferStr.includes(sig.pattern)) {
				detected.add(sig.name);
			}
		}
	}

	// Check section names for packer signatures
	for (const section of sections) {
		const name = section.name.toLowerCase();
		if (name.includes('upx')) detected.add('UPX');
		if (name.includes('aspack')) detected.add('ASPack');
		if (name.includes('vmp')) detected.add('VMProtect');
		if (name.includes('themida')) detected.add('Themida');
		if (name.includes('enigma')) detected.add('Enigma');
	}

	return Array.from(detected);
}

function extractSuspiciousStrings(buffer: Buffer): string[] {
	const suspicious: string[] = [];
	const patterns = [
		/https?:\/\/[^\s"'<>]+/gi,                    // URLs
		/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,   // IP addresses
		/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Emails
		/\\\\[^\\]+\\[^\\]+/g,                        // UNC paths
		/HKEY_[A-Z_]+\\[^\0]+/gi,                     // Registry keys
		/cmd\.exe|powershell|wscript|cscript/gi,     // Suspicious executables
		/password|passwd|secret|token|api[_-]?key/gi, // Sensitive keywords
	];

	const bufferStr = buffer.toString('binary');

	for (const pattern of patterns) {
		const matches = bufferStr.match(pattern);
		if (matches) {
			for (const match of matches.slice(0, 10)) { // Limit to 10 per pattern
				if (match.length > 5 && match.length < 200) {
					suspicious.push(match);
				}
			}
		}
	}

	return [...new Set(suspicious)].slice(0, 50); // Dedupe and limit
}
