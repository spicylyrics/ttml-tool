import { Romanize as Hangul } from "hangul-romanize";
import * as wanakana from "wanakana";
import { getLineDisplayNumbers } from "$/modules/lyric-editor/utils/line-numbers";
import { getSectionHeader } from "$/modules/lyric-editor/utils/section-system";
import type { LyricLine, LyricWord } from "$/types/ttml";
import { isLatinOnly } from "./fill";

/**
 * Aligns a pasted romanized lyric page (such as Genius's "Romanized" page) to
 * the lyrics: the whole song's words are fitted to the page as one stream, so
 * the page may break its lines elsewhere, with its [Section] headers pulling
 * each section into place. Kana, Hangul and Latin words are matched by their
 * own reading; kanji in between share what's left, split by sound. A line's
 * (parentheses) go to its background line.
 */

export interface AlignedLine {
	lineId: string;
	/** The line's number as the editor shows it. */
	lineNumber: number;
	romanWords: Record<string, string>;
	/** True when some word's share was guessed (kanji runs, or no match). */
	uncertain: boolean;
	/** The line as the page writes it, spacing and punctuation included. */
	romanLine: string;
}

export type RomanizedAlignment =
	| { ok: true; lines: AlignedLine[] }
	| { ok: false; reason: "mismatch" };

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
	const chars = [
		...text.normalize("NFKC").replace(/[\u200B-\u200D\u2060\uFEFF]/g, ""),
	];
	const count = (script: RegExp) =>
		chars.filter((char) => script.test(char)).length;
	const mostlyLatin =
		count(LATIN) > 2 * count(/[\p{Script=Cyrillic}\p{Script=Greek}]/u);
	return chars
		.map((char, index) => {
			const latin = LOOKALIKES[char];
			if (!latin) return char;
			// On a line of romaji even a lone one goes ("Ashita е to" for へ).
			const near = [chars[index - 1], chars[index + 1]];
			return mostlyLatin || near.some((other) => other && LATIN.test(other))
				? latin
				: char;
		})
		.join("");
}

const HANGUL = /\p{Script=Hangul}/u;
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
	// Half-width katakana (ｿﾝ) reads like its full-width form.
	const text = word.normalize("NFKC").replace(/[\p{P}\p{S}\s]/gu, "");
	if (!text) return [];
	if (hasKanji(text)) return undefined;
	if (HANGUL.test(text)) {
		const reading = normalizeRomaji(Hangul.from(text));
		return reading ? [reading] : undefined;
	}
	if (!hasKana(text)) {
		// Other scripts can't be read here; they take what's between.
		if (/(?=\p{L})[^\p{Script=Latin}\p{Script=Common}]/u.test(text))
			return undefined;
		const latin = normalizeRomaji(text);
		return latin ? [latin] : [];
	}
	// づ and ぢ are "zu" and "ji", or "dzu"/"du" and "dji"/"di" on some pages.
	const romajis = [wanakana.toRomaji(text)];
	if (/[づヅぢヂ]/u.test(text))
		romajis.push(
			wanakana.toRomaji(text, {
				customRomajiMapping: { づ: "dzu", ぢ: "dji" },
			}),
			wanakana.toRomaji(text, { customRomajiMapping: { づ: "du", ぢ: "di" } }),
		);
	// ー lengthens the vowel before it: へー "hee". Pages often leave it out.
	const spellings = romajis.flatMap((romaji) => [
		normalizeRomaji(romaji.replace(/([aeiou])[-ー]/g, "$1$1")),
		normalizeRomaji(romaji),
	]);
	const readings = spellings.flatMap((value) => {
		let reading = value;
		for (const [pattern, replacement] of KANA_FIXES) {
			reading = reading.replace(pattern, replacement);
		}
		// Long o and e are spelled both ways: コー "koo", ō "ou"; えい "ei", ē "ee".
		// っち is "tchi" or "cchi"; ヴァ is "va" or "ba".
		return [
			reading,
			reading.replace(/tch/g, "cch"),
			reading.replace(/v/g, "b"),
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

/**
 * The sounds a run is shared by: as kanji take them, or plain morae when that
 * leaves a kanji with none (不甲斐 "fugai" is fu|ga|i, not fu||gai).
 */
const shareMorae = (romaji: string, count: number) => {
	const morae = kanjiMorae(romaji);
	return morae.length < count ? splitRomajiMorae(romaji) : morae;
};

/** Shares a romaji run between kanji words by mora, front-loaded, as lengths. */
function distribute(run: string, count: number): number[] {
	if (count === 1) return [run.length];
	const morae = shareMorae(run, count);
	return Array.from({ length: count }, (_, index) => {
		const start = Math.round((morae.length * index) / count);
		const end = Math.round((morae.length * (index + 1)) / count);
		return morae.slice(start, end).join("").length;
	});
}

/** How many letters to add, drop or change to turn one text into the other. */
function editDistance(a: string, b: string) {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++)
			current[j] = Math.min(
				previous[j] + 1,
				current[j - 1] + 1,
				previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		previous = current;
	}
	return previous[b.length];
}

/**
 * Shares a run of romaji between kanji words by each one's reading from the
 * dictionary: the run is cut between sounds where the pieces come closest to
 * those readings, so ご機嫌伺い's "kigenukaga" is ki|gen|ukaga and 痛々
 * "itaita" ita|ita. Cuts never fall inside a sound, and a space on the page
 * always ends a share. Returns undefined when a word has no reading.
 */
function shareByHints(run: string, chunks: number[], hints: string[]) {
	const count = hints.length;
	if (hints.some((hint) => !hint)) return undefined;
	const spaces = new Set<number>();
	if (chunks.length <= count) {
		let offset = 0;
		for (const chunk of chunks.slice(0, -1)) {
			offset += chunk;
			spaces.add(offset);
		}
	}
	// Between sounds, after any n too ("kigen|ukaga" splits like "ge|nu"
	// otherwise), and at the page's spaces.
	const between = new Set([0, run.length, ...spaces]);
	let offset = 0;
	for (const mora of splitRomajiMorae(run)) {
		offset += mora.length;
		between.add(offset);
	}
	for (let at = 1; at < run.length; at++)
		if (run[at - 1] === "n") between.add(at);
	const cuts = [...between].sort((a, b) => a - b);
	if (cuts.length - 1 < count) return undefined;
	const crossesSpace = (from: number, to: number) =>
		[...spaces].some((space) => space > from && space < to);
	// best[word][cut]: the closest fit of the first `word` words ending at `cut`.
	const best = Array.from({ length: count + 1 }, () =>
		cuts.map(() => Number.POSITIVE_INFINITY),
	);
	const from = Array.from({ length: count + 1 }, () => cuts.map(() => 0));
	best[0][0] = 0;
	for (let word = 1; word <= count; word++)
		for (let end = word; end < cuts.length; end++)
			for (let start = word - 1; start < end; start++) {
				if (!Number.isFinite(best[word - 1][start])) continue;
				if (crossesSpace(cuts[start], cuts[end])) continue;
				const cost =
					best[word - 1][start] +
					editDistance(run.slice(cuts[start], cuts[end]), hints[word - 1]);
				if (cost < best[word][end]) {
					best[word][end] = cost;
					from[word][end] = start;
				}
			}
	const last = cuts.length - 1;
	if (!Number.isFinite(best[count][last])) return undefined;
	const shares: number[] = [];
	for (let word = count, end = last; word > 0; word--) {
		const start = from[word][end];
		shares.unshift(cuts[end] - cuts[start]);
		end = start;
	}
	return { shares, guessed: best[count][last] > 0 };
}

/**
 * Shares a run of romaji between consecutive kanji words. A share never
 * crosses a space on the page: each spaced chunk gets at least one kanji, and
 * the rest go where there are the most sounds per kanji. Inside a chunk the
 * split is by sound. An uneven split (支配 as "shi|hai" or "shiha|i") is a
 * guess worth checking; an even one (無駄 "mu|da") is usually right.
 */
function shareKanjiRun(
	run: string,
	chunks: number[],
	count: number,
	hints?: string[],
) {
	if (chunks.length === count) return { shares: chunks, guessed: false };
	const hinted = hints && shareByHints(run, chunks, hints);
	if (hinted) return hinted;
	if (chunks.length > count)
		return {
			shares: distribute(run, count),
			guessed: shareMorae(run, count).length % count !== 0,
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
		// The most sounds per kanji, then the most letters: 朝目覚 "asa meza"
		// is asa|me|za.
		const weight = (index: number) =>
			sounds[index] / given[index] + chunks[index] / given[index] / 100;
		given.forEach((_, index) => {
			if (weight(index) > weight(pick)) pick = index;
		});
		given[pick]++;
	}
	return {
		shares: texts.flatMap((text, index) => distribute(text, given[index])),
		guessed: sounds.some((count, index) => count % given[index] !== 0),
	};
}

/**
 * Cuts the original text at the normalized ranges, so capitals, macrons,
 * apostrophes and punctuation survive the way the page writes them: a word
 * takes the punctuation right before it ("Oi,) and right after it (no?"), and
 * a space after it becomes a trailing space, which is how a word gap is
 * stored. A lone "n" the page sets apart (yatte n no) stays in its word.
 */
function sliceOriginal(
	original: string,
	sources: number[],
	ranges: Array<[number, number] | undefined>,
): {
	romanWords: string[];
	spans: Array<[number, number] | undefined>;
} {
	const filled = ranges.flatMap((range, index) =>
		range && range[1] > range[0] ? [index] : [],
	);
	/** Where a word's last letter ends in the original text. */
	const letterEnd = (index: number) => {
		const last = sources[(ranges[index] as [number, number])[1] - 1];
		return last + ((original.codePointAt(last) ?? 0) > 0xffff ? 2 : 1);
	};
	const firstLetter = (index: number) =>
		sources[(ranges[index] as [number, number])[0]];
	const romanWords = ranges.map(() => "");
	/** Where each word's text sits in the original, punctuation included. */
	const spans: Array<[number, number] | undefined> = ranges.map(
		() => undefined,
	);
	filled.forEach((index, order) => {
		const previous = filled[order - 1];
		const next = filled[order + 1];
		const before = original.slice(
			previous === undefined ? 0 : letterEnd(previous),
			firstLetter(index),
		);
		const after = original.slice(
			letterEnd(index),
			next === undefined ? original.length : firstLetter(next),
		);
		// Punctuation between two words with no space goes to the first.
		const lead =
			previous === undefined || /\s/u.test(before)
				? (before.match(/[^\s\p{L}\p{M}]*$/u)?.[0] ?? "")
				: "";
		const trail = after.match(/^[^\s\p{L}\p{M}]*/u)?.[0] ?? "";
		const core = original
			.slice(firstLetter(index), letterEnd(index))
			.replace(/\s+(?=n(?![\p{L}\p{M}]))/giu, "");
		const gap = next !== undefined && /\s/u.test(after);
		romanWords[index] = `${lead}${core}${trail}${gap ? " " : ""}`;
		spans[index] = [
			firstLetter(index) - lead.length,
			letterEnd(index) + trail.length,
		];
	});
	return { romanWords, spans };
}

/** Kana at the start and end of a kanji word, which its romaji must show. */
function kanaEdges(word: string) {
	const text = word.normalize("NFKC").replace(/[\p{P}\p{S}\s]/gu, "");
	const kana = "[\\p{Script=Hiragana}\\p{Script=Katakana}ー]+";
	const head = text.match(new RegExp(`^${kana}`, "u"))?.[0];
	const tail = text.match(new RegExp(`${kana}$`, "u"))?.[0];
	const prefix = head ? expectedReadings(head) : undefined;
	const suffix = tail && tail !== text ? expectedReadings(tail) : undefined;
	const kanji = [...text].filter((char) => hasKanji(char)).length;
	const other =
		[...text].length -
		kanji -
		[...(head ?? "")].length -
		(tail && tail !== text ? [...tail].length : 0);
	return {
		prefix: prefix?.length ? prefix : undefined,
		suffix: suffix?.length ? suffix : undefined,
		/** About how many letters it should take. */
		size:
			KANJI_LETTERS * kanji +
			2 * Math.max(0, other) +
			(prefix?.[0]?.length ?? 0) +
			(suffix?.[0]?.length ?? 0),
	};
}

type Token =
	| {
			kind: "word";
			index: number;
			readings: string[];
			sokuon: boolean;
			/** How long a guess for it should be: its reading's length. */
			size: number;
	  }
	| {
			kind: "kanji";
			indices: number[];
			size: number;
			/** Readings its romaji must start or end with, from its kana. */
			prefix?: string[];
			suffix?: string[];
	  };

type Step =
	| { kind: "match"; start: number; end: number; skipped: number }
	| { kind: "guess"; start: number; end: number; offEdge: boolean }
	/** Skips the rest of a page line that has nothing in the lyrics. */
	| { kind: "jump"; start: number; end: number };

// How words are fitted to romaji: every way is scored and the best one wins,
// so one early match can't throw off the rest.
const SCORE = {
	match: 4,
	/** A word that starts or ends where the page has a space or punctuation. */
	edge: 1,
	/** A section's first word starting at the same section on the page. */
	anchor: 3,
	skippedLetter: -2,
	unmatched: -3,
	/** Per letter a guess is longer or shorter than the word's reading. */
	sizeOff: -0.3,
	/** The same for kanji, whose readings vary more. */
	kanjiSizeOff: -0.15,
	/** A kanji word whose romaji doesn't show its kana. */
	kanaOff: -4,
	missing: -6,
	skippedLine: -3,
	crossedLine: -4,
	leftoverLetter: -1,
};
/** About how many letters a kanji takes: "ki", "kokoro", "shou". */
const KANJI_LETTERS = 3.2;
const MAX_SKIP = 4;
const CONSONANT = /[bcdfghjkmpqrstvwxz]/;

/**
 * Fits words, in order, to a stretch of romaji that may span many page lines.
 * `anchors` pair a word that starts a section with where that section starts
 * in the romaji. `hints` are each word's reading from the dictionary, which
 * place the cuts in a run of kanji. Returns each word's romaji and whether it
 * was guessed.
 */
function fitWords(
	words: LyricWord[],
	romaji: string,
	anchors: Array<{ word: number; offset: number }> = [],
	hints?: readonly string[],
) {
	const line = cleanPastedLine(romaji);
	const { normalized: stream, sources } = normalizeWithSources(line);
	const length = stream.length;

	// Words with nothing to read (spaces, punctuation) get no romaji; runs of
	// kanji words share one stretch of the page between them, unless their
	// kana pins where they end.
	const tokens: Token[] = [];
	words.forEach((word, index) => {
		if (SOKUON_ONLY.test(word.word.trim())) {
			tokens.push({ kind: "word", index, readings: [], sokuon: true, size: 1 });
			return;
		}
		const readings = expectedReadings(word.word);
		if (readings && readings.length === 0) return;
		if (readings) {
			const size = readings[0].length;
			tokens.push({ kind: "word", index, readings, sokuon: false, size });
			return;
		}
		const edges = kanaEdges(word.word);
		const last = tokens[tokens.length - 1];
		// A comma or space after the previous kanji word ends its run too.
		const previous =
			last?.kind === "kanji"
				? words[last.indices[last.indices.length - 1]].word
				: "";
		if (
			last?.kind === "kanji" &&
			!last.suffix &&
			!edges.prefix &&
			!/[\p{P}\s]$/u.test(previous)
		) {
			last.indices.push(index);
			last.size += edges.size;
			last.suffix = edges.suffix;
		} else tokens.push({ kind: "kanji", indices: [index], ...edges });
	});

	/** True where the page has a space, punctuation or a line break. */
	const between = (at: number) => line.slice(sources[at - 1] + 1, sources[at]);
	const isEdge = (at: number) =>
		at <= 0 || at >= length || /[^\p{L}\p{M}']/u.test(between(at));
	const edge = (at: number) => (isEdge(at) ? SCORE.edge : 0);
	const lineStarts: number[] = [];
	/** How many page lines start at or before each letter. */
	const lineOf = new Int32Array(length + 1);
	for (let at = 1; at < length; at++) {
		const starts = between(at).includes("\n");
		if (starts) lineStarts.push(at);
		lineOf[at] = lineOf[at - 1] + (starts ? 1 : 0);
	}
	const nextLineStart = (at: number) => lineStarts.find((start) => start > at);
	const vowelsBefore = new Int32Array(length + 1);
	for (let at = 0; at < length; at++)
		vowelsBefore[at + 1] =
			vowelsBefore[at] + (/[aeiou]/.test(stream[at]) ? 1 : 0);
	/** A doubled consonant starts here: "tte", "kko", or "tch". */
	const doubled = (at: number) =>
		CONSONANT.test(stream[at] ?? "") &&
		(stream[at] === stream[at + 1] || stream.startsWith("tch", at));

	const anchorOf = new Map<number, number>();
	for (const anchor of anchors) {
		const tokenIndex = tokens.findIndex((token) =>
			token.kind === "word"
				? token.index >= anchor.word
				: token.indices[token.indices.length - 1] >= anchor.word,
		);
		const at = sources.findIndex((source) => source >= anchor.offset);
		if (tokenIndex >= 0 && at >= 0) anchorOf.set(tokenIndex, at);
	}
	// On a long page, a word only looks near where its share of the page would
	// put it, which keeps whole songs quick.
	const expectedAt = new Float64Array(tokens.length + 1);
	tokens.forEach((token, index) => {
		expectedAt[index + 1] = expectedAt[index] + token.size;
	});
	const scale = length / Math.max(1, expectedAt[tokens.length]);
	const band = length > 400 ? Math.max(150, length * 0.15) : Infinity;

	type Best = { score: number; step?: Step };
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
		};
		if (token && Math.abs(position - expectedAt[tokenIndex] * scale) > band) {
			memo.set(key, result);
			return result;
		}
		const anchor = anchorOf.get(tokenIndex);
		const anchored = (start: number) =>
			anchor !== undefined && start === anchor ? SCORE.anchor : 0;
		const consider = (score: number, step: Step) => {
			const next =
				step.kind === "jump"
					? best(tokenIndex, step.end)
					: best(tokenIndex + 1, step.end);
			const total = score + next.score;
			if (total > result.score) result = { score: total, step };
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
				for (const end of new Set(ends))
					consider(
						SCORE.match +
							SCORE.skippedLetter * skip +
							edge(at) +
							edge(end) +
							anchored(at),
						{ kind: "match", start: at, end, skipped: skip },
					);
			}
		}
		if (token) {
			const count = token.kind === "kanji" ? token.indices.length : 1;
			const limit = Math.min(
				length,
				position + Math.ceil(token.size * 2.5) + 6,
			);
			const startsWith = (readings: string[] | undefined) =>
				!readings ||
				readings.some((reading) => stream.startsWith(reading, position));
			const endsWith = (readings: string[] | undefined, end: number) =>
				!readings ||
				readings.some(
					(reading) =>
						end - reading.length >= position &&
						stream.startsWith(reading, end - reading.length),
				);
			for (let end = position + 1; end <= limit; end++) {
				if (vowelsBefore[end] - vowelsBefore[position] < count) continue;
				let score: number;
				let offEdge = false;
				if (token.kind === "word") {
					score =
						SCORE.unmatched +
						SCORE.sizeOff * Math.abs(end - position - token.size);
				} else {
					offEdge = !startsWith(token.prefix) || !endsWith(token.suffix, end);
					score =
						SCORE.kanjiSizeOff * Math.abs(end - position - token.size) +
						(offEdge ? SCORE.kanaOff : 0);
				}
				// One word rarely runs over a page line break; several can.
				const crossed = lineOf[end - 1] - lineOf[position];
				score += SCORE.crossedLine * Math.max(0, crossed - (count - 1));
				consider(score + edge(end) + anchored(position), {
					kind: "guess",
					start: position,
					end,
					offEdge,
				});
			}
			consider(SCORE.missing * count, {
				kind: "guess",
				start: position,
				end: position,
				offEdge: true,
			});
			const lineStart = nextLineStart(position);
			if (lineStart !== undefined)
				consider(SCORE.skippedLine, {
					kind: "jump",
					start: position,
					end: lineStart,
				});
		}
		memo.set(key, result);
		return result;
	};

	const ranges: Array<[number, number] | undefined> = words.map(
		() => undefined,
	);
	const guessed = words.map(() => false);
	/** Lengths of a stretch's space-separated chunks on the page. */
	const spacedChunks = (start: number, end: number) => {
		const cuts = [start];
		for (let at = start + 1; at < end; at++)
			if (/\s/u.test(between(at))) cuts.push(at);
		cuts.push(end);
		return cuts.slice(1).map((cut, index) => cut - cuts[index]);
	};

	let position = 0;
	let tokenIndex = 0;
	let matched = 0;
	while (tokenIndex < tokens.length) {
		const { step } = best(tokenIndex, position);
		if (!step) break;
		position = step.end;
		if (step.kind === "jump") continue;
		const token = tokens[tokenIndex++];
		if (token.kind === "word") {
			ranges[token.index] = [step.start, step.end];
			// A word spelled its own way ("ireoke" for 이렇게) but sitting alone
			// between spaces, at about its length, is not much of a guess.
			const ownChunk =
				step.kind === "guess" &&
				isEdge(step.start) &&
				isEdge(step.end) &&
				Math.abs(step.end - step.start - token.size) <=
					Math.max(2, token.size / 2);
			if (step.kind === "match" ? step.skipped > 0 : !ownChunk)
				guessed[token.index] = true;
			if (step.kind === "match" && !step.skipped) matched++;
			continue;
		}
		const run = shareKanjiRun(
			stream.slice(step.start, step.end),
			spacedChunks(step.start, step.end),
			token.indices.length,
			hints &&
				token.indices.map((index) => normalizeRomaji(hints[index] ?? "")),
		);
		let start = step.start;
		token.indices.forEach((wordIndex, shareIndex) => {
			const share = run.shares[shareIndex];
			ranges[wordIndex] = [start, start + share];
			start += share;
			if (run.guessed || !share || (step.kind === "guess" && step.offEdge))
				guessed[wordIndex] = true;
		});
	}
	// Romaji left over at the end goes unused, so the last word is a guess.
	const last = tokens[tokens.length - 1];
	if (last && position < length)
		for (const index of last.kind === "word" ? [last.index] : last.indices)
			guessed[index] = true;

	const { romanWords, spans } = sliceOriginal(line, sources, ranges);
	return {
		romanWords,
		guessed,
		/**
		 * The page's own text from the first to the last of these words, as it
		 * writes it ("nukashite nda ka?"), however the words split it.
		 */
		pageText: (from: number, to: number) => {
			const covered = spans.slice(from, to).filter((span) => !!span);
			if (covered.length === 0) return "";
			return line
				.slice(covered[0][0], covered[covered.length - 1][1])
				.replace(/\s+/g, " ")
				.trim();
		},
		/** Words that can be read (kana, Hangul, Latin), and how many matched exactly. */
		readable: tokens.filter((token) => token.kind === "word").length,
		matched,
	};
}

/**
 * Splits one line's romaji across its words. `hints` are the words' readings
 * from the dictionary, when it's loaded.
 */
export function alignLineWords(
	words: LyricWord[],
	romanizedLine: string,
	hints?: readonly string[],
): { romanWords: string[]; uncertain: boolean } {
	const { romanWords, guessed } = fitWords(words, romanizedLine, [], hints);
	return { romanWords, uncertain: guessed.some(Boolean) };
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

/**
 * `readingsOf` gives a line's word readings from the dictionary, when it's
 * loaded, to place the cuts in runs of kanji.
 */
export function alignRomanizedPage(
	lines: LyricLine[],
	pastedText: string,
	readingsOf?: (line: LyricLine) => readonly string[] | undefined,
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

	let readable = 0;
	let matched = 0;
	/**
	 * Fits lines to the page as one stream, so it doesn't matter where the page
	 * breaks its lines: Genius's romanized pages often break them differently.
	 */
	const fitLines = (
		targets: LyricLine[],
		romaji: string,
		anchors: Array<{ word: number; offset: number }>,
		numberLine: (line: LyricLine) => LyricLine,
	): AlignedLine[] => {
		const fitted = fitWords(
			targets.flatMap((line) => line.words),
			romaji,
			anchors,
			readingsOf &&
				targets.flatMap((line) => readingsOf(line) ?? line.words.map(() => "")),
		);
		readable += fitted.readable;
		matched += fitted.matched;
		let offset = 0;
		return targets.map((line) => {
			const own = line.words.map((_, index) => offset + index);
			offset += line.words.length;
			// Latin words still anchor the fit, but keep no romaji of their own:
			// Spicy Lyrics shows the original text for a syllable without any.
			const latin = line.words.map((word) => isLatinOnly(word.word));
			const romanWords = own.map((index, at) =>
				latin[at] ? "" : fitted.romanWords[index],
			);
			// A line's last word has no gap after it.
			for (let index = romanWords.length - 1; index >= 0; index--) {
				if (!romanWords[index]) continue;
				romanWords[index] = romanWords[index].trimEnd();
				break;
			}
			return {
				lineId: line.id,
				lineNumber: numberById.get(numberLine(line).id) ?? 1,
				romanWords: Object.fromEntries(
					line.words.map((word, index) => [word.id, romanWords[index]]),
				),
				uncertain: own.some((index, at) => !latin[at] && fitted.guessed[index]),
				// A line all in Latin letters ("Look around!") needs no romanization.
				romanLine: romanWords.some((text) => text.trim())
					? fitted.pageText(own[0] ?? 0, offset)
					: "",
			};
		});
	};

	// Headers are anchors, not walls: a section of the lyrics is pulled toward
	// the same section on the page, but pages often put headers elsewhere.
	const mains = editor.flatMap((section) => section.lines);
	const pageLines = page.flatMap((section) => section.lines);
	const mainRomaji = pageLines.map((line) => line.main).join("\n");
	const anchors: Array<{ word: number; offset: number }> = [];
	if (
		page.some((section) => section.header) &&
		editor.some((section) => section.key) &&
		page.length === editor.length
	) {
		let word = 0;
		let offset = 0;
		editor.forEach((section, index) => {
			anchors.push({ word, offset });
			word += section.lines.reduce((sum, line) => sum + line.words.length, 0);
			offset += page[index].lines.reduce(
				(sum, line) => sum + line.main.length + 1,
				0,
			);
		});
	}

	const mainOf = new Map<string, LyricLine>();
	const backgrounds = mains.flatMap((line) => {
		const background = backgroundOf.get(line.id);
		if (background) mainOf.set(background.id, line);
		return background ? [background] : [];
	});
	const backgroundRomaji = pageLines
		.map((line) => line.background)
		.filter(Boolean)
		.join("\n");
	const aligned = [
		...fitLines(mains, mainRomaji, anchors, (line) => line),
		...(backgrounds.length > 0 && backgroundRomaji
			? fitLines(
					backgrounds,
					backgroundRomaji,
					[],
					(line) => mainOf.get(line.id) ?? line,
				)
			: []),
	];

	// On the right page nearly every kana, Hangul and Latin word is spelled out
	// (79% or more across the songs tried); on another song's page few are (42%
	// at most). Kanji don't count: they are guesses even on the right page.
	if (aligned.length === 0 || matched < readable * 0.6)
		return { ok: false, reason: "mismatch" };
	return { ok: true, lines: aligned };
}
