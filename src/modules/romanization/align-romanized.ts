import * as wanakana from "wanakana";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import { getSectionHeader } from "$/modules/lyric-editor/utils/section-system";
import type { LyricLine, LyricSection, LyricWord } from "$/types/ttml";

/**
 * Aligns a pasted romanized lyric page (such as Genius's "Romanized" page) to
 * the Japanese lines: sections are matched by their headers, lines one to one
 * inside them, then each word takes its share of the line's romaji. Kana and
 * Latin words are matched by their own reading; kanji in between share what's
 * left, split by mora. A line's (parentheses) go to its background line.
 */

export interface AlignedLine {
	lineId: string;
	/** The line's number as the editor shows it. */
	lineNumber: number;
	romanWords: Record<string, string>;
	/** True when some word's share was guessed (kanji runs, or no match). */
	uncertain: boolean;
}

/** A section whose line count differs from the page's, so it was left out. */
export interface SkippedSection {
	label: string;
	lineNumber: number;
	expected: number;
	received: number;
}

export type RomanizedAlignment =
	| { ok: true; lines: AlignedLine[]; skipped: SkippedSection[] }
	| {
			ok: false;
			reason: "line-count";
			expected: number;
			received: number;
			/** The editor line where the page first stops lining up, if known. */
			firstDifference?: { label?: string; lineNumber: number };
	  };

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
		/([bcdfghjklmpqrstvwxz])(?=\1)|(?:[bcdfghjklmpqrstvwxz]+|n)?y?[aeiou]|[a-z]/g,
	) ?? [];

// Cyrillic and Greek letters that look Latin. Some pages slip them into
// romaji ("koе" with a Cyrillic е), which would otherwise break matching and
// end up in the lyrics.
const LOOKALIKES: Record<string, string> = {
	а: "a",
	е: "e",
	о: "o",
	р: "p",
	с: "c",
	у: "y",
	х: "x",
	і: "i",
	ј: "j",
	ѕ: "s",
	һ: "h",
	ԁ: "d",
	ԛ: "q",
	ԝ: "w",
	А: "A",
	В: "B",
	Е: "E",
	К: "K",
	М: "M",
	Н: "H",
	О: "O",
	Р: "P",
	С: "C",
	Т: "T",
	Х: "X",
	У: "Y",
	І: "I",
	Ј: "J",
	Ѕ: "S",
	ο: "o",
	Α: "A",
	Β: "B",
	Ε: "E",
	Ζ: "Z",
	Η: "H",
	Ι: "I",
	Κ: "K",
	Μ: "M",
	Ν: "N",
	Ο: "O",
	Ρ: "P",
	Τ: "T",
	Χ: "X",
	Υ: "Y",
};
const LATIN = /\p{Script=Latin}/u;

/**
 * Cleans a pasted line: compatibility forms folded, invisible characters
 * removed, and look-alike letters next to Latin ones turned Latin.
 */
export function cleanPastedLine(text: string) {
	const chars = [...text.normalize("NFKC").replace(/[​-‍⁠﻿]/g, "")];
	return chars
		.map((char, index) => {
			const latin = LOOKALIKES[char];
			if (!latin) return char;
			const near = [chars[index - 1], chars[index + 1]];
			return near.some((other) => other && LATIN.test(other)) ? latin : char;
		})
		.join("");
}

const SOKUON = /[っッ]$/u;
const SOKUON_ONLY = /^[っッ]$/u;
const hasKanji = (text: string) => /[\p{Script=Han}々〆]/u.test(text);
const hasKana = (text: string) =>
	/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

const KANA_FIXES: Array<[RegExp, string]> = [
	[/fu([aieo])/g, "f$1"],
	[/vu([aieo])/g, "v$1"],
];

/** Accepted romaji spellings for a word, or undefined if it can't be read. */
function expectedReadings(word: string): string[] | undefined {
	const text = word.normalize("NFKC").replace(/[\p{P}\p{S}\s]/gu, "");
	if (!text) return [];
	if (hasKanji(text)) return undefined;
	if (!hasKana(text)) {
		const latin = normalizeRomaji(text);
		return latin ? [latin] : [];
	}
	const romaji = wanakana.toRomaji(text);
	// ー lengthens the vowel before it: へー "hee". Pages often leave it out.
	const long = normalizeRomaji(romaji.replace(/([aeiou])[-ー]/g, "$1$1"));
	const short = normalizeRomaji(romaji);
	const readings = [long, short].flatMap((value) => {
		let reading = value;
		for (const [pattern, replacement] of KANA_FIXES) {
			reading = reading.replace(pattern, replacement);
		}
		// Long o and e are spelled both ways: コー "koo", ō "ou"; えい "ei", ē "ee".
		// っち is "tchi" or "cchi".
		return [
			reading,
			reading.replace(/tch/g, "cch"),
			reading.replace(/oo/g, "ou"),
			reading.replace(/ou/g, "oo"),
			reading.replace(/ei/g, "ee"),
			reading.replace(/ee/g, "ei"),
		];
	});
	if (text === "は") readings.push("wa");
	if (text === "へ") readings.push("e");
	if (text === "を") readings.push("o");
	return [...new Set(readings.filter(Boolean))];
}

/**
 * Sounds as kanji take them: a long vowel, a trailing i or u, n, or the first
 * half of a doubled consonant stays with the sound before it, so 支配 "shihai"
 * is shi|hai, 東京 "toukyou" tou|kyou and 一歩 "ippo" ip|po.
 */
const kanjiMorae = (romaji: string) =>
	splitRomajiMorae(romaji).reduce<string[]>((morae, mora) => {
		const previous = morae[morae.length - 1];
		const vowel = previous?.slice(-1) ?? "";
		const joins =
			/[aeiou]/.test(vowel) &&
			(/^[iun]$/.test(mora) ||
				mora === vowel ||
				/^[bcdfghjkmpqrstvwxz]$/.test(mora));
		if (previous && joins) morae[morae.length - 1] = previous + mora;
		else morae.push(mora);
		return morae;
	}, []);

/** Shares a romaji run between kanji words by mora, front-loaded, as lengths. */
function distribute(run: string, count: number): number[] {
	if (count === 1) return [run.length];
	const morae = kanjiMorae(run);
	return Array.from({ length: count }, (_, index) => {
		const start = Math.round((morae.length * index) / count);
		const end = Math.round((morae.length * (index + 1)) / count);
		return morae.slice(start, end).join("").length;
	});
}

/**
 * Shares a run of romaji between consecutive kanji words. A share never
 * crosses a space on the page: each spaced chunk gets at least one kanji, and
 * the rest go where there are the most sounds per kanji. Inside a chunk the
 * split is by sound. An uneven split (支配 as "shi|hai" or "shiha|i") is a
 * guess worth checking; an even one (無駄 "mu|da") is usually right.
 */
function shareKanjiRun(run: string, chunks: number[], count: number) {
	if (chunks.length === count) return { shares: chunks, guessed: false };
	if (chunks.length > count)
		return {
			shares: distribute(run, count),
			guessed: kanjiMorae(run).length % count !== 0,
		};
	const texts: string[] = [];
	let offset = 0;
	for (const chunk of chunks) {
		texts.push(run.slice(offset, offset + chunk));
		offset += chunk;
	}
	const sounds = texts.map((text) => kanjiMorae(text).length);
	const given = chunks.map(() => 1);
	for (let left = count - chunks.length; left > 0; left--) {
		let pick = 0;
		given.forEach((kanji, index) => {
			if (sounds[index] / kanji > sounds[pick] / given[pick]) pick = index;
		});
		given[pick]++;
	}
	return {
		shares: texts.flatMap((text, index) => distribute(text, given[index])),
		guessed: sounds.some((count, index) => count % given[index] !== 0),
	};
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

type Token =
	| { kind: "word"; index: number; readings: string[]; sokuon: boolean }
	| { kind: "kanji"; indices: number[] };

type Step =
	| { kind: "match"; start: number; end: number; skipped: number }
	| { kind: "guess"; start: number; end: number };

// How a line's words are fitted to its romaji: every way is scored and the
// best one wins, so one early match can't throw off the rest of the line.
const SCORE = {
	match: 4,
	/** A word that starts or ends where the page has a space or punctuation. */
	edge: 1,
	skippedLetter: -2,
	unmatched: -3,
	missing: -6,
	leftoverLetter: -1,
};
const MAX_SKIP = 4;
const CONSONANT = /[bcdfghjkmpqrstvwxz]/;

/** Splits one line's romaji across its words. */
export function alignLineWords(
	words: LyricWord[],
	romanizedLine: string,
): { romanWords: string[]; uncertain: boolean } {
	const line = cleanPastedLine(romanizedLine);
	const { normalized: stream, sources } = normalizeWithSources(line);
	const length = stream.length;

	// Words with nothing to read (spaces, punctuation) get no romaji; runs of
	// kanji words share one stretch of the page between them.
	const tokens: Token[] = [];
	words.forEach((word, index) => {
		if (SOKUON_ONLY.test(word.word.trim())) {
			tokens.push({ kind: "word", index, readings: [], sokuon: true });
			return;
		}
		const readings = expectedReadings(word.word);
		if (readings && readings.length === 0) return;
		if (readings) {
			tokens.push({ kind: "word", index, readings, sokuon: false });
			return;
		}
		const last = tokens[tokens.length - 1];
		if (last?.kind === "kanji") last.indices.push(index);
		else tokens.push({ kind: "kanji", indices: [index] });
	});

	/** True where the page has a space or punctuation, or the line ends. */
	const isEdge = (at: number) =>
		at <= 0 ||
		at >= length ||
		/[^\p{L}\p{M}']/u.test(line.slice(sources[at - 1] + 1, sources[at]));
	const edge = (at: number) => (isEdge(at) ? SCORE.edge : 0);
	const vowels = (start: number, end: number) =>
		stream.slice(start, end).replace(/[^aeiou]/g, "").length;
	/** A doubled consonant starts here: "tte", "kko", or "tch". */
	const doubled = (at: number) =>
		CONSONANT.test(stream[at] ?? "") &&
		(stream[at] === stream[at + 1] || stream.startsWith("tch", at));

	type Best = { score: number; step?: Step; next: number };
	const memo = new Map<number, Best>();
	const best = (tokenIndex: number, position: number): Best => {
		const key = tokenIndex * (length + 1) + position;
		const cached = memo.get(key);
		if (cached) return cached;
		const token = tokens[tokenIndex];
		let result: Best = {
			score: token
				? Number.NEGATIVE_INFINITY
				: SCORE.leftoverLetter * (length - position),
			next: position,
		};
		const consider = (score: number, step: Step) => {
			const total = score + best(tokenIndex + 1, step.end).score;
			if (total > result.score) result = { score: total, step, next: step.end };
		};
		if (token?.kind === "word") {
			const word = words[token.index].word.trim();
			for (
				let skip = 0;
				skip <= MAX_SKIP && position + skip <= length;
				skip++
			) {
				const at = position + skip;
				const ends = token.readings
					.filter((reading) => stream.startsWith(reading, at))
					.map((reading) => {
						const end = at + reading.length;
						// A word ending in っ takes the doubled consonant: "いっ" + "sho" → "is".
						return SOKUON.test(word) && doubled(end) ? end + 1 : end;
					});
				// A lone っ is the doubled consonant itself: "っ" + "te" → "t".
				if (token.sokuon && doubled(at)) ends.push(at + 1);
				for (const end of ends)
					consider(
						SCORE.match + SCORE.skippedLetter * skip + edge(at) + edge(end),
						{ kind: "match", start: at, end, skipped: skip },
					);
			}
		}
		if (token) {
			const count = token.kind === "kanji" ? token.indices.length : 1;
			for (let end = position + 1; end <= length; end++) {
				if (vowels(position, end) < count) continue;
				consider((token.kind === "word" ? SCORE.unmatched : 0) + edge(end), {
					kind: "guess",
					start: position,
					end,
				});
			}
			consider(SCORE.missing * count, {
				kind: "guess",
				start: position,
				end: position,
			});
		}
		memo.set(key, result);
		return result;
	};

	const ranges: Array<[number, number] | undefined> = words.map(
		() => undefined,
	);
	let uncertain = false;
	/** Lengths of a stretch's space-separated chunks on the page. */
	const spacedChunks = (start: number, end: number) => {
		const cuts = [start];
		for (let at = start + 1; at < end; at++) {
			const between = line.slice(sources[at - 1] + 1, sources[at]);
			if (/\s/u.test(between)) cuts.push(at);
		}
		cuts.push(end);
		return cuts.slice(1).map((cut, index) => cut - cuts[index]);
	};

	let position = 0;
	tokens.forEach((token, tokenIndex) => {
		const { step, next } = best(tokenIndex, position);
		position = next;
		if (!step) return;
		if (token.kind === "word") {
			ranges[token.index] = [step.start, step.end];
			if (step.kind === "guess" || step.skipped > 0) uncertain = true;
			return;
		}
		const { shares, guessed } = shareKanjiRun(
			stream.slice(step.start, step.end),
			spacedChunks(step.start, step.end),
			token.indices.length,
		);
		let start = step.start;
		token.indices.forEach((wordIndex, shareIndex) => {
			ranges[wordIndex] = [start, start + shares[shareIndex]];
			start += shares[shareIndex];
		});
		if (guessed || shares.some((share) => !share)) uncertain = true;
	});
	if (position < length) uncertain = true;

	return { romanWords: sliceOriginal(line, sources, ranges), uncertain };
}

export interface PageLine {
	main: string;
	/** What the page has in (parentheses), for the line's background vocals. */
	background: string;
}

export interface PageSection {
	/** The [Header] above these lines, if the page has one. */
	header?: string;
	lines: PageLine[];
}

/**
 * A pasted page's lines, grouped under its [Section] headers. Blank lines are
 * dropped, and (parentheses) move to the line's background; a line that is
 * only (parentheses) is background for the line before it.
 */
export function parseRomanizedPage(text: string): PageSection[] {
	const sections: PageSection[] = [{ lines: [] }];
	for (const raw of text.split(/\r?\n/)) {
		const row = cleanPastedLine(raw).trim();
		if (!row) continue;
		if (getSectionHeader(row)) {
			sections.push({ header: row.slice(1, -1).trim(), lines: [] });
			continue;
		}
		const background: string[] = [];
		const main = row
			.replace(/[(（]([^()（）]*)[)）]/g, (_, inner: string) => {
				if (inner.trim()) background.push(inner.trim());
				return " ";
			})
			.replace(/\s+/g, " ")
			.trim();
		const current = sections[sections.length - 1];
		const previous = current.lines[current.lines.length - 1];
		if (!main && previous) {
			previous.background = [previous.background, ...background]
				.filter(Boolean)
				.join(", ");
			continue;
		}
		current.lines.push({ main, background: background.join(", ") });
	}
	return sections.filter((section) => section.lines.length > 0);
}

/** The lines a pasted page is matched against: main lines with text. */
export const alignableLines = (lines: LyricLine[]) =>
	lines.filter(
		(line) => !line.isBG && line.words.some((word) => word.word.trim()),
	);

interface EditorSection {
	/** The section id, or a just-imported line's [Header] before it has one. */
	key?: string;
	lines: LyricLine[];
}

/** The editor's main lines, in runs that share a section. */
function editorSections(lines: LyricLine[]): EditorSection[] {
	const runs: EditorSection[] = [];
	for (const line of alignableLines(lines)) {
		const key = line.sectionId ?? line.geniusHeader;
		const last = runs[runs.length - 1];
		if (last && last.key === key) last.lines.push(line);
		else runs.push({ key, lines: [line] });
	}
	return runs;
}

export function alignRomanizedPage(
	lines: LyricLine[],
	pastedText: string,
	sections: LyricSection[] = [],
): RomanizedAlignment {
	const page = parseRomanizedPage(pastedText);
	const editor = editorSections(lines);
	const displayNumbers = getLineDisplayNumbers(lines);
	const numberById = new Map(
		lines.map((line, index) => [line.id, displayNumbers[index]]),
	);
	const backgroundOf = new Map<string, LyricLine>();
	lines.forEach((line, index) => {
		const next = lines[index + 1];
		if (!line.isBG && next?.isBG) backgroundOf.set(line.id, next);
	});
	const labelOf = (section: EditorSection) =>
		(sections.find(({ id }) => id === section.key)?.label ?? section.key)
			?.replace(/^\[|\]$/g, "")
			.trim();
	const numberOf = (line: LyricLine) => numberById.get(line.id) ?? 1;

	const alignPair = (line: LyricLine, pageLine: PageLine): AlignedLine[] => {
		const background = backgroundOf.get(line.id);
		const pairs: Array<[LyricLine, string]> = [[line, pageLine.main]];
		if (background && pageLine.background)
			pairs.push([background, pageLine.background]);
		return pairs.map(([target, romaji]) => {
			const { romanWords, uncertain } = alignLineWords(target.words, romaji);
			return {
				lineId: target.id,
				lineNumber: numberOf(line),
				romanWords: Object.fromEntries(
					target.words.map((word, index) => [word.id, romanWords[index]]),
				),
				uncertain,
			};
		});
	};

	// With headers on the page and sections in the lyrics, each section is
	// matched on its own, so an extra line only holds back its own section.
	const hasStructure =
		page.some((section) => section.header) &&
		editor.some((section) => section.key);
	if (hasStructure && page.length === editor.length) {
		const aligned: AlignedLine[] = [];
		const skipped: SkippedSection[] = [];
		editor.forEach((section, index) => {
			const pageLines = page[index].lines;
			if (pageLines.length !== section.lines.length) {
				skipped.push({
					label: labelOf(section) ?? page[index].header ?? "",
					lineNumber: numberOf(section.lines[0]),
					expected: section.lines.length,
					received: pageLines.length,
				});
				return;
			}
			section.lines.forEach((line, lineIndex) => {
				aligned.push(...alignPair(line, pageLines[lineIndex]));
			});
		});
		return { ok: true, lines: aligned, skipped };
	}

	const editorLines = editor.flatMap((section) => section.lines);
	const pageLines = page.flatMap((section) => section.lines);
	if (editorLines.length !== pageLines.length) {
		const drift = editor.findIndex(
			(section, index) => section.lines.length !== page[index]?.lines.length,
		);
		return {
			ok: false,
			reason: "line-count",
			expected: editorLines.length,
			received: pageLines.length,
			firstDifference:
				hasStructure && drift >= 0
					? {
							label: labelOf(editor[drift]),
							lineNumber: numberOf(editor[drift].lines[0]),
						}
					: undefined,
		};
	}
	return {
		ok: true,
		lines: editorLines.flatMap((line, index) =>
			alignPair(line, pageLines[index]),
		),
		skipped: [],
	};
}
