import { getSectionHeader } from "$/modules/lyric-editor/utils/section-system.ts";
import type { LyricLine, LyricSection } from "$/types/ttml.ts";

/** A stanza: an optional `[Header]` row and the lyric rows under it. */
export interface TranscriptBlock {
	header?: string;
	lines: string[];
}

/**
 * Splits a transcript into stanzas. A `[Header]` row or a blank row starts a
 * new stanza; blank rows between a header and its lyrics are ignored.
 * Rows are trimmed and empty stanzas are dropped.
 */
export function parseTranscript(text: string): TranscriptBlock[] {
	const blocks: TranscriptBlock[] = [];
	let current: TranscriptBlock = { lines: [] };
	const flush = () => {
		if (current.header || current.lines.length > 0) blocks.push(current);
		current = { lines: [] };
	};
	for (const raw of text.split(/\r\n?|\n/)) {
		const line = raw.trim();
		if (!line) {
			// A blank row under a header still belongs to that header's stanza.
			if (current.lines.length > 0) flush();
			continue;
		}
		const header = getSectionHeader(line);
		if (header) {
			flush();
			current.header = header;
			continue;
		}
		current.lines.push(line);
	}
	flush();
	return blocks;
}

const joinBlocks = (rows: string[][]) =>
	rows
		.filter((block) => block.length > 0)
		.map((block) => block.join("\n"))
		.join("\n\n");

/**
 * Genius layout: each `[Header]` on its own row directly above its lyrics,
 * one blank row between stanzas and none inside one, rows trimmed.
 * Words, case and punctuation are left as typed.
 */
export function toGeniusText(text: string): string {
	return joinBlocks(
		parseTranscript(text).map((block) =>
			block.header ? [block.header, ...block.lines] : block.lines,
		),
	);
}

/** The same layout as {@link toGeniusText}, without the section headers. */
export function toPlainText(text: string): string {
	return joinBlocks(parseTranscript(text).map((block) => block.lines));
}

const lineText = (line: LyricLine) =>
	line.words
		.map((word) => word.word)
		.join("")
		.replace(/\s+/g, " ")
		.trim();

/**
 * Turns editor lines back into a transcript: a header row where a section
 * starts, and background lines in parentheses after the line they back, the
 * way Genius writes ad-libs. Pass the result to {@link toGeniusText} or
 * {@link toPlainText}.
 */
export function linesToTranscript(
	lines: readonly LyricLine[],
	sections: readonly LyricSection[] = [],
): string {
	const labels = new Map(sections.map((section) => [section.id, section]));
	const rows: string[] = [];
	let sectionId: string | undefined;
	for (const line of lines) {
		const text = lineText(line);
		if (line.sectionId !== sectionId) {
			sectionId = line.sectionId;
			const label = sectionId ? labels.get(sectionId)?.label : undefined;
			const header = label ? getSectionHeader(label) : undefined;
			if (rows.length > 0) rows.push("");
			if (header) rows.push(header);
		}
		if (!text) continue;
		const last = rows.length - 1;
		if (line.isBG && last >= 0 && rows[last] && !getSectionHeader(rows[last])) {
			const wrapped = /^\(.*\)$/.test(text) ? text : `(${text})`;
			rows[last] = `${rows[last]} ${wrapped}`;
			continue;
		}
		rows.push(text);
	}
	return rows.join("\n");
}

/** Line and word counts for a status row. Headers and blank rows don't count. */
export function transcriptStats(text: string): {
	lines: number;
	words: number;
} {
	let lines = 0;
	let words = 0;
	for (const block of parseTranscript(text)) {
		lines += block.lines.length;
		for (const line of block.lines) words += line.split(/\s+/).length;
	}
	return { lines, words };
}
