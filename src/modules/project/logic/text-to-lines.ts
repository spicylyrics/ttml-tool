import { getGeniusHeader } from "$/modules/lyric-editor/utils/genius-sections";
import {
	isGeniusPageTitle,
	trimInvisible,
} from "$/modules/lyric-editor/utils/section-system";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { type LyricPrepOptions, prepareLyricLine } from "$/utils/lyric-prep";
import { splitTextImportWords } from "./text-import-words";

export interface TextToLinesOptions {
	processLyrics?: boolean;
	sectionHeaders?: "preserve" | "categorize" | "discard";
	blankLines?: "preserve" | "discard";
	wordSeparator?: string;
	/** Split after hyphens; off when the source should come in as-is. */
	splitHyphens?: boolean;
	collapseWhitespace?: boolean;
	backgroundPrefix?: string;
	duetPrefix?: string;
	mode?: "lyric" | "lyric-trans" | "lyric-roman" | "lyric-trans-roman";
	lineSeparatorMode?: "interleaved-line" | "same-line-separator";
	lineSeparator?: string;
	swapTransAndRoman?: boolean;
}

/** Shared preprocessing for the editable text preview and online imports. */
export function prepareTextImport(
	text: string,
	keepSectionHeaders: boolean,
	steps: Partial<LyricPrepOptions> = {},
): string {
	return text
		.split(/\r\n|\r|\n/)
		.flatMap((line) => {
			const trimmed = trimInvisible(line);
			if (/^\[.*\]$/.test(trimmed)) {
				return keepSectionHeaders && !isGeniusPageTitle(trimmed)
					? [trimmed]
					: [];
			}
			return prepareLyricLine(line, steps).split("\n");
		})
		.filter((line) => line.trim().length > 0)
		.join("\n");
}

/** Convert source text to untimed editor lines without touching editor state. */
export function textToLines(
	text: string,
	options: TextToLinesOptions = {},
): LyricLine[] {
	const {
		processLyrics = false,
		sectionHeaders = "discard",
		blankLines = "discard",
		wordSeparator = processLyrics ? "\\" : "",
		splitHyphens = true,
		collapseWhitespace = false,
		backgroundPrefix = processLyrics ? "<" : "",
		duetPrefix = "",
		mode = "lyric",
		lineSeparatorMode = "interleaved-line",
		lineSeparator = "|",
		swapTransAndRoman = false,
	} = options;
	const source = processLyrics
		? prepareTextImport(text, sectionHeaders !== "discard")
		: text;
	const rows = source.split(/\r\n|\r|\n/);
	const result: LyricLine[] = [];
	let geniusHeader: string | undefined;
	const subKeys: ("translatedLyric" | "romanLyric")[] =
		mode === "lyric-trans-roman"
			? ["translatedLyric", "romanLyric"]
			: mode === "lyric-trans"
				? ["translatedLyric"]
				: mode === "lyric-roman"
					? ["romanLyric"]
					: [];

	for (let index = 0; index < rows.length; ) {
		const parts =
			subKeys.length && lineSeparatorMode === "same-line-separator"
				? rows[index++].split(lineSeparator)
				: [rows[index++]];
		let original = trimInvisible(parts[0]);
		if (sectionHeaders === "categorize") {
			const header = getGeniusHeader(original);
			if (header) {
				if (!isGeniusPageTitle(header)) geniusHeader = header;
				continue;
			}
		} else if (sectionHeaders === "discard" && /^\[.*\]$/.test(original)) {
			continue;
		}
		const line = newLyricLine();
		line.geniusHeader = geniusHeader;
		for (const [subIndex, key] of subKeys.entries()) {
			line[key] =
				lineSeparatorMode === "same-line-separator"
					? (parts[subIndex + 1] ?? "")
					: (rows[index++] ?? "");
		}
		if (!original && blankLines === "discard") continue;
		while (original) {
			if (backgroundPrefix && original.startsWith(backgroundPrefix)) {
				line.isBG = true;
				original = original.slice(backgroundPrefix.length);
			} else if (duetPrefix && original.startsWith(duetPrefix)) {
				line.isDuet = true;
				original = original.slice(duetPrefix.length);
			} else break;
		}
		if (collapseWhitespace) original = original.replace(/\s+/g, " ");
		line.words = splitTextImportWords(
			original,
			wordSeparator,
			splitHyphens,
		).map((text) => ({ ...newLyricWord(), word: text }));
		if (swapTransAndRoman) {
			[line.translatedLyric, line.romanLyric] = [
				line.romanLyric,
				line.translatedLyric,
			];
		}
		result.push(line);
	}
	return result;
}
