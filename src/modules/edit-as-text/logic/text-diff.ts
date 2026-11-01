import type { LyricMarkupFormat } from "$/components/LyricMarkupEditor/markup";
import {
	createSectionFromHeader,
	getSectionHeader,
	repairSectionIntegrity,
} from "$/modules/lyric-editor/utils/section-system";
import { hasNoTiming } from "$/modules/lyric-editor/utils/timing-status";
import { importTextToLines } from "$/modules/lyrics-import/logic/import-text";
import {
	type LyricLine,
	type LyricSection,
	type LyricWord,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import { sectionHeaderText, serializeLine, subKeysOf } from "./serialize";

/**
 * Applying edited lyric text to a project, keeping what didn't change.
 *
 * Lines are matched in three passes: an in-order match of identical lines
 * (unchanged), then identical lines anywhere (moved), then similar lines in the
 * same stretch of changes (edited). "Similar" is the Dice coefficient of the
 * two lines' character bigrams after lowercasing and dropping punctuation, at
 * least `EDITED_LINE_SIMILARITY` (0.5); this holds even when exactly one line
 * was removed and one added, so an unrelated replacement is a delete plus an
 * add. Inside an edited line, words are matched in order by their text, or by
 * position when only some words' text changed (see `mergeWords`); matched
 * words keep their id and timing, new words come in untimed. Section headers
 * are matched the same way, so sections keep their id, category and notes.
 */

/** A row of the text as the importer reads it: a header or a lyric line. */
export type TextToken =
	| { type: "header"; text: string }
	| { type: "line"; line: LyricLine };

/** Parse edited text with the importer, keeping where each header sits. */
export function parseEditedText(
	text: string,
	format: LyricMarkupFormat,
): TextToken[] {
	const tokens: TextToken[] = [];
	let chunk: string[] = [];
	const flush = () => {
		if (!chunk.length) return;
		for (const line of importTextToLines(chunk.join("\n"), format, true, {
			splitHyphens: false,
		}))
			tokens.push({ type: "line", line });
		chunk = [];
	};
	for (const row of text.split(/\r\n|\r|\n/)) {
		const header = getSectionHeader(row);
		if (header) {
			flush();
			tokens.push({ type: "header", text: header });
		} else chunk.push(row);
	}
	flush();
	return tokens;
}

type Side = {
	key: string | null;
	/** Index into the old or new line list; -1 for headers. */
	line: number;
	header?: string;
};

const lineKey = (line: LyricLine, format: LyricMarkupFormat) =>
	JSON.stringify([
		line.isBG,
		line.isDuet,
		line.words.map((word) => word.word),
		...subKeysOf(format).map((key) => line[key] ?? ""),
	]);

// The preview diffs on every edit; project lines don't change meanwhile.
const canonicalCache = new WeakMap<
	LyricLine,
	{ format: LyricMarkupFormat; line: LyricLine | undefined }
>();

/** What a project line reads as after a trip through the text. */
function canonicalLine(line: LyricLine, format: LyricMarkupFormat) {
	const cached = canonicalCache.get(line);
	if (cached?.format === format) return cached.line;
	const canonical = importTextToLines(
		serializeLine(line, format).join("\n"),
		format,
		true,
		{ splitHyphens: false },
	)[0];
	canonicalCache.set(line, { format, line: canonical });
	return canonical;
}

type Op =
	| { type: "equal"; a: number; b: number }
	| { type: "delete"; a: number }
	| { type: "insert"; b: number };

/** Longest common subsequence alignment of two key lists. */
export function alignByKey<T>(
	a: readonly T[],
	b: readonly T[],
	equal: (x: T, y: T) => boolean,
): Op[] {
	let start = 0;
	while (start < a.length && start < b.length && equal(a[start], b[start]))
		start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && equal(a[endA - 1], b[endB - 1])) {
		endA--;
		endB--;
	}
	const rows = endA - start;
	const cols = endB - start;
	const width = cols + 1;
	const table = new Int32Array((rows + 1) * width);
	for (let i = rows - 1; i >= 0; i--) {
		for (let j = cols - 1; j >= 0; j--) {
			table[i * width + j] = equal(a[start + i], b[start + j])
				? table[(i + 1) * width + j + 1] + 1
				: Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
		}
	}
	const ops: Op[] = [];
	for (let index = 0; index < start; index++)
		ops.push({ type: "equal", a: index, b: index });
	let i = 0;
	let j = 0;
	while (i < rows && j < cols) {
		if (equal(a[start + i], b[start + j])) {
			ops.push({ type: "equal", a: start + i, b: start + j });
			i++;
			j++;
		} else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
			ops.push({ type: "delete", a: start + i++ });
		} else ops.push({ type: "insert", b: start + j++ });
	}
	while (i < rows) ops.push({ type: "delete", a: start + i++ });
	while (j < cols) ops.push({ type: "insert", b: start + j++ });
	for (let index = 0; index < a.length - endA; index++)
		ops.push({ type: "equal", a: endA + index, b: endB + index });
	return ops;
}

const normalizeText = (value: string) =>
	value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

const bigrams = (value: string) => {
	const result = new Map<string, number>();
	for (let index = 0; index < value.length - 1; index++) {
		const pair = value.slice(index, index + 2);
		result.set(pair, (result.get(pair) ?? 0) + 1);
	}
	return result;
};

/** Dice similarity of two lines' text, 0 to 1. */
export function lineSimilarity(left: string, right: string): number {
	const a = normalizeText(left);
	const b = normalizeText(right);
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;
	const pairsA = bigrams(a);
	const pairsB = bigrams(b);
	let overlap = 0;
	let total = 0;
	for (const [pair, count] of pairsA) {
		overlap += Math.min(count, pairsB.get(pair) ?? 0);
		total += count;
	}
	for (const count of pairsB.values()) total += count;
	return (2 * overlap) / total;
}

/** Lines at least this similar count as the same line, edited. */
export const EDITED_LINE_SIMILARITY = 0.5;

export interface WordMerge {
	words: LyricWord[];
	/** Old words with timing that have no match in the new text. */
	droppedTimed: number;
	/** New words that got an old word's timing. */
	keptTimed: number;
}

/**
 * The new words of a line, reusing old words (id, timing, romanization) where
 * the text matches in order. Spacing around a word doesn't count as a change.
 *
 * When the word count is the same and matching by position keeps at least as
 * many words as matching by text, words are paired by position instead, so a
 * typo fix ("teh" to "the") keeps that word's timing. A changed word loses its
 * romanization, which belonged to the old text. A shift (a word removed and
 * another added elsewhere) keeps more by text, so it stays text-matched.
 */
export function mergeWords(
	oldWords: LyricWord[],
	newTexts: string[],
): WordMerge {
	const oldKeys = oldWords.map((word) => word.word.trim());
	const newKeys = newTexts.map((text) => text.trim());
	const ops = alignByKey(oldKeys, newKeys, (x, y) => x === y);
	if (oldWords.length === newTexts.length && oldWords.length > 0) {
		const byText = ops.filter((op) => op.type === "equal").length;
		const byPosition = oldKeys.filter(
			(key, index) => key === newKeys[index],
		).length;
		if (byPosition >= byText)
			return {
				words: oldWords.map((old, index) => {
					const text = newTexts[index];
					if (old.word === text) return old;
					if (oldKeys[index] === newKeys[index]) return { ...old, word: text };
					const { romanWarning: _stale, ...kept } = old;
					return { ...kept, word: text, romanWord: "" };
				}),
				droppedTimed: 0,
				keptTimed: oldWords.filter((word) => !hasNoTiming(word)).length,
			};
	}
	const words: LyricWord[] = [];
	const used = new Set<number>();
	let keptTimed = 0;
	for (const op of ops) {
		if (op.type === "delete") continue;
		const text = newTexts[op.b];
		if (op.type === "equal") {
			const old = oldWords[op.a];
			used.add(op.a);
			if (!hasNoTiming(old)) keptTimed++;
			words.push(old.word === text ? old : { ...old, word: text });
		} else words.push({ ...newLyricWord(), word: text });
	}
	const droppedTimed = oldWords.filter(
		(word, index) => !used.has(index) && !hasNoTiming(word),
	).length;
	return { words, droppedTimed, keptTimed };
}

export interface EditedLineReport {
	/** Position of the line in the new lyrics, from 0. */
	index: number;
	text: string;
	/** Timed words in the old line that lose their timing. */
	droppedTimed: number;
}

export interface TextEditSummary {
	unchanged: number;
	moved: number;
	edited: number;
	added: number;
	removed: number;
	/** Timed words that lose their timing, in edited and removed lines. */
	droppedTimedWords: number;
	/** Edited lines that lose timings, for showing before applying. */
	lossyLines: EditedLineReport[];
	/** Anything at all changes, sections included. */
	hasChanges: boolean;
}

export interface TextEditResult {
	lyricLines: LyricLine[];
	sections: LyricSection[];
	summary: TextEditSummary;
}

type Match = { kind: "unchanged" | "moved" | "edited"; old: number };

/** Apply edited text to the project's lines and sections. Pure. */
export function applyEditedText(
	lyrics: TTMLLyric,
	text: string,
	format: LyricMarkupFormat,
): TextEditResult {
	const oldLines = lyrics.lyricLines;
	const sectionsById = new Map(
		(lyrics.sections ?? []).map((section) => [section.id, section]),
	);

	// The old project as a stream of headers and lines, like the text.
	const oldSides: Side[] = [];
	const oldHeaderSection: LyricSection[] = [];
	/** For each old line, the index in `oldSides` of the header above it. */
	const oldHeaderAbove: number[] = [];
	const oldCanonical: (LyricLine | undefined)[] = [];
	let previousSection: string | undefined;
	let lastHeader = -1;
	for (const [index, line] of oldLines.entries()) {
		const section = line.sectionId
			? sectionsById.get(line.sectionId)
			: undefined;
		if (section && section.id !== previousSection) {
			lastHeader = oldSides.length;
			oldHeaderSection[lastHeader] = section;
			const header = sectionHeaderText(section);
			oldSides.push({ key: `h:${header}`, line: -1, header });
		}
		previousSection = section?.id;
		oldHeaderAbove[index] = lastHeader;
		const canonical = canonicalLine(line, format);
		oldCanonical[index] = canonical;
		oldSides.push({
			key: canonical ? `l:${lineKey(canonical, format)}` : null,
			line: index,
		});
	}

	const tokens = parseEditedText(text, format);
	const newLines: LyricLine[] = [];
	const newSides: Side[] = tokens.map((token) => {
		if (token.type === "header")
			return { key: `h:${token.text}`, line: -1, header: token.text };
		newLines.push(token.line);
		return {
			key: `l:${lineKey(token.line, format)}`,
			line: newLines.length - 1,
		};
	});

	const ops = alignByKey(
		oldSides,
		newSides,
		(x, y) => x.key !== null && x.key === y.key,
	);

	// Pass 1: in-order identical rows. Collect the stretches between them.
	const lineMatch = new Map<number, Match>(); // new line -> old line
	const headerMatch = new Map<number, number>(); // new side -> old side
	const oldUsed = new Set<number>();
	const hunks: { removed: number[]; added: number[] }[] = [];
	let hunk: { removed: number[]; added: number[] } | null = null;
	for (const op of ops) {
		if (op.type === "equal") {
			hunk = null;
			const oldSide = oldSides[op.a];
			if (oldSide.line === -1) headerMatch.set(op.b, op.a);
			else {
				lineMatch.set(newSides[op.b].line, {
					kind: "unchanged",
					old: oldSide.line,
				});
				oldUsed.add(oldSide.line);
			}
			continue;
		}
		if (!hunk) {
			hunk = { removed: [], added: [] };
			hunks.push(hunk);
		}
		if (op.type === "delete") hunk.removed.push(op.a);
		else hunk.added.push(op.b);
	}

	// Pass 2: identical lines that moved.
	const unusedByKey = new Map<string, number[]>();
	for (const current of hunks)
		for (const a of current.removed) {
			const side = oldSides[a];
			if (side.line === -1 || side.key === null) continue;
			const list = unusedByKey.get(side.key) ?? [];
			list.push(side.line);
			unusedByKey.set(side.key, list);
		}
	for (const current of hunks)
		for (const b of current.added) {
			const side = newSides[b];
			if (side.line === -1 || side.key === null) continue;
			const old = unusedByKey.get(side.key)?.shift();
			if (old === undefined) continue;
			lineMatch.set(side.line, { kind: "moved", old });
			oldUsed.add(old);
		}

	// Pass 3: similar lines and renamed headers inside the same stretch.
	const oldText = (index: number) =>
		(oldCanonical[index]?.words ?? oldLines[index].words)
			.map((word) => word.word)
			.join("");
	const newText = (index: number) =>
		newLines[index].words.map((word) => word.word).join("");
	for (const current of hunks) {
		const removedLines = current.removed
			.map((a) => oldSides[a].line)
			.filter((line) => line !== -1 && !oldUsed.has(line));
		const addedLines = current.added
			.map((b) => newSides[b].line)
			.filter((line) => line !== -1 && !lineMatch.has(line));
		// Even a single line rewritten in place must pass the similarity bar, so
		// replacing a line with unrelated text is a delete plus an add.
		let from = 0;
		for (const old of removedLines) {
			let best = -1;
			let bestScore = EDITED_LINE_SIMILARITY;
			for (let index = from; index < addedLines.length; index++) {
				const score = lineSimilarity(oldText(old), newText(addedLines[index]));
				if (score >= bestScore) {
					if (score > bestScore || best === -1) best = index;
					bestScore = score;
					if (score === 1) break;
				}
			}
			if (best === -1) continue;
			lineMatch.set(addedLines[best], { kind: "edited", old });
			oldUsed.add(old);
			from = best + 1;
		}
		const removedHeaders = current.removed.filter(
			(a) => oldSides[a].line === -1,
		);
		const addedHeaders = current.added.filter((b) => newSides[b].line === -1);
		for (
			let index = 0;
			index < Math.min(removedHeaders.length, addedHeaders.length);
			index++
		)
			headerMatch.set(addedHeaders[index], removedHeaders[index]);
	}

	// Build the new lines in text order.
	const summary: TextEditSummary = {
		unchanged: 0,
		moved: 0,
		edited: 0,
		added: 0,
		removed: 0,
		droppedTimedWords: 0,
		lossyLines: [],
		hasChanges: false,
	};
	const resultLines: LyricLine[] = [];
	const resultSections: LyricSection[] = [];
	let header: { oldSide: number; section: LyricSection } | null = null;
	let previousUnderHeader: LyricLine | null = null;
	for (const [b, side] of newSides.entries()) {
		if (side.line === -1) {
			const oldSide = headerMatch.get(b);
			const text = side.header as string;
			let section: LyricSection | undefined;
			if (oldSide !== undefined) {
				const old = oldHeaderSection[oldSide];
				section = { ...old };
				if (sectionHeaderText(old) !== text) {
					const fresh = createSectionFromHeader(text);
					if (fresh)
						Object.assign(section, {
							label: fresh.label,
							category: fresh.category,
							ordinal: fresh.ordinal,
							vocalist: fresh.vocalist,
							confidence: fresh.confidence,
						});
				}
			} else section = createSectionFromHeader(text);
			if (section) {
				resultSections.push(section);
				header = { oldSide: oldSide ?? -2, section };
			}
			previousUnderHeader = null;
			continue;
		}
		const parsed = newLines[side.line];
		const match = lineMatch.get(side.line);
		let line: LyricLine;
		let sectionId: string | undefined;
		if (!match) {
			summary.added++;
			line = parsed;
			sectionId = previousUnderHeader
				? previousUnderHeader.sectionId
				: header?.section.id;
		} else {
			const old = oldLines[match.old];
			if (match.kind === "edited") {
				const merged = mergeWords(
					old.words,
					parsed.words.map((word) => word.word),
				);
				line = {
					...old,
					isBG: parsed.isBG,
					isDuet: parsed.isDuet,
					words: merged.words,
				};
				for (const key of subKeysOf(format)) line[key] = parsed[key];
				summary.edited++;
				summary.droppedTimedWords += merged.droppedTimed;
				if (merged.droppedTimed)
					summary.lossyLines.push({
						index: resultLines.length,
						text: newText(side.line),
						droppedTimed: merged.droppedTimed,
					});
			} else {
				line = { ...old };
				summary[match.kind]++;
			}
			const sameHeader = (header?.oldSide ?? -1) === oldHeaderAbove[match.old];
			sectionId = sameHeader
				? old.sectionId
				: previousUnderHeader
					? previousUnderHeader.sectionId
					: header?.section.id;
		}
		if (sectionId) line.sectionId = sectionId;
		else {
			delete line.sectionId;
			delete line.geniusHeader;
		}
		resultLines.push(line);
		previousUnderHeader = line;
	}

	for (const [index, line] of oldLines.entries()) {
		if (oldUsed.has(index)) continue;
		summary.removed++;
		summary.droppedTimedWords += line.words.filter(
			(word) => !hasNoTiming(word),
		).length;
	}

	const repaired = repairSectionIntegrity({
		metadata: [],
		lyricLines: resultLines,
		sections: resultSections,
	});

	const sectionSignature = (lines: LyricLine[], sections: LyricSection[]) => {
		const byId = new Map(sections.map((section) => [section.id, section]));
		return JSON.stringify(
			lines.map((line) => {
				const section = line.sectionId ? byId.get(line.sectionId) : undefined;
				return section ? [section.id, section.label, section.category] : null;
			}),
		);
	};
	summary.hasChanges =
		summary.moved + summary.edited + summary.added + summary.removed > 0 ||
		resultLines.length !== oldLines.length ||
		sectionSignature(repaired.lyricLines, repaired.sections ?? []) !==
			sectionSignature(oldLines, lyrics.sections ?? []);

	return {
		lyricLines: repaired.lyricLines,
		sections: repaired.sections ?? [],
		summary,
	};
}
