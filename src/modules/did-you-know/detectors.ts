/**
 * Pure detectors for "Did you know" hints. Each one folds editor snapshots
 * into a small state and says when someone has done the slow version of
 * something enough times to deserve a tip.
 */

export const HINT_IDS = ["repeatedSection", "splitInTimeMode"] as const;
export type HintId = (typeof HINT_IDS)[number];

export interface DetectorWord {
	word: string;
	startTime: number;
	endTime: number;
}

export interface DetectorLine {
	id: string;
	words: readonly DetectorWord[];
}

export interface EditorSnapshot {
	/** A `ToolMode` value: "edit", "sync" or "preview". */
	mode: string;
	lines: readonly DetectorLine[];
}

export interface DetectorResult<S> {
	state: S;
	fire: boolean;
}

const SYNC = "sync";
const EDIT = "edit";

/** Updates touching more lines than this are bulk edits, not hand syncing. */
export const MAX_CHANGED_LINES = 2;
/** Distinct repeated lines synced by hand before the tip shows. */
export const REPEATED_LINES_THRESHOLD = 3;
/** Separate timing edits that make a line "synced by hand". */
export const MANUAL_EDITS_PER_LINE = 2;
/** Round trips Time > Edit (split) > Time before the tip shows. */
export const SPLIT_TRIPS_THRESHOLD = 2;

const textCache = new WeakMap<DetectorLine, string>();

/** Lowercased words with punctuation and spacing collapsed. */
export function normalizeLineText(line: DetectorLine): string {
	const cached = textCache.get(line);
	if (cached !== undefined) return cached;
	const text = line.words
		.map((w) => w.word)
		.join("")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}']+/gu, " ")
		.trim();
	textCache.set(line, text);
	return text;
}

/** Every word with text has an end time. */
export function isLineTimed(line: DetectorLine): boolean {
	let any = false;
	for (const w of line.words) {
		if (!w.word.trim()) continue;
		if (!(w.endTime > 0)) return false;
		any = true;
	}
	return any;
}

const sameTiming = (a: DetectorLine, b: DetectorLine) =>
	a.words.length === b.words.length &&
	a.words.every(
		(w, i) =>
			w.startTime === b.words[i].startTime && w.endTime === b.words[i].endTime,
	);

/**
 * Indexes of lines whose object changed between two snapshots of the same
 * shape, or null when lines were added, removed or reordered. Relies on
 * immer keeping untouched lines identical, so a sync keypress costs one pass
 * of reference checks.
 */
function changedLineIndexes(
	prev: readonly DetectorLine[],
	next: readonly DetectorLine[],
): number[] | null {
	if (prev.length !== next.length) return null;
	const changed: number[] = [];
	for (let i = 0; i < next.length; i++) {
		if (prev[i] === next[i]) continue;
		if (prev[i].id !== next[i].id) return null;
		changed.push(i);
	}
	return changed;
}

// ---------------------------------------------------------------------------
// Repeated section: syncing lines by hand that match an earlier timed line.
// ---------------------------------------------------------------------------

export interface RepeatedSectionState {
	/** Timing edits seen per line id. */
	edits: ReadonlyMap<string, number>;
	/** Lines synced by hand that repeat an earlier timed line. */
	counted: ReadonlySet<string>;
}

export const initialRepeatedSectionState = (): RepeatedSectionState => ({
	edits: new Map(),
	counted: new Set(),
});

function hasEarlierTimedTwin(
	lines: readonly DetectorLine[],
	index: number,
	text: string,
): boolean {
	for (let i = 0; i < index; i++) {
		if (normalizeLineText(lines[i]) === text && isLineTimed(lines[i]))
			return true;
	}
	return false;
}

export function stepRepeatedSection(
	state: RepeatedSectionState,
	prev: EditorSnapshot,
	next: EditorSnapshot,
): DetectorResult<RepeatedSectionState> {
	const unchanged = { state, fire: false };
	if (next.mode !== SYNC || prev.lines === next.lines) return unchanged;

	const changed = changedLineIndexes(prev.lines, next.lines);
	if (!changed || changed.length === 0 || changed.length > MAX_CHANGED_LINES)
		return unchanged;

	let edits: Map<string, number> | null = null;
	let counted: Set<string> | null = null;

	for (const index of changed) {
		const before = prev.lines[index];
		const after = next.lines[index];
		if (sameTiming(before, after)) continue;
		const text = normalizeLineText(after);
		// One-word lines ("Yeah", "Oh") repeat everywhere; skip them.
		if (text.split(" ").length < 2) continue;
		if (normalizeLineText(before) !== text) continue;
		if (!hasEarlierTimedTwin(next.lines, index, text)) continue;

		edits ??= new Map(state.edits);
		const count = (edits.get(after.id) ?? 0) + 1;
		edits.set(after.id, count);
		if (count >= MANUAL_EDITS_PER_LINE && !state.counted.has(after.id)) {
			counted ??= new Set(state.counted);
			counted.add(after.id);
		}
	}

	if (!edits) return unchanged;
	const nextState = { edits, counted: counted ?? state.counted };
	return {
		state: nextState,
		fire: nextState.counted.size >= REPEATED_LINES_THRESHOLD,
	};
}

// ---------------------------------------------------------------------------
// Split in Time mode: leaving Time mode just to split a word, then coming back.
// ---------------------------------------------------------------------------

export interface SplitTripState {
	/** In Edit mode after leaving Time mode. */
	visiting: boolean;
	/** A word was split during this visit. */
	split: boolean;
	trips: number;
}

export const initialSplitTripState = (): SplitTripState => ({
	visiting: false,
	split: false,
	trips: 0,
});

const compactText = (line: DetectorLine) =>
	line.words
		.map((w) => w.word)
		.join("")
		.replace(/\s+/g, "");

function hasSplitWord(prev: EditorSnapshot, next: EditorSnapshot): boolean {
	const changed = changedLineIndexes(prev.lines, next.lines);
	if (!changed) return false;
	return changed.some((index) => {
		const before = prev.lines[index];
		const after = next.lines[index];
		return (
			after.words.length > before.words.length &&
			compactText(after) === compactText(before)
		);
	});
}

export function stepSplitTrip(
	state: SplitTripState,
	prev: EditorSnapshot,
	next: EditorSnapshot,
): DetectorResult<SplitTripState> {
	if (prev.mode !== next.mode) {
		if (prev.mode === SYNC && next.mode === EDIT)
			return { state: { ...state, visiting: true, split: false }, fire: false };
		if (state.visiting && state.split && next.mode === SYNC) {
			const trips = state.trips + 1;
			return {
				state: { visiting: false, split: false, trips },
				fire: trips >= SPLIT_TRIPS_THRESHOLD,
			};
		}
		if (state.visiting)
			return {
				state: { ...state, visiting: false, split: false },
				fire: false,
			};
		return { state, fire: false };
	}

	if (
		state.visiting &&
		!state.split &&
		next.mode === EDIT &&
		prev.lines !== next.lines &&
		hasSplitWord(prev, next)
	)
		return { state: { ...state, split: true }, fire: false };

	return { state, fire: false };
}

// ---------------------------------------------------------------------------
// Gate: whether a fired hint shows now, waits, or is dropped.
// ---------------------------------------------------------------------------

export interface HintGate {
	enabled: boolean;
	shown: readonly string[];
	shownThisSession: boolean;
	/** Time mode with playback running. */
	syncing: boolean;
}

export type HintDecision = "show" | "defer" | "drop";

export function decideHint(id: HintId, gate: HintGate): HintDecision {
	if (!gate.enabled || gate.shownThisSession || gate.shown.includes(id))
		return "drop";
	if (gate.syncing) return "defer";
	return "show";
}
