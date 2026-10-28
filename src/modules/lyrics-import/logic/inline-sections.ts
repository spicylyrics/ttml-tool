import { headerWithCategory } from "$/components/LyricMarkupEditor/markup";
import {
	getSectionHeader,
	normalizeSectionHeader,
} from "$/modules/lyric-editor/utils/section-system";
import type { LyricSectionCategory } from "$/types/ttml";

/** A section header found in the import text, with where it sits. */
export interface InlineSection {
	/** Zero-based row of the header in the text. */
	lineIndex: number;
	/** Header text without the brackets, as typed. */
	text: string;
	category: LyricSectionCategory;
	confidence: number;
	/** Non-blank rows up to the next header. */
	lineCount: number;
	/** First lyric row under the header, to recognise the section by. */
	firstLine?: string;
}

const splitRows = (text: string) => text.split(/\r\n|\r|\n/);

/**
 * The sections the import would create, read straight from the text. Uses
 * the same header rules as the import, so the list and the result agree.
 */
export function listInlineSections(text: string): InlineSection[] {
	const result: InlineSection[] = [];
	let current: InlineSection | undefined;
	splitRows(text).forEach((row, lineIndex) => {
		const header = getSectionHeader(row);
		const normalized = header ? normalizeSectionHeader(header) : undefined;
		if (header && normalized) {
			current = {
				lineIndex,
				text: header.slice(1, -1),
				category: normalized.category,
				confidence: normalized.confidence,
				lineCount: 0,
			};
			result.push(current);
		} else if (row.trim() && current) {
			current.lineCount++;
			current.firstLine ??= row.trim();
		}
	});
	return result;
}

/** Replace the header on `lineIndex`, keeping its indent. No-op if it isn't one. */
function replaceHeaderRow(
	text: string,
	lineIndex: number,
	edit: (header: string) => string | undefined,
): string {
	const rows = splitRows(text);
	const row = rows[lineIndex];
	const header = row === undefined ? undefined : getSectionHeader(row);
	if (!header) return text;
	const next = edit(header);
	if (next === undefined || next === header) return text;
	rows[lineIndex] = (row.match(/^\s*/)?.[0] ?? "") + next;
	return rows.join("\n");
}

/**
 * Rename a header. Brackets and line breaks can't be part of a header, so
 * they're dropped; an empty name leaves the header as it was.
 */
export function renameInlineSection(
	text: string,
	lineIndex: number,
	name: string,
): string {
	const clean = name.replace(/[[\]\r\n]/g, "").trim();
	if (!clean) return text;
	return replaceHeaderRow(text, lineIndex, () => `[${clean}]`);
}

/** Change a header's category, keeping its number and vocalist. */
export function retypeInlineSection(
	text: string,
	lineIndex: number,
	category: LyricSectionCategory,
): string {
	return replaceHeaderRow(text, lineIndex, (header) =>
		headerWithCategory(header, category),
	);
}

/**
 * Merge a section into the one before it by removing its header row. The
 * first section has nothing before it, so it stays.
 */
export function mergeInlineSectionUp(text: string, lineIndex: number): string {
	const sections = listInlineSections(text);
	const index = sections.findIndex(
		(section) => section.lineIndex === lineIndex,
	);
	if (index <= 0) return text;
	const rows = splitRows(text);
	rows.splice(lineIndex, 1);
	return rows.join("\n");
}
