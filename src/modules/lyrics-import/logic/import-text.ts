import {
	createSectionFromHeader,
	getSectionHeader,
} from "$/modules/lyric-editor/utils/section-system";
import { textToLines } from "$/modules/project/logic/text-to-lines";
import type { LyricLine, LyricSection } from "$/types/ttml";

export type ImportContentMode =
	| "lyric"
	| "lyric-trans"
	| "lyric-roman"
	| "lyric-trans-roman";

export type ImportLineSeparatorMode =
	| "interleaved-line"
	| "same-line-separator";

/** How the import text area is read. Every source goes through this. */
export interface ImportTextFormat {
	mode: ImportContentMode;
	lineSeparatorMode: ImportLineSeparatorMode;
	lineSeparator: string;
	swapTransAndRoman: boolean;
	wordSeparator: string;
	enableSpecialPrefix: boolean;
	bgLyricPrefix: string;
	duetLyricPrefix: string;
}

export const DEFAULT_IMPORT_TEXT_FORMAT: ImportTextFormat = {
	mode: "lyric",
	lineSeparatorMode: "interleaved-line",
	lineSeparator: "|",
	swapTransAndRoman: false,
	wordSeparator: "\\",
	enableSpecialPrefix: true,
	bgLyricPrefix: "<",
	duetLyricPrefix: ">",
};

/**
 * Parse the import text into untimed lines. Blank rows are dropped, and
 * `[Header]` rows become sections or are dropped. `splitHyphens: false` keeps
 * hyphenated words whole, so only the word separator splits.
 */
export function importTextToLines(
	text: string,
	format: ImportTextFormat,
	makeSections: boolean,
	options: { splitHyphens?: boolean } = {},
): LyricLine[] {
	return textToLines(text, {
		splitHyphens: options.splitHyphens ?? true,
		mode: format.mode,
		lineSeparatorMode: format.lineSeparatorMode,
		lineSeparator: format.lineSeparator,
		swapTransAndRoman: format.swapTransAndRoman,
		wordSeparator: format.wordSeparator,
		sectionHeaders: makeSections ? "categorize" : "discard",
		blankLines: "discard",
		backgroundPrefix: format.enableSpecialPrefix ? format.bgLyricPrefix : "",
		duetPrefix: format.enableSpecialPrefix ? format.duetLyricPrefix : "",
	});
}

export interface ReviewedSection extends LyricSection {
	occurrence: number;
	lineCount: number;
	/** First lyric row under the header, to recognise the section by. */
	firstLine?: string;
}

export const hasSectionHeaders = (text: string) =>
	text.split(/\r\n|\r|\n/).some((line) => !!getSectionHeader(line));

/** The sections the import would create, in order, for the review step. */
export function detectSections(text: string): ReviewedSection[] {
	const result: ReviewedSection[] = [];
	let current: ReviewedSection | undefined;
	let occurrence = 0;
	for (const rawLine of text.split(/\r\n|\r|\n/)) {
		const header = getSectionHeader(rawLine);
		if (header) {
			const section = createSectionFromHeader(header);
			if (section) {
				current = { ...section, occurrence: occurrence++, lineCount: 0 };
				result.push(current);
			}
		} else if (rawLine.trim() && current) {
			current.lineCount++;
			current.firstLine ??= rawLine.trim();
		}
	}
	return result;
}

/**
 * Keep the user's edits to sections that still exist after the text changed,
 * matching by position first and then by label.
 */
export function mergeReviewedSections(
	previous: ReviewedSection[],
	detected: ReviewedSection[],
): ReviewedSection[] {
	return detected.map((next) => {
		const match =
			previous.find(
				(section) =>
					section.occurrence === next.occurrence &&
					section.label === next.label,
			) ?? previous.find((section) => section.label === next.label);
		return match
			? {
					...next,
					category: match.category,
					ordinal: match.ordinal,
					confidence: match.confidence,
				}
			: next;
	});
}

/** Drop review-only fields so they don't end up stored on the sections. */
export const toSectionOverrides = (reviewed: ReviewedSection[]) =>
	reviewed.map(({ firstLine: _firstLine, ...section }) => section);

/**
 * Insert syllable split marks into the import text, leaving headers, blank
 * rows, prefixes, translation rows and spacing as they are. Each run of
 * non-space text between word separators goes through `splitWord`; spaces
 * become their own words, the same as Process lyrics writes them.
 */
export function segmentImportText(
	text: string,
	format: ImportTextFormat,
	splitWord: (word: string) => string[],
): string {
	const separator = format.wordSeparator;
	if (!separator) return text;
	const subRowCount =
		format.lineSeparatorMode === "same-line-separator"
			? 0
			: format.mode === "lyric-trans-roman"
				? 2
				: format.mode === "lyric"
					? 0
					: 1;
	const sameLine =
		format.mode !== "lyric" &&
		format.lineSeparatorMode === "same-line-separator" &&
		!!format.lineSeparator;
	const prefixes = format.enableSpecialPrefix
		? [format.bgLyricPrefix, format.duetLyricPrefix].filter(Boolean)
		: [];

	const splitChunk = (chunk: string) => {
		const parts = splitWord(chunk).filter((part) => part.length > 0);
		// Never let a split change the text itself.
		return parts.join("") === chunk ? parts : [chunk];
	};
	// A word already marked inside (other than right after a hyphen) was split
	// by hand or by an earlier run, so it's left alone. That keeps this idempotent.
	const splitWordTokens = (tokens: string[]) =>
		tokens.some(
			(token, index) => index < tokens.length - 1 && !token.endsWith("-"),
		)
			? tokens
			: tokens.flatMap(splitChunk);
	const splitBody = (body: string) => {
		const tokens = body
			.split(separator)
			.flatMap((piece) => piece.split(/(\s+)/))
			.filter((token) => token.length > 0);
		const output: string[] = [];
		let word: string[] = [];
		for (const token of tokens) {
			if (/^\s+$/.test(token)) {
				output.push(...splitWordTokens(word), token);
				word = [];
			} else word.push(token);
		}
		output.push(...splitWordTokens(word));
		return output.join(separator);
	};

	const rows = text.split(/\r\n|\r|\n/);
	const output: string[] = [];
	for (let index = 0; index < rows.length; ) {
		const row = rows[index++];
		if (getSectionHeader(row)) {
			output.push(row);
			continue;
		}
		const subRows = rows.slice(index, index + subRowCount);
		index += subRowCount;
		if (!row.trim()) {
			output.push(row, ...subRows);
			continue;
		}
		const cut = sameLine ? row.indexOf(format.lineSeparator) : -1;
		const main = cut >= 0 ? row.slice(0, cut) : row;
		const rest = cut >= 0 ? row.slice(cut) : "";
		const lead = main.match(/^\s*/)?.[0] ?? "";
		let body = main.slice(lead.length);
		let prefix = "";
		for (let found = true; found; ) {
			found = false;
			for (const marker of prefixes) {
				if (body.startsWith(marker)) {
					prefix += marker;
					body = body.slice(marker.length);
					found = true;
				}
			}
		}
		const trail = body.match(/\s*$/)?.[0] ?? "";
		body = body.slice(0, body.length - trail.length);
		output.push(lead + prefix + splitBody(body) + trail + rest, ...subRows);
	}
	return output.join("\n");
}
