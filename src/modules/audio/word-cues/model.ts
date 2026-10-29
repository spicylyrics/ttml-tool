import type { LyricLine } from "$/types/ttml";

export interface CueSpan {
	start: number;
	end: number;
}
export interface CueWord extends CueSpan {
	/** Exact starts of timed syllable spans nested inside this word. */
	boundaries: number[];
	/** The word split at `boundaries`; a single span for unsplit words. */
	syllables: CueSpan[];
}
export type CueVoice = "duet" | "background";
export interface CueBoundary {
	timeMs: number;
	kind: "start" | "end" | "syllable";
	voice?: CueVoice;
}
export type CueMode = "word" | "syllable";
export interface CueIndex {
	/** Lead and duet words, shown by the indicator. */
	words: CueWord[];
	maxEnds: number[];
	/** Sorted starts of every syllable in `words`. */
	syllableStarts: number[];
	/** Click boundaries for every voice, sorted by time. */
	clicks: Record<CueMode, CueBoundary[]>;
}

const timed = /[\p{L}\p{N}]/u;
const byTime = (a: CueSpan, b: CueSpan) => a.start - b.start || a.end - b.end;

/** Index of the first item whose time is greater than `timeMs`. */
export function upperBound<T>(
	items: readonly T[],
	timeMs: number,
	time: (item: T) => number,
) {
	let low = 0;
	let high = items.length;
	while (low < high) {
		const mid = (low + high) >>> 1;
		if (time(items[mid]) <= timeMs) low = mid + 1;
		else high = mid;
	}
	return low;
}

function wordFromSpans(spans: LyricLine["words"]): CueWord {
	const syllables: CueSpan[] = [];
	let currentHasText = false;
	for (const span of spans) {
		const current = syllables[syllables.length - 1];
		const hasText = timed.test(span.word);
		// Punctuation-only spans join the syllable before them, and leading
		// punctuation joins the first syllable, so the indicator and the clicks
		// agree on where each syllable starts.
		if (current && !(hasText && currentHasText)) {
			current.end = Math.max(current.end, span.endTime);
			currentHasText ||= hasText;
		} else {
			syllables.push({ start: span.startTime, end: span.endTime });
			currentHasText = hasText;
		}
	}
	return {
		start: spans[0].startTime,
		end: Math.max(...spans.map((span) => span.endTime)),
		boundaries: syllables.slice(1).map((syllable) => syllable.start),
		syllables,
	};
}

function clicksFor(words: CueWord[], voice?: CueVoice) {
	const tag = voice ? { voice } : {};
	return {
		word: words.flatMap((word): CueBoundary[] => [
			{ timeMs: word.start, kind: "start", ...tag },
			{ timeMs: word.end, kind: "end", ...tag },
		]),
		syllable: words.flatMap((word) =>
			word.syllables.map(
				(syllable): CueBoundary => ({
					timeMs: syllable.start,
					kind: "syllable",
					...tag,
				}),
			),
		),
	};
}

/** Sorts boundaries and drops repeats of the same time, kind and voice. */
function mergeClicks(boundaries: CueBoundary[]) {
	const key = (b: CueBoundary) => `${b.voice ?? ""}:${b.kind}`;
	return boundaries
		.sort((a, b) => a.timeMs - b.timeMs || key(a).localeCompare(key(b)))
		.filter(
			(boundary, i, all) =>
				i === 0 ||
				boundary.timeMs !== all[i - 1].timeMs ||
				key(boundary) !== key(all[i - 1]),
		);
}

export function buildCueIndex(lines: LyricLine[]): CueIndex {
	const groups: Record<"lead" | CueVoice, CueWord[]> = {
		lead: [],
		duet: [],
		background: [],
	};
	for (const line of lines) {
		// Directly timed lines don't contain genuine word boundaries.
		if (line.isLineSynced || line.ignoreSync) continue;
		const target =
			groups[line.isBG ? "background" : line.isDuet ? "duet" : "lead"];
		let spans: typeof line.words = [];
		const flush = () => {
			if (spans.length) target.push(wordFromSpans(spans));
			spans = [];
		};
		for (const span of line.words) {
			if (!span.word) continue;
			if (
				/^\s+$/u.test(span.word) ||
				!Number.isFinite(span.startTime) ||
				!Number.isFinite(span.endTime) ||
				span.startTime < 0 ||
				span.endTime <= span.startTime
			) {
				flush();
				continue;
			}
			spans.push(span);
		}
		flush();
	}
	const words = [...groups.lead, ...groups.duet].sort(byTime);
	const maxEnds: number[] = [];
	for (const word of words)
		maxEnds.push(Math.max(maxEnds[maxEnds.length - 1] ?? 0, word.end));
	const lead = clicksFor(groups.lead);
	const duet = clicksFor(groups.duet, "duet");
	const background = clicksFor(groups.background, "background");
	return {
		words,
		maxEnds,
		syllableStarts: words
			.flatMap((word) => word.syllables.map((syllable) => syllable.start))
			.sort((a, b) => a - b),
		clicks: {
			word: mergeClicks([...lead.word, ...duet.word, ...background.word]),
			syllable: mergeClicks([
				...lead.syllable,
				...duet.syllable,
				...background.syllable,
			]),
		},
	};
}

export function cueAt(index: CueIndex, timeMs: number, mode: CueMode = "word") {
	const low = upperBound(index.words, timeMs, (word) => word.start);
	const next = index.words[low];
	const nextCueTime =
		mode === "syllable"
			? index.syllableStarts[
					upperBound(index.syllableStarts, timeMs, (start) => start)
				]
			: next?.start;
	// Prefer the most recently started active word when lead lines overlap.
	for (let i = low - 1; i >= 0 && index.maxEnds[i] > timeMs; i--) {
		const word = index.words[i];
		if (word.end <= timeMs) continue;
		const span =
			mode === "syllable"
				? word.syllables.find(
						(syllable) => syllable.start <= timeMs && syllable.end > timeMs,
					)
				: word;
		return {
			active: word,
			activeSyllable: mode === "syllable" ? span : undefined,
			next,
			nextCueTime,
			progress: span ? (timeMs - span.start) / (span.end - span.start) : 0,
		};
	}
	return {
		active: undefined,
		activeSyllable: undefined,
		next,
		nextCueTime,
		progress: 0,
	};
}
