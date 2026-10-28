import { isTauri } from "@tauri-apps/api/core";
import {
	exists,
	readTextFile,
	stat,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import { assertSafePath } from "$/modules/project/folder-project/manifest";
import { produceTTMLText } from "$/modules/project/logic/ttml-export";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import type { TTMLExportOptions } from "$/modules/project/logic/ttml-writer";
import type { TTMLLyric } from "$/types/ttml";
import type { LyricTextNormalizationOptions } from "$/utils/apostrophe-normalization";

export const MAX_LYRIC_BYTES = 10 * 1024 * 1024;

export async function readProjectLyricFile(
	baseDir: string,
	relativeFileName: string,
): Promise<TTMLLyric> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	const fileExists = await exists(safePath);
	if (!fileExists) {
		throw new Error(`Lyric file not found: ${relativeFileName}`);
	}
	const fileStat = await stat(safePath);
	if (!fileStat.isFile) {
		throw new Error(`Lyric path is not a regular file: ${relativeFileName}`);
	}
	if (fileStat.size > MAX_LYRIC_BYTES) {
		throw new Error(
			`Lyric file size (${Math.round(fileStat.size / 1024)}KB) exceeds 10MB safety limit`,
		);
	}
	const content = await readTextFile(safePath);
	return parseLyric(content);
}

export function generateProjectTtmlText(
	lyric: TTMLLyric,
	normalizationOptions?: LyricTextNormalizationOptions,
	options?: TTMLExportOptions,
): string {
	return produceTTMLText(lyric, normalizationOptions, options);
}

export async function writeProjectLyricFile(
	baseDir: string,
	relativeFileName: string,
	content: string,
): Promise<string> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	await writeTextFile(safePath, content);
	return safePath;
}
