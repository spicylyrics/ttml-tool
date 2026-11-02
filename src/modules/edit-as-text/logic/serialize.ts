import type { LyricMarkupFormat } from "$/components/LyricMarkupEditor/markup";
import { getSectionHeader } from "$/modules/lyric-editor/utils/section-system";
import {
	DEFAULT_IMPORT_TEXT_FORMAT,
	type ImportTextFormat,
} from "$/modules/lyrics-import/logic/import-text";
import type { LyricLine, LyricSection, TTMLLyric } from "$/types/ttml";

/**
 * The text format for editing a project as text. It starts from the import
 * screen's settings, but always has a word separator and role prefixes (or the
 * text couldn't hold words and roles), and the translation rows come from what
 * the project has instead of the stored mode, so applying never drops them.
 */
export function editTextFormat(
	lyrics: TTMLLyric,
	preferred: ImportTextFormat = DEFAULT_IMPORT_TEXT_FORMAT,
): LyricMarkupFormat {
	const usable = (value: string, fallback: string) =>
		value.trim() ? value : fallback;
	const hasTrans = lyrics.lyricLines.some((line) => !!line.translatedLyric);
	const hasRoman = lyrics.lyricLines.some((line) => !!line.romanLyric);
	return {
		mode:
			hasTrans && hasRoman
				? "lyric-trans-roman"
				: hasTrans
					? "lyric-trans"
					: hasRoman
						? "lyric-roman"
						: "lyric",
		lineSeparatorMode: "interleaved-line",
		lineSeparator: DEFAULT_IMPORT_TEXT_FORMAT.lineSeparator,
		swapTransAndRoman: false,
		wordSeparator: usable(
			preferred.wordSeparator,
			DEFAULT_IMPORT_TEXT_FORMAT.wordSeparator,
		),
		enableSpecialPrefix: true,
		bgLyricPrefix: usable(
			preferred.bgLyricPrefix,
			DEFAULT_IMPORT_TEXT_FORMAT.bgLyricPrefix,
		),
		duetLyricPrefix: usable(
			preferred.duetLyricPrefix,
			DEFAULT_IMPORT_TEXT_FORMAT.duetLyricPrefix,
		),
		makeSections: true,
	};
}

/** Translation rows written under each lyric row, in order. */
export const subKeysOf = (
	format: LyricMarkupFormat,
): ("translatedLyric" | "romanLyric")[] =>
	format.mode === "lyric-trans-roman"
		? ["translatedLyric", "romanLyric"]
		: format.mode === "lyric-trans"
			? ["translatedLyric"]
			: format.mode === "lyric-roman"
				? ["romanLyric"]
				: [];

/**
 * The rows for one line: the lyric row with its role prefixes and every word
 * joined by the separator (spaces included, so word boundaries are exact),
 * then one row per translation kind. Translation rows are flattened to one row.
 * A line with no text is written as a lone word separator: a blank row would
 * be dropped by the importer, and the separator alone reads back as no words.
 */
export function serializeLine(
	line: LyricLine,
	format: LyricMarkupFormat,
): string[] {
	const prefix =
		(line.isBG ? format.bgLyricPrefix : "") +
		(line.isDuet ? format.duetLyricPrefix : "");
	const words = line.words.map((word) => word.word).join(format.wordSeparator);
	const body = words.trim() ? words : format.wordSeparator;
	return [
		prefix + body,
		...subKeysOf(format).map((key) =>
			(line[key] ?? "").replace(/\r\n|\r|\n/g, " "),
		),
	];
}

/** A section's header row. Labels edited without brackets get them back. */
export function sectionHeaderText(section: LyricSection): string {
	const header = getSectionHeader(section.label);
	if (header) return header;
	const inner = section.label.replace(/[[\]\r\n]+/g, " ").trim();
	return `[${inner || section.category}]`;
}

/** The project as import markup: section headers, then each line's rows. */
export function serializeLyrics(
	lyrics: TTMLLyric,
	format: LyricMarkupFormat,
): string {
	const sections = new Map<string, LyricSection>(
		(lyrics.sections ?? []).map((section) => [section.id, section]),
	);
	// Blank rows would be read as translation rows in the other modes.
	const padSections = subKeysOf(format).length === 0;
	const rows: string[] = [];
	let previousSection: string | undefined;
	for (const line of lyrics.lyricLines) {
		const section = line.sectionId ? sections.get(line.sectionId) : undefined;
		if (section && section.id !== previousSection) {
			if (padSections && rows.length) rows.push("");
			rows.push(sectionHeaderText(section));
		}
		previousSection = section?.id;
		rows.push(...serializeLine(line, format));
	}
	return rows.join("\n");
}
