import { getGeniusHeader } from "$/modules/lyric-editor/utils/genius-sections";
import {
	isGeniusPageTitle,
	trimInvisible,
} from "$/modules/lyric-editor/utils/section-system";
import { loadedJapaneseWordFinder } from "$/modules/romanization/engines/japanese";
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

/** A source row whose background parts were joined, to show for review. */
export interface JoinedBackgroundRow {
	/** 0-based row in the source text. */
	row: number;
	source: string;
	suggestion: string;
}

/**
 * Shared preprocessing for the editable text preview and online imports.
 * Rows whose background parts were joined go to `joined`, when given.
 */
export function prepareTextImport(
	text: string,
	keepSectionHeaders: boolean,
	steps: Partial<LyricPrepOptions> = {},
	joined?: JoinedBackgroundRow[],
): string {
	// Kanji-only lines of a Japanese song split into words too.
	const japaneseWords = loadedJapaneseWordFinder(text);
	return text
		.split(/\r\n|\r|\n/)
		.flatMap((line, row) => {
			const trimmed = trimInvisible(line);
			if (/^\[.*\]$/.test(trimmed)) {
				return keepSectionHeaders && !isGeniusPageTitle(trimmed)
					? [trimmed]
					: [];
			}
			return prepareLyricLine(line, steps, japaneseWords, (suggestion) =>
				joined?.push({ row, source: trimmed, suggestion }),
			).split("\n");
		})
		.filter((line) => line.trim().length > 0)
		.join("\n");
}

/** Swaps whole rows of a text, by 0-based row. */
export function replaceTextRows(text: string, edits: Map<number, string>) {
	return text
		.split(/\r\n|\r|\n/)
		.map((row, index) => edits.get(index) ?? row)
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
