import * as wanakana from "wanakana";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import type { LyricLine, LyricWord } from "$/types/ttml";

/**
 * Aligns a pasted romanized lyric page (such as Genius's "Romanized" page) to
 * the Japanese lines: lines are matched one to one, then each word takes its
 * share of the line's romaji. Kana and Latin words are matched by their own
 * reading; kanji in between share what's left, split by mora.
 */

export interface AlignedLine {
	lineId: string;
	/** The line's number as the editor shows it. */
	lineNumber: number;
	romanWords: Record<string, string>;
	/** True when some word's share was guessed (kanji runs, or no match). */
	uncertain: boolean;
}

export type RomanizedAlignment =
	| { ok: true; lines: AlignedLine[] }
	| { ok: false; reason: "line-count"; expected: number; received: number };

const MACRONS: Record<string, string> = {
	ā: "aa",
	ī: "ii",
	ū: "uu",
	ē: "ee",
	ō: "ou",
	â: "aa",
	î: "ii",
	û: "uu",
	ê: "ee",
	ô: "ou",
};

const normalizeChar = (char: string) => {
	const lower = char.toLowerCase();
	return (MACRONS[lower] ?? lower)
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^a-z]/g, "");
};

/**
 * Lowercase letters only, macrons spelled out ("Kyō" → "kyou"), plus where
 * each normalized letter came from in the original text.
 */
function normalizeWithSources(text: string) {
	let normalized = "";
	const sources: number[] = [];
	let offset = 0;
	for (const char of text) {
		for (const letter of normalizeChar(char)) {
			normalized += letter;
			sources.push(offset);
		}
		offset += char.length;
	}
	return { normalized, sources };
}

/** Lowercase letters only, macrons spelled out ("kyō" → "kyou"). */
export const normalizeRomaji = (text: string) =>
	normalizeWithSources(text).normalized;

/** Splits romaji into morae: "kitto" → ki|t|to, "san" → sa|n. */
export const splitRomajiMorae = (romaji: string) =>
	romaji.match(
		/([bcdfghjklmpqrstvwxz])(?=\1)|[bcdfghjklmpqrstvwxz]*y?[aeiou]|n(?![aeiouy])|[a-z]/g,
	) ?? [];

const SOKUON = /[っッ]$/u;
const hasKanji = (text: string) => /[\p{Script=Han}々〆]/u.test(text);
const hasKana = (text: string) =>
	/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

const KANA_FIXES: Array<[RegExp, string]> = [
	[/fu([aieo])/g, "f$1"],
	[/vu([aieo])/g, "v$1"],
];

/** Accepted romaji spellings for a word, or undefined if it can't be read. */
function expectedReadings(word: string): string[] | undefined {
	const text = word.replace(/[\p{P}\p{S}\s]/gu, "");
	if (!text) return [];
	if (hasKanji(text)) return undefined;
	if (!hasKana(text)) {
		const latin = normalizeRomaji(text);
		return latin ? [latin] : [];
	}
	let reading = normalizeRomaji(wanakana.toRomaji(text));
	for (const [pattern, replacement] of KANA_FIXES) {
		reading = reading.replace(pattern, replacement);
	}
	// Long o and e are spelled both ways: コー "koo", ō "ou"; えい "ei", ē "ee".
	const readings = [
		reading,
		reading.replace(/oo/g, "ou"),
		reading.replace(/ou/g, "oo"),
		reading.replace(/ei/g, "ee"),
		reading.replace(/ee/g, "ei"),
	];
	if (text === "は") readings.push("wa");
	if (text === "へ") readings.push("e");
	if (text === "を") readings.push("o");
	return readings.filter(Boolean);
}

/** Shares a romaji run between words by mora, front-loaded, as lengths. */
function distribute(run: string, count: number): number[] {
	if (count === 1) return [run.length];
	const morae = splitRomajiMorae(run);
	return Array.from({ length: count }, (_, index) => {
		const start = Math.round((morae.length * index) / count);
		const end = Math.round((morae.length * (index + 1)) / count);
		return morae.slice(start, end).join("").length;
	});
}

/**
 * Cuts the original line at the normalized ranges, so capitals, macrons and
 * apostrophes survive. Each word runs to the start of the next one; the
 * punctuation at its edges is dropped, and a space after it becomes a
 * trailing space, which is how a word gap is stored.
 */
function sliceOriginal(
	original: string,
	sources: number[],
	ranges: Array<[number, number] | undefined>,
): string[] {
	const starts = ranges.map((range) =>
		range && range[1] > range[0] ? sources[range[0]] : undefined,
	);
	return starts.map((start, index) => {
		if (start === undefined) return "";
		const next = starts.slice(index + 1).find((value) => value !== undefined);
		const span = original.slice(start, next ?? original.length);
		const match = span.match(/^(.*?[\p{L}\p{M}])([^\p{L}\p{M}]*)$/su);
		if (!match) return "";
		const gap = next !== undefined && /\s/u.test(match[2]);
		return gap ? `${match[1]} ` : match[1];
	});
}

/** Splits one line's romaji across its words. */
export function alignLineWords(
	words: LyricWord[],
	romanizedLine: string,
): { romanWords: string[]; uncertain: boolean } {
	const { normalized: stream, sources } = normalizeWithSources(romanizedLine);
	const ranges: Array<[number, number] | undefined> = words.map(
		() => undefined,
	);
	let uncertain = false;
	let position = 0;
	let pending: number[] = [];

	/** Lengths of the run's space-separated chunks on the page. */
	const spacedChunks = (start: number, end: number) => {
		const cuts = [start];
		for (let at = start + 1; at < end; at++) {
			const between = romanizedLine.slice(sources[at - 1] + 1, sources[at]);
			if (/\s/u.test(between)) cuts.push(at);
		}
		cuts.push(end);
		return cuts.slice(1).map((cut, index) => cut - cuts[index]);
	};

	const flush = (end: number) => {
		if (pending.length === 0) return;
		const chunks = spacedChunks(position, end);
		const shares =
			chunks.length === pending.length
				? chunks
				: distribute(stream.slice(position, end), pending.length);
		let start = position;
		pending.forEach((wordIndex, shareIndex) => {
			ranges[wordIndex] = [start, start + shares[shareIndex]];
			start += shares[shareIndex];
		});
		const guessed = pending.length > 1 && chunks.length !== pending.length;
		if (guessed || shares.some((share) => !share)) uncertain = true;
		pending = [];
		position = end;
	};

	words.forEach((word, wordIndex) => {
		const readings = expectedReadings(word.word);
		if (readings && readings.length === 0) return;
		if (!readings) {
			pending.push(wordIndex);
			return;
		}
		const searchFrom = position + pending.length;
		let found: { at: number; length: number } | undefined;
		for (let at = searchFrom; at < stream.length && !found; at++) {
			if (pending.length === 0 && at > position) break;
			const reading = readings.find((candidate) =>
				stream.startsWith(candidate, at),
			);
			if (reading) found = { at, length: reading.length };
		}
		if (!found) {
			pending.push(wordIndex);
			uncertain = true;
			return;
		}
		flush(found.at);
		let end = found.at + found.length;
		// A word ending in っ takes the doubled consonant: "いっ" + "sho" → "is".
		if (
			SOKUON.test(word.word.trim()) &&
			/[bcdfghjkmpqrstvwxz]/.test(stream[end] ?? "") &&
			(stream[end] === stream[end + 1] || stream.startsWith("tch", end))
		) {
			end++;
		}
		ranges[wordIndex] = [found.at, end];
		position = end;
	});

	if (pending.length > 0) flush(stream.length);
	else if (position < stream.length) uncertain = true;
	return {
		romanWords: sliceOriginal(romanizedLine, sources, ranges),
		uncertain,
	};
}

/** Lines of a pasted page, without blank lines and [Section] headers. */
export const parseRomanizedPage = (text: string) =>
	text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !/^\[.*\]$/.test(line));

/** The lines a pasted page is matched against: main lines with text. */
export const alignableLines = (lines: LyricLine[]) =>
	lines.filter(
		(line) => !line.isBG && line.words.some((word) => word.word.trim()),
	);

export function alignRomanizedPage(
	lines: LyricLine[],
	pastedText: string,
): RomanizedAlignment {
	const targets = alignableLines(lines);
	const romanized = parseRomanizedPage(pastedText);
	if (targets.length !== romanized.length) {
		return {
			ok: false,
			reason: "line-count",
			expected: targets.length,
			received: romanized.length,
		};
	}
	const displayNumbers = getLineDisplayNumbers(lines);
	const numberById = new Map(
		lines.map((line, index) => [line.id, displayNumbers[index]]),
	);
	return {
		ok: true,
		lines: targets.map((line, index) => {
			const { romanWords, uncertain } = alignLineWords(
				line.words,
				romanized[index],
			);
			return {
				lineId: line.id,
				lineNumber: numberById.get(line.id) ?? index + 1,
				romanWords: Object.fromEntries(
					line.words.map((word, wordIndex) => [word.id, romanWords[wordIndex]]),
				),
				uncertain,
			};
		}),
	};
}
