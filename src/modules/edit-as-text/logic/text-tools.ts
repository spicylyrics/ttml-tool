import type { LyricMarkupFormat } from "$/components/LyricMarkupEditor";
import { getSectionHeader } from "$/modules/lyric-editor/utils/section-system";
import { segmentImportText } from "$/modules/lyrics-import/logic/import-text";
import { type LyricPrepOptions, prepareLyricLine } from "$/utils/lyric-prep";
import { subKeysOf } from "./serialize";

/** Rows the tools may change, 0-based and inclusive. Null means every row. */
export type RowRange = { from: number; to: number } | null;

const splitRows = (text: string) => text.split(/\r\n|\r|\n/);

/**
 * The lyric rows a tool should touch. A lyric line counts as picked when any
 * of its rows is, including only its translation.
 */
function pickedLyricRows(
	rows: string[],
	subRowCount: number,
	range: RowRange,
): Set<number> {
	const picked = new Set<number>();
	for (let index = 0; index < rows.length; ) {
		const start = index++;
		if (getSectionHeader(rows[start])) continue;
		index += subRowCount;
		const end = index - 1;
		if (!range || (start <= range.to && end >= range.from)) picked.add(start);
	}
	return picked;
}

/** Process lyrics writes these, whatever the dialog's own markup is. */
const PREP_SEPARATOR = "\\";
const PREP_BACKGROUND = "<";
/** Start of the private-use characters that stand in for already split words. */
const KEPT_WORD = 0xe000;

const trimStart = (value: string, mark: string) => {
	let rest = value;
	while (mark && rest.startsWith(mark)) rest = rest.slice(mark.length);
	return rest;
};
const trimEnd = (value: string, mark: string) => {
	let rest = value;
	while (mark && rest.endsWith(mark)) rest = rest.slice(0, -mark.length);
	return rest;
};

/**
 * Runs Process lyrics over the picked lyric rows, leaving section headers,
 * translation rows and empty lines alone. A line only grows a background row
 * when there are no translation rows to keep in step.
 */
export function processTextRows(
	text: string,
	format: LyricMarkupFormat,
	steps: LyricPrepOptions,
	range: RowRange,
): string {
	const separator = format.wordSeparator;
	const subRowCount = subKeysOf(format).length;
	const rows = splitRows(text);
	const picked = pickedLyricRows(rows, subRowCount, range);
	const output: string[] = [];
	rows.forEach((row, index) => {
		if (!picked.has(index)) {
			output.push(row);
			return;
		}
		const lead = row.match(/^\s*/)?.[0] ?? "";
		let body = row.slice(lead.length);
		let isBackground = false;
		let isDuet = false;
		for (let found = true; found; ) {
			found = false;
			if (format.bgLyricPrefix && body.startsWith(format.bgLyricPrefix)) {
				isBackground = true;
				body = body.slice(format.bgLyricPrefix.length);
				found = true;
			}
			if (format.duetLyricPrefix && body.startsWith(format.duetLyricPrefix)) {
				isDuet = true;
				body = body.slice(format.duetLyricPrefix.length);
				found = true;
			}
		}
		// An empty line is written as the separator alone.
		if (!body.trim() || body.trim() === separator) {
			output.push(row);
			return;
		}
		// A word with marks inside was split by hand or by an earlier run, so it
		// stands in as one placeholder character that no step rewrites.
		const kept: string[] = [];
		const masked = body
			.split(/(\s+)/)
			.map((chunk) => {
				const edge = chunk.length - trimStart(chunk, separator).length;
				const core = trimEnd(trimStart(chunk, separator), separator);
				if (!core.includes(separator)) return chunk;
				kept.push(core);
				return (
					chunk.slice(0, edge) +
					String.fromCharCode(KEPT_WORD + kept.length - 1) +
					chunk.slice(edge + core.length)
				);
			})
			.join("");
		const prepared = prepareLyricLine(
			masked.split(separator).join(PREP_SEPARATOR),
			{
				...steps,
				backgroundVocals:
					steps.backgroundVocals && subRowCount === 0 && !isBackground,
			},
		)
			.split("\n")
			.filter((line) => line.length > 0);
		const duet = isDuet ? format.duetLyricPrefix : "";
		const toMarkup = (value: string) =>
			Array.from(value.split(PREP_SEPARATOR).join(separator), (char) => {
				const code = char.charCodeAt(0) - KEPT_WORD;
				return code >= 0 && code < kept.length ? kept[code] : char;
			}).join("");
		const lines = prepared.map((line) =>
			line.startsWith(PREP_BACKGROUND)
				? lead +
					format.bgLyricPrefix +
					duet +
					toMarkup(line.slice(PREP_BACKGROUND.length))
				: lead +
					(isBackground ? format.bgLyricPrefix : "") +
					duet +
					toMarkup(line),
		);
		output.push(...(lines.length ? lines : [row]));
	});
	return output.join("\n");
}

/**
 * Marks syllables on the picked lyric rows with the user's segmentation, the
 * same way the import screen's Split syllables does.
 */
export function splitTextRows(
	text: string,
	format: LyricMarkupFormat,
	splitWord: (word: string) => string[],
	range: RowRange,
): string {
	const split = segmentImportText(text, format, splitWord);
	if (!range) return split;
	const before = splitRows(text);
	const after = splitRows(split);
	// Splitting only adds marks inside rows, so rows line up one to one.
	if (before.length !== after.length) return text;
	const picked = pickedLyricRows(before, subKeysOf(format).length, range);
	return before
		.map((row, index) => (picked.has(index) ? after[index] : row))
		.join("\n");
}
