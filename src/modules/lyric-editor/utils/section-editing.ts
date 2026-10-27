import { uid } from "uid";
import { copyLinesAtTime } from "$/modules/spectrogram/utils/duplicate-paste.ts";
import type {
	LyricLine,
	LyricSection,
	LyricSectionCategory,
	LyricWord,
	TTMLLyric,
} from "$/types/ttml.ts";
import {
	getOrderedSections,
	getSectionBoundsById,
	normalizeSectionHeader,
	repairSectionIntegrity,
	sectionCategoryLabel,
	sectionTextSimilarity,
} from "./section-system.ts";

// Section editing never changes timings. Everything here except
// applySectionTimings only moves `sectionId` / `geniusHeader` and the
// `sections` list. All functions mutate `lyrics`, so pass an Immer draft.

const nextOrdinal = (
	sections: readonly LyricSection[],
	category: LyricSectionCategory,
) =>
	Math.max(
		0,
		...sections
			.filter((section) => section.category === category)
			.map((section) => section.ordinal ?? 0),
	) + 1;

/** The label a new section of `category` gets, e.g. `[Chorus 3]`. */
export function defaultSectionLabel(
	sections: readonly LyricSection[],
	category: LyricSectionCategory,
) {
	const ordinal = nextOrdinal(sections, category);
	return {
		label: `[${sectionCategoryLabel(category)} ${ordinal}]`,
		ordinal,
	};
}

/**
 * The label to show after retyping a section. A label that only names the old
 * category (`[Verse 2]`) follows the new one; a hand-written label stays.
 */
export function relabelForCategory(
	sections: readonly LyricSection[],
	section: LyricSection,
	category: LyricSectionCategory,
) {
	if (category === section.category) return section;
	const header = normalizeSectionHeader(section.label);
	const others = sections.filter((item) => item.id !== section.id);
	if (
		header?.category !== section.category ||
		header.vocalist ||
		section.category === "other"
	)
		return { ...section, category, confidence: 1 };
	const { label, ordinal } = defaultSectionLabel(others, category);
	return { ...section, category, label, ordinal, confidence: 1 };
}

const assign = (line: LyricLine, section: LyricSection | undefined) => {
	if (section) {
		line.sectionId = section.id;
		line.geniusHeader = section.label;
	} else {
		delete line.sectionId;
		delete line.geniusHeader;
	}
};

/**
 * Starts a new section at `lineIndex`. Inside a section it splits it there;
 * on an unassigned line the new section runs to the end of the unassigned
 * block. Returns the new section, or undefined when the line already starts
 * a section.
 */
export function startSectionAt(
	lyrics: TTMLLyric,
	lineIndex: number,
	category: LyricSectionCategory,
) {
	const lines = lyrics.lyricLines;
	const line = lines[lineIndex];
	if (!line) return undefined;
	let end = lineIndex + 1;
	if (line.sectionId) {
		const bounds = getSectionBoundsById(lines, line.sectionId);
		if (!bounds || bounds.start === lineIndex) return undefined;
		end = bounds.end;
	} else {
		while (end < lines.length && !lines[end].sectionId) end++;
	}
	lyrics.sections ??= [];
	const { label, ordinal } = defaultSectionLabel(lyrics.sections, category);
	const section: LyricSection = {
		id: uid(),
		label,
		category,
		ordinal,
		confidence: 1,
	};
	lyrics.sections.push(section);
	for (let index = lineIndex; index < end; index++) {
		assign(lines[index], section);
	}
	return section;
}

/**
 * Moves where a section starts by one line. "up" takes in the line above it
 * (from the previous section or from unassigned lines); "down" hands its first
 * line to the previous section, or leaves it unassigned. A one-line section
 * can't move down; remove it instead.
 */
export function moveSectionStart(
	lyrics: TTMLLyric,
	sectionId: string,
	direction: "up" | "down",
) {
	const lines = lyrics.lyricLines;
	const bounds = getSectionBoundsById(lines, sectionId);
	const section = lyrics.sections?.find((item) => item.id === sectionId);
	if (!bounds || !section) return false;
	if (direction === "up") {
		if (bounds.start === 0) return false;
		assign(lines[bounds.start - 1], section);
	} else {
		if (bounds.end - bounds.start < 2) return false;
		const previousId = lines[bounds.start - 1]?.sectionId;
		const previous = lyrics.sections?.find((item) => item.id === previousId);
		assign(lines[bounds.start], previous);
	}
	// Drops a previous section that just lost its last line.
	repairSectionIntegrity(lyrics);
	return true;
}

export interface TimingSourceCandidate {
	section: LyricSection;
	similarity: number;
	sameRepeatGroup: boolean;
	suggested: boolean;
}

const isTimedLine = (line: LyricLine) => line.endTime > line.startTime;
const isTimedWord = (word: LyricWord) =>
	word.startTime > 0 || word.endTime > 0;

/**
 * Sections whose timings could be copied onto `targetSectionId`: any other
 * section with at least one timed line. Repeats of the same section come
 * first, then the closest text. The first one is marked as suggested when it's
 * a known repeat or its text is mostly the same.
 */
export function findTimingSources(
	lyrics: TTMLLyric,
	targetSectionId: string,
): TimingSourceCandidate[] {
	const lines = lyrics.lyricLines;
	const ordered = getOrderedSections(lyrics);
	const target = ordered.find((section) => section.id === targetSectionId);
	if (!target) return [];
	const candidates = ordered
		.map((section, order) => ({ section, order }))
		.filter(({ section }) => {
			if (section.id === targetSectionId) return false;
			const bounds = getSectionBoundsById(lines, section.id);
			return (
				!!bounds && lines.slice(bounds.start, bounds.end).some(isTimedLine)
			);
		})
		.map(({ section, order }) => ({
			section,
			order,
			similarity: sectionTextSimilarity(lines, targetSectionId, section.id),
			sameRepeatGroup:
				!!target.repeatGroupId &&
				section.repeatGroupId === target.repeatGroupId,
		}));
	candidates.sort(
		(left, right) =>
			Number(right.sameRepeatGroup) - Number(left.sameRepeatGroup) ||
			right.similarity - left.similarity ||
			left.order - right.order,
	);
	return candidates.map(({ order: _order, ...candidate }, index) => ({
		...candidate,
		suggested:
			index === 0 && (candidate.sameRepeatGroup || candidate.similarity >= 0.6),
	}));
}

const normalizeToken = (value: string) =>
	value
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");

/** Index pairs of the longest common subsequence of two token lists. */
function lcsPairs<T>(
	left: readonly T[],
	right: readonly T[],
	score: (a: T, b: T) => number,
): Array<[number, number]> {
	const rows = left.length + 1;
	const cols = right.length + 1;
	const table = new Float64Array(rows * cols);
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const pair = score(left[i - 1], right[j - 1]);
			table[i * cols + j] = Math.max(
				table[(i - 1) * cols + j],
				table[i * cols + j - 1],
				pair > 0 ? table[(i - 1) * cols + j - 1] + pair : 0,
			);
		}
	}
	const pairs: Array<[number, number]> = [];
	let i = left.length;
	let j = right.length;
	while (i > 0 && j > 0) {
		const here = table[i * cols + j];
		if (here === table[(i - 1) * cols + j]) i--;
		else if (here === table[i * cols + j - 1]) j--;
		else {
			pairs.push([i - 1, j - 1]);
			i--;
			j--;
		}
	}
	return pairs.reverse();
}

interface Token {
	index: number;
	text: string;
}

const tokensOf = (line: LyricLine): Token[] =>
	line.words
		.map((word, index) => ({ index, text: normalizeToken(word.word) }))
		.filter((token) => token.text);

const matchWords = (target: Token[], source: Token[]) =>
	lcsPairs(target, source, (a, b) => (a.text === b.text ? 1 : 0));

/** A pair of lines counts as the same line when at least half its words match. */
function lineMatchScore(target: LyricLine, source: LyricLine) {
	if (target.isBG !== source.isBG) return 0;
	const targetTokens = tokensOf(target);
	const sourceTokens = tokensOf(source);
	const longest = Math.max(targetTokens.length, sourceTokens.length);
	if (longest === 0) return 0;
	const matched = matchWords(targetTokens, sourceTokens).length;
	return matched / longest >= 0.5 ? matched : 0;
}

export interface ApplyTimingsResult {
	/** Target lines that received timings. */
	copiedLines: number;
	totalLines: number;
	/** Words in copied lines that had no match and are now untimed. */
	untimedWords: number;
}

/**
 * Copies a timed section's relative timings onto another section, with the
 * source's first timed line starting at `anchorMs` (the same shift Ctrl+L's
 * duplicate-to-time uses). Lines pair up by their words, in order; inside a
 * paired line only matching words get timings and the rest become untimed.
 * Lines with no match are left exactly as they were.
 */
export function applySectionTimings(
	lyrics: TTMLLyric,
	targetSectionId: string,
	sourceSectionId: string,
	anchorMs: number,
): ApplyTimingsResult | undefined {
	const lines = lyrics.lyricLines;
	const targetBounds = getSectionBoundsById(lines, targetSectionId);
	const sourceBounds = getSectionBoundsById(lines, sourceSectionId);
	if (!targetBounds || !sourceBounds || targetSectionId === sourceSectionId)
		return undefined;
	const sourceLines = lines
		.slice(sourceBounds.start, sourceBounds.end)
		.filter(isTimedLine);
	if (sourceLines.length === 0) return undefined;
	const shifted = copyLinesAtTime(sourceLines, Math.max(0, anchorMs));
	const targetLines = lines.slice(targetBounds.start, targetBounds.end);

	let untimedWords = 0;
	const linePairs = lcsPairs(targetLines, sourceLines, lineMatchScore);
	for (const [targetIndex, sourceIndex] of linePairs) {
		const target = targetLines[targetIndex];
		const source = sourceLines[sourceIndex];
		const copy = shifted[sourceIndex];
		const targetTokens = tokensOf(target);
		const sourceTokens = tokensOf(source);
		const matchedWordIndexes = new Map<number, number>();
		for (const [t, s] of matchWords(targetTokens, sourceTokens)) {
			matchedWordIndexes.set(targetTokens[t].index, sourceTokens[s].index);
		}
		target.words.forEach((word, wordIndex) => {
			if (!word.word.trim()) return;
			const sourceWordIndex = matchedWordIndexes.get(wordIndex);
			if (
				sourceWordIndex !== undefined &&
				isTimedWord(source.words[sourceWordIndex])
			) {
				word.startTime = copy.words[sourceWordIndex].startTime;
				word.endTime = copy.words[sourceWordIndex].endTime;
				return;
			}
			word.startTime = 0;
			word.endTime = 0;
			untimedWords++;
		});
		target.startTime = copy.startTime;
		target.endTime = copy.endTime;
	}
	return {
		copiedLines: linePairs.length,
		totalLines: targetLines.length,
		untimedWords,
	};
}

/**
 * Where Apply timings anchors by default: the target's first timed line if it
 * has one, otherwise the playhead.
 */
export function sectionTimingAnchor(lyrics: TTMLLyric, sectionId: string) {
	const bounds = getSectionBoundsById(lyrics.lyricLines, sectionId);
	if (!bounds) return undefined;
	return lyrics.lyricLines
		.slice(bounds.start, bounds.end)
		.find(isTimedLine)?.startTime;
}
