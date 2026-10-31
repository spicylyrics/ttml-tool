import { uid } from "uid";
import type {
	LyricLine,
	LyricSection,
	LyricSectionCategory,
	TTMLLyric,
} from "$/types/ttml.ts";

const CATEGORY_ALIASES: Record<string, LyricSectionCategory> = {
	intro: "intro",
	introduction: "intro",
	verse: "verse",
	strofa: "verse",
	strophe: "verse",
	slofa: "verse",
	couplet: "verse",
	prechorus: "pre-chorus",
	"pre chorus": "pre-chorus",
	prerefrain: "pre-chorus",
	"pre refrain": "pre-chorus",
	prerefren: "pre-chorus",
	"pre refren": "pre-chorus",
	chorus: "chorus",
	refren: "refrain",
	refrain: "refrain",
	postchorus: "post-chorus",
	"post chorus": "post-chorus",
	hook: "hook",
	bridge: "bridge",
	pont: "bridge",
	break: "break",
	breakdown: "break",
	interlude: "interlude",
	instrumental: "instrumental",
	solo: "solo",
	spoken: "spoken",
	speech: "spoken",
	skit: "skit",
	sample: "sample",
	outro: "outro",
};

const WORD_ORDINALS: Record<string, number> = {
	one: 1,
	first: 1,
	two: 2,
	second: 2,
	three: 3,
	third: 3,
	four: 4,
	fourth: 4,
	five: 5,
	fifth: 5,
	six: 6,
	sixth: 6,
};

const romanToNumber = (value: string) => {
	const roman = value.toUpperCase();
	if (!/^[IVXLCDM]+$/.test(roman)) return undefined;
	const values: Record<string, number> = {
		I: 1,
		V: 5,
		X: 10,
		L: 50,
		C: 100,
		D: 500,
		M: 1000,
	};
	let total = 0;
	for (let index = 0; index < roman.length; index++) {
		const current = values[roman[index]];
		const next = values[roman[index + 1]] ?? 0;
		total += current < next ? -current : current;
	}
	return total > 0 ? total : undefined;
};

export interface NormalizedSectionHeader {
	label: string;
	category: LyricSectionCategory;
	ordinal?: number;
	vocalist?: string;
	confidence: number;
	normalizedKey: string;
}

export function getSectionHeader(value: string): string | undefined {
	const trimmed = value.trim();
	return /^\[[^[\]\r\n]+\]$/.test(trimmed) ? trimmed : undefined;
}

export function normalizeSectionHeader(
	value: string,
): NormalizedSectionHeader | undefined {
	const label = getSectionHeader(value);
	if (!label) return undefined;
	const inner = label
		.slice(1, -1)
		.normalize("NFKC")
		.replace(/[–—]/g, "-")
		.replace(/\s+/g, " ")
		.trim();
	const [rawType, ...suffixParts] = inner.split(/\s*:\s*/);
	const vocalist = suffixParts.join(": ").trim() || undefined;
	const ordinalMatch = rawType.match(
		/(?:\s+|^)(\d+|[ivxlcdm]+|one|first|two|second|three|third|four|fourth|five|fifth|six|sixth)$/i,
	);
	const ordinalToken = ordinalMatch?.[1]?.toLowerCase();
	const ordinal = ordinalToken
		? Number.parseInt(ordinalToken, 10) ||
			WORD_ORDINALS[ordinalToken] ||
			romanToNumber(ordinalToken)
		: undefined;
	const typeText = rawType
		.replace(
			/(?:\s+|^)(\d+|[ivxlcdm]+|one|first|two|second|three|third|four|fourth|five|fifth|six|sixth)$/i,
			"",
		)
		.replace(/[-_]+/g, " ")
		.trim()
		.toLowerCase();
	const category = CATEGORY_ALIASES[typeText] ?? "other";
	const confidence = category === "other" ? 0.35 : 1;
	return {
		label,
		category,
		ordinal,
		vocalist,
		confidence,
		normalizedKey: `${category}:${ordinal ?? ""}:${vocalist?.toLowerCase() ?? ""}`,
	};
}

export function createSectionFromHeader(
	value: string,
): LyricSection | undefined {
	const normalized = normalizeSectionHeader(value);
	if (!normalized) return undefined;
	return {
		id: uid(),
		label: normalized.label,
		category: normalized.category,
		ordinal: normalized.ordinal,
		confidence: normalized.confidence,
	};
}

export function migrateLegacySections(lyrics: TTMLLyric): TTMLLyric {
	lyrics.sections ??= [];
	const existingIds = new Set(lyrics.sections.map((section) => section.id));
	let previousHeader: string | undefined;
	let currentSectionId: string | undefined;
	for (const line of lyrics.lyricLines) {
		if (line.sectionId && existingIds.has(line.sectionId)) {
			previousHeader = line.geniusHeader;
			currentSectionId = line.sectionId;
			continue;
		}
		if (!line.geniusHeader) {
			previousHeader = undefined;
			currentSectionId = undefined;
			continue;
		}
		if (line.geniusHeader !== previousHeader || !currentSectionId) {
			const section = createSectionFromHeader(line.geniusHeader);
			if (section) {
				lyrics.sections.push(section);
				existingIds.add(section.id);
				currentSectionId = section.id;
			}
		}
		line.sectionId = currentSectionId;
		previousHeader = line.geniusHeader;
	}
	return lyrics;
}

export function getSectionBoundsById(lines: LyricLine[], sectionId: string) {
	const start = lines.findIndex((line) => line.sectionId === sectionId);
	if (start === -1) return undefined;
	let end = start + 1;
	while (end < lines.length && lines[end].sectionId === sectionId) end++;
	return { start, end };
}

/** Keeps the persisted section model compatible with the editor's contiguous-range UI. */
export function repairSectionIntegrity(lyrics: TTMLLyric) {
	lyrics.sections ??= [];
	const sectionsById = new Map(
		lyrics.sections.map((section) => [section.id, section]),
	);
	const seenRanges = new Set<string>();
	let previousOriginalId: string | undefined;
	let activeId: string | undefined;
	for (const line of lyrics.lyricLines) {
		const sectionId = line.sectionId;
		if (!sectionId) {
			previousOriginalId = undefined;
			activeId = undefined;
			continue;
		}
		const source = sectionsById.get(sectionId);
		if (!source) {
			delete line.sectionId;
			delete line.geniusHeader;
			previousOriginalId = undefined;
			activeId = undefined;
			continue;
		}
		if (sectionId === previousOriginalId && activeId) {
			line.sectionId = activeId;
			line.geniusHeader = sectionsById.get(activeId)?.label;
			continue;
		}
		if (seenRanges.has(sectionId)) {
			const repeatGroupId = source.repeatGroupId ?? uid();
			source.repeatGroupId = repeatGroupId;
			const clone = { ...source, id: uid(), repeatGroupId };
			lyrics.sections.push(clone);
			sectionsById.set(clone.id, clone);
			line.sectionId = clone.id;
			line.geniusHeader = clone.label;
			previousOriginalId = sectionId;
			activeId = clone.id;
			seenRanges.add(clone.id);
			continue;
		}
		seenRanges.add(sectionId);
		line.geniusHeader = source.label;
		previousOriginalId = sectionId;
		activeId = sectionId;
	}
	const usedIds = new Set(
		lyrics.lyricLines.flatMap((line) =>
			line.sectionId ? [line.sectionId] : [],
		),
	);
	lyrics.sections = lyrics.sections.filter((section) =>
		usedIds.has(section.id),
	);
	return lyrics;
}

/**
 * The section a line placed at `index` falls inside: the one shared by the
 * lines on both sides of that spot. At a boundary between two sections, or
 * next to unassigned lines, there's no section to join.
 */
export function sectionIdAt(lines: LyricLine[], index: number) {
	const previous = lines[index - 1]?.sectionId;
	return previous && previous === lines[index]?.sectionId
		? previous
		: undefined;
}

/**
 * Inserts lines at `index` and puts them in `sectionId` when given, so a line
 * added inside a section stays part of it instead of splitting the section
 * into two headers. Mutates `lyrics` (an Immer draft is fine).
 */
export function insertLinesInSection(
	lyrics: TTMLLyric,
	index: number,
	newLines: LyricLine[],
	sectionId: string | undefined,
) {
	const section = sectionId
		? lyrics.sections?.find((item) => item.id === sectionId)
		: undefined;
	if (section) {
		for (const line of newLines) {
			line.sectionId = section.id;
			line.geniusHeader = section.label;
		}
	}
	lyrics.lyricLines.splice(index, 0, ...newLines);
	repairSectionIntegrity(lyrics);
}

export function duplicateLinesWithSections(
	lyrics: TTMLLyric,
	selectedLineIds: ReadonlySet<string>,
	targetSectionId?: string,
) {
	const sectionById = new Map(
		(lyrics.sections ?? []).map((section) => [section.id, section]),
	);
	const clones = new Map<string, LyricSection>();
	const duplicated: LyricLine[] = [];
	for (const line of lyrics.lyricLines) {
		if (!selectedLineIds.has(line.id)) continue;
		const copy: LyricLine = {
			...line,
			id: uid(),
			words: line.words.map((word) => ({ ...word, id: uid() })),
		};
		// Copies placed inside a section join it; only copies placed elsewhere
		// get a repeat of their original section.
		if (line.sectionId && !targetSectionId) {
			const source = sectionById.get(line.sectionId);
			if (source) {
				let clone = clones.get(source.id);
				if (!clone) {
					const repeatGroupId = source.repeatGroupId ?? uid();
					source.repeatGroupId = repeatGroupId;
					clone = { ...source, id: uid(), repeatGroupId };
					lyrics.sections ??= [];
					lyrics.sections.push(clone);
					clones.set(source.id, clone);
				}
				copy.sectionId = clone.id;
				copy.geniusHeader = clone.label;
			}
		}
		duplicated.push(copy);
	}
	return duplicated;
}

export function getOrderedSections(lyrics: TTMLLyric) {
	const sectionById = new Map(
		(lyrics.sections ?? []).map((section) => [section.id, section]),
	);
	const seen = new Set<string>();
	const ordered: LyricSection[] = [];
	for (const line of lyrics.lyricLines) {
		if (!line.sectionId || seen.has(line.sectionId)) continue;
		const section = sectionById.get(line.sectionId);
		if (!section) continue;
		seen.add(section.id);
		ordered.push(section);
	}
	return ordered;
}

const normalizedLyricsText = (lines: LyricLine[], sectionId: string) =>
	lines
		.filter((line) => line.sectionId === sectionId)
		.flatMap((line) => line.words.map((word) => word.word))
		.join(" ")
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();

const bigrams = (value: string) => {
	const result = new Set<string>();
	for (let index = 0; index < value.length - 1; index++) {
		result.add(value.slice(index, index + 2));
	}
	return result;
};

export function sectionTextSimilarity(
	lines: LyricLine[],
	leftId: string,
	rightId: string,
) {
	const left = normalizedLyricsText(lines, leftId);
	const right = normalizedLyricsText(lines, rightId);
	if (left === right) return 1;
	if (!left || !right) return 0;
	const leftPairs = bigrams(left);
	const rightPairs = bigrams(right);
	let overlap = 0;
	for (const pair of leftPairs) if (rightPairs.has(pair)) overlap++;
	return (2 * overlap) / (leftPairs.size + rightPairs.size);
}

export function assignHighConfidenceRepeatGroups(lyrics: TTMLLyric) {
	const sections = lyrics.sections ?? [];
	for (let index = 0; index < sections.length; index++) {
		const current = sections[index];
		if (current.category === "other" || current.repeatGroupId) continue;
		const currentBounds = getSectionBoundsById(lyrics.lyricLines, current.id);
		if (!currentBounds) continue;
		for (let candidateIndex = 0; candidateIndex < index; candidateIndex++) {
			const candidate = sections[candidateIndex];
			if (candidate.category !== current.category) continue;
			const candidateBounds = getSectionBoundsById(
				lyrics.lyricLines,
				candidate.id,
			);
			if (
				!candidateBounds ||
				Math.abs(
					currentBounds.end -
						currentBounds.start -
						(candidateBounds.end - candidateBounds.start),
				) > 1
			)
				continue;
			if (
				sectionTextSimilarity(lyrics.lyricLines, current.id, candidate.id) >=
				0.9
			) {
				const groupId = candidate.repeatGroupId ?? uid();
				candidate.repeatGroupId = groupId;
				current.repeatGroupId = groupId;
				break;
			}
		}
	}
}

export function applyReviewedSections(
	lyrics: TTMLLyric,
	reviewed: Array<
		Partial<LyricSection> & { occurrence: number; lineCount?: number }
	>,
) {
	migrateLegacySections(lyrics);
	const sections = lyrics.sections ?? [];
	for (let index = 0; index < sections.length; index++) {
		const override = reviewed.find((item) => item.occurrence === index);
		if (!override) continue;
		const {
			occurrence: _occurrence,
			id: _id,
			lineCount: _lineCount,
			...metadata
		} = override;
		Object.assign(sections[index], metadata);
	}
	assignHighConfidenceRepeatGroups(lyrics);
	return lyrics;
}

export function splitSection(
	lyrics: TTMLLyric,
	sectionId: string,
	lineIndex: number,
) {
	const bounds = getSectionBoundsById(lyrics.lyricLines, sectionId);
	const source = lyrics.sections?.find((section) => section.id === sectionId);
	if (
		!bounds ||
		!source ||
		lineIndex <= bounds.start ||
		lineIndex >= bounds.end
	)
		return undefined;
	const section: LyricSection = {
		...source,
		id: uid(),
		repeatGroupId: undefined,
	};
	lyrics.sections?.push(section);
	for (let index = lineIndex; index < bounds.end; index++) {
		lyrics.lyricLines[index].sectionId = section.id;
		lyrics.lyricLines[index].geniusHeader = section.label;
	}
	return section;
}

export function mergeUnassignedBlock(
	lyrics: TTMLLyric,
	lineIndex: number,
	direction: "previous" | "next",
) {
	const line = lyrics.lyricLines[lineIndex];
	if (!line || line.sectionId) return false;
	let start = lineIndex;
	let end = lineIndex + 1;
	while (start > 0 && !lyrics.lyricLines[start - 1].sectionId) start--;
	while (end < lyrics.lyricLines.length && !lyrics.lyricLines[end].sectionId)
		end++;
	const targetId =
		direction === "previous"
			? lyrics.lyricLines[start - 1]?.sectionId
			: lyrics.lyricLines[end]?.sectionId;
	const target = lyrics.sections?.find((section) => section.id === targetId);
	if (!targetId || !target) return false;
	for (let index = start; index < end; index++) {
		lyrics.lyricLines[index].sectionId = targetId;
		lyrics.lyricLines[index].geniusHeader = target.label;
	}
	return true;
}

export function mergeSectionWithAdjacent(
	lyrics: TTMLLyric,
	sectionId: string,
	direction: "previous" | "next",
) {
	const bounds = getSectionBoundsById(lyrics.lyricLines, sectionId);
	if (!bounds) return false;
	const adjacentIndex =
		direction === "previous" ? bounds.start - 1 : bounds.end;
	const adjacentId = lyrics.lyricLines[adjacentIndex]?.sectionId;
	if (!adjacentId || adjacentId === sectionId) return false;
	const sourceId = direction === "previous" ? sectionId : adjacentId;
	const targetId = direction === "previous" ? adjacentId : sectionId;
	const target = lyrics.sections?.find((section) => section.id === targetId);
	for (const line of lyrics.lyricLines) {
		if (line.sectionId === sourceId) {
			line.sectionId = targetId;
			line.geniusHeader = target?.label;
		}
	}
	lyrics.sections = (lyrics.sections ?? []).filter(
		(section) => section.id !== sourceId,
	);
	return true;
}

export function removeSectionMetadata(lyrics: TTMLLyric, sectionId: string) {
	for (const line of lyrics.lyricLines) {
		if (line.sectionId === sectionId) {
			delete line.sectionId;
			delete line.geniusHeader;
		}
	}
	lyrics.sections = (lyrics.sections ?? []).filter(
		(section) => section.id !== sectionId,
	);
}

export const sectionCategoryLabel = (category: LyricSectionCategory) =>
	category
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("-");

/**
 * Adds sections for each contiguous block of unassigned selected lines.
 * Returns no sections when the selection includes an existing section, so a
 * manual categorization action can never overwrite section metadata.
 */
export function createSectionsFromSelectedLines(
	lyrics: TTMLLyric,
	selectedLineIds: ReadonlySet<string>,
	category: LyricSectionCategory,
) {
	const selectedIndexes = lyrics.lyricLines
		.map((line, index) => (selectedLineIds.has(line.id) ? index : -1))
		.filter((index) => index !== -1);
	if (
		selectedIndexes.length === 0 ||
		selectedIndexes.some((index) => lyrics.lyricLines[index].sectionId)
	)
		return [];

	const blocks: Array<{ start: number; end: number }> = [];
	for (const index of selectedIndexes) {
		const previous = blocks[blocks.length - 1];
		if (previous && index === previous.end) {
			previous.end++;
		} else {
			blocks.push({ start: index, end: index + 1 });
		}
	}

	lyrics.sections ??= [];
	let ordinal = Math.max(
		0,
		...lyrics.sections
			.filter((section) => section.category === category)
			.map((section) => section.ordinal ?? 0),
	);
	const created: LyricSection[] = [];
	for (const block of blocks) {
		ordinal++;
		const section: LyricSection = {
			id: uid(),
			label: `[${sectionCategoryLabel(category)} ${ordinal}]`,
			category,
			ordinal,
			confidence: 1,
		};
		lyrics.sections.push(section);
		for (let index = block.start; index < block.end; index++) {
			lyrics.lyricLines[index].sectionId = section.id;
			lyrics.lyricLines[index].geniusHeader = section.label;
		}
		created.push(section);
	}
	return created;
}

export function moveSection(
	lyrics: TTMLLyric,
	sectionId: string,
	direction: "up" | "down",
) {
	const bounds = getSectionBoundsById(lyrics.lyricLines, sectionId);
	if (!bounds) return false;
	if (direction === "up") {
		const previousId = lyrics.lyricLines[bounds.start - 1]?.sectionId;
		if (!previousId) return false;
		const previousBounds = getSectionBoundsById(lyrics.lyricLines, previousId);
		if (!previousBounds) return false;
		const moved = lyrics.lyricLines.splice(
			bounds.start,
			bounds.end - bounds.start,
		);
		lyrics.lyricLines.splice(previousBounds.start, 0, ...moved);
		return true;
	}
	const nextId = lyrics.lyricLines[bounds.end]?.sectionId;
	if (!nextId) return false;
	const nextBounds = getSectionBoundsById(lyrics.lyricLines, nextId);
	if (!nextBounds) return false;
	const moved = lyrics.lyricLines.splice(
		bounds.start,
		bounds.end - bounds.start,
	);
	const insertionIndex = nextBounds.end - moved.length;
	lyrics.lyricLines.splice(insertionIndex, 0, ...moved);
	return true;
}
