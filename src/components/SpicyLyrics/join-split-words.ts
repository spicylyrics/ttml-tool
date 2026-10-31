/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import type { LyricLine, LyricWord } from "$/types/ttml";
import { stripZeroWidth } from "./model";

// Silence between two parts of a word beyond which one fill would run through it.
const MAX_JOIN_GAP_MS = 100;
// A part sung this many times faster or slower per character than the word as a
// whole stays split, since a joined word fills at one steady pace.
const MAX_PACE_RATIO = 3;

const hasSpace = (text: string) => /\s/u.test(text);
// "Ah-" "ah-" "ah": a trailing dash marks a deliberate break, so the parts stay apart.
const endsWithDash = (text: string) => /[-‐-―]$/u.test(text);
// Scripts written without spaces: there the parts of a "word" can run the whole
// line, which would join into one, so they stay as they were timed.
const unspacedScript =
	/[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Thai}\p{scx=Lao}\p{scx=Khmer}\p{scx=Myanmar}]/u;

/** The text Spicy measures: trimmed, and without a background vocal's parentheses. */
const clean = (value: string, background: boolean) =>
	stripZeroWidth(
		background ? value.trim().replace(/[()]/g, "").trim() : value.trim(),
	);

/** A word the Spicy preview renders as a syllable of its own. */
const isSyllable = (word: LyricWord, background: boolean) =>
	!/^\s*$/u.test(word.word) &&
	Number.isFinite(word.startTime) &&
	Number.isFinite(word.endTime) &&
	word.endTime >= word.startTime &&
	clean(word.word, background).length > 0;

/**
 * Spicy's IsPartOfWord: the next span touches this one and neither side carries
 * the break (whitespace or a comma at the end, whitespace at the start).
 */
const continuesInto = (word: LyricWord, next: LyricWord, background: boolean) =>
	isSyllable(next, background) &&
	!/[\s,]$/u.test(word.word) &&
	!/^\s/u.test(next.word);

function paceIsEven(run: LyricWord[], texts: string[]) {
	const duration = run[run.length - 1].endTime - run[0].startTime;
	const chars = texts.reduce((sum, text) => sum + text.length, 0);
	if (duration <= 0 || chars === 0) return false;

	return run.every((part, index) => {
		const timeShare = (part.endTime - part.startTime) / duration;
		const charShare = texts[index].length / chars;
		return (
			timeShare >= charShare / MAX_PACE_RATIO &&
			timeShare <= charShare * MAX_PACE_RATIO
		);
	});
}

function canJoin(run: LyricWord[], background: boolean) {
	const texts = run.map((part) => clean(part.word, background));
	if (
		!run.every(
			(part, index) =>
				texts[index].length > 0 &&
				!hasSpace(texts[index]) &&
				!hasSpace(clean(part.romanWord, background)),
		)
	)
		return false;

	if (texts.slice(0, -1).some(endsWithDash)) return false;
	if (texts.some((text) => unspacedScript.test(text))) return false;

	for (let index = 1; index < run.length; index++) {
		if (run[index].startTime - run[index - 1].endTime > MAX_JOIN_GAP_MS)
			return false;
	}
	return paceIsEven(run, texts);
}

/**
 * A word joined from split parts. It keeps the first part's id, and
 * `joinedIds` lists every part's id in order (the first included), so a
 * lookup keyed by editor word id can still find any part.
 */
export type JoinedLyricWord = LyricWord & { joinedIds?: readonly string[] };

/** The editor word ids a preview word stands for: its parts if joined, else itself. */
export const sourceWordIds = (word: JoinedLyricWord): readonly string[] =>
	word.joinedIds ?? [word.id];

/**
 * Re-keys a lookup by editor word id onto joined words: a joined word gets
 * every value its parts had, in part order and without repeats.
 */
export function remapToJoinedWords<T>(
	lines: readonly LyricLine[],
	byWordId: ReadonlyMap<string, readonly T[]>,
): ReadonlyMap<string, readonly T[]> {
	const result = new Map(byWordId);
	for (const line of lines) {
		for (const word of line.words as JoinedLyricWord[]) {
			if (!word.joinedIds) continue;
			const values = new Set(
				word.joinedIds.flatMap((id) => byWordId.get(id) ?? []),
			);
			if (values.size > 0) result.set(word.id, [...values]);
		}
	}
	return result;
}

function join(run: LyricWord[]): JoinedLyricWord {
	const first = run[0];
	const hasRomanization = run.some((part) => part.romanWord.trim().length > 0);

	return {
		...first,
		id: first.id,
		joinedIds: run.map((part) => part.id),
		// Raw text, so the first part's leading space and the last part's
		// trailing space or comma still mark the word's edges.
		word: run.map((part) => part.word).join(""),
		romanWord: hasRomanization
			? run.map((part) => part.romanWord.trim() || part.word.trim()).join("")
			: first.romanWord,
		endTime: Math.max(...run.map((part) => part.endTime)),
	};
}

/**
 * Spicy Lyrics' "Join Split Words": put the parts of a split word back into one
 * syllable. A word that doesn't join cleanly (a gap, an uneven pace, a space
 * inside, a dash between parts) stays split. Returns the same array when
 * nothing joins.
 */
export function joinSplitWords(
	words: LyricWord[],
	background = false,
): LyricWord[] {
	const joined: LyricWord[] = [];
	let changed = false;

	for (let index = 0; index < words.length; index++) {
		let end = index;
		if (isSyllable(words[index], background)) {
			while (
				end + 1 < words.length &&
				continuesInto(words[end], words[end + 1], background)
			)
				end++;
		}

		const run = words.slice(index, end + 1);
		if (run.length > 1 && canJoin(run, background)) {
			joined.push(join(run));
			changed = true;
		} else {
			joined.push(...run);
		}
		index = end;
	}

	return changed ? joined : words;
}

/** Join split words in every line, keeping lines with nothing to join as they are. */
const joinedLineCache = new WeakMap<LyricLine, LyricLine>();

export function joinSplitWordsInLines(lines: LyricLine[]): LyricLine[] {
	let changed = false;
	const result = lines.map((line) => {
		const cached = joinedLineCache.get(line);
		if (cached) {
			changed ||= cached !== line;
			return cached;
		}
		const words = joinSplitWords(line.words, !!line.isBG);
		if (words === line.words) {
			joinedLineCache.set(line, line);
			return line;
		}
		changed = true;
		const joined = { ...line, words };
		joinedLineCache.set(line, joined);
		return joined;
	});
	return changed ? result : lines;
}
