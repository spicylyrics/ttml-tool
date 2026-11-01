import nlp from "compromise/tokenize";
import nlpSpeech from "compromise-speech";
import silabas from "silabas";
import syllabify from "syllabify";
import syllabifyFr from "syllabify-fr";
import prosodicDictionary from "../data/prosodic-dict.json";
import type { SegmentationEngineId } from "../types";

type DictionaryEntry = number | number[];

export interface SyllabificationEngine {
	id: SegmentationEngineId;
	name: string;
	description: string;
	split: (word: string) => string[];
	/** Like `split`, and says whether the cuts are a guess worth checking. */
	splitDetailed?: (word: string) => { parts: string[]; unsure: boolean };
}

const hyphenationLanguages = [
	["en-us", "English (US)", true],
	["de", "German", false],
	["fr", "French", true],
	["es", "Spanish", true],
	["id", "Indonesian", false],
	["it", "Italian", false],
	["pt", "Portuguese", false],
	["ru", "Russian", true],
	["pl", "Polish", false],
] as const;

export const getHyphenationLanguage = (engine: SegmentationEngineId) =>
	engine.startsWith("hyphenation-")
		? engine.slice("hyphenation-".length)
		: undefined;

const dictionary = new Map<string, DictionaryEntry>(
	Object.entries(prosodicDictionary as Record<string, DictionaryEntry>),
);
const nlpWithSpeech = nlp.extend(nlpSpeech as never);

const splitAtLengths = (word: string, lengths: number[]) => {
	const boundaries = lengths.reduce<number[]>((result, length) => {
		result.push((result[result.length - 1] ?? 0) + length);
		return result;
	}, []);
	const parts: string[] = [];
	let start = 0;
	for (const end of boundaries) {
		parts.push(word.slice(start, end));
		start = end;
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
};

const compromiseSplit = (word: string) => {
	const syllables = (nlpWithSpeech(word).syllables() as string[][]).flat();
	if (syllables.length <= 1) return [word];

	let offset = 0;
	const intervals = syllables.map((syllable) => {
		const remaining = word.slice(offset);
		const match = remaining.toLowerCase().indexOf(syllable.toLowerCase());
		const end = offset + (match < 0 ? 0 : match) + syllable.length;
		const begin = offset;
		offset = end;
		return { begin, end };
	});

	for (let index = 0; index < intervals.length; index++) {
		const interval = intervals[index];
		if (index === intervals.length - 1) {
			interval.end = word.length;
			continue;
		}
		const next = intervals[index + 1];
		interval.end = next.begin;
		if (/[’']/.test(word.charAt(interval.end - 1))) {
			interval.end--;
			next.begin--;
		}
	}
	return intervals
		.map(({ begin, end }) => word.slice(begin, end))
		.filter(Boolean);
};

const mergeContractionSuffix = (parts: string[]) => {
	const result: string[] = [];
	for (const part of parts) {
		if (/^[’'](?:s|re|ve|ll|d|m|t)$/i.test(part) && result.length > 0) {
			result[result.length - 1] += part;
		} else if (/^[’']./.test(part) && result.length > 0) {
			// The apostrophe ends the previous syllable: `I'/ma`, not `I/'ma`.
			result[result.length - 1] += part[0];
			result.push(part.slice(1));
		} else {
			result.push(part);
		}
	}
	return result;
};

/** Splits `word` at the same cut offsets as `parts`, which spell a word of similar length. */
const splitLike = (word: string, parts: string[]) => {
	const lengths = parts.slice(0, -1).map((part) => part.length);
	return lengths.reduce((sum, length) => sum + length, 0) < word.length
		? splitAtLengths(word, lengths)
		: [word];
};

const VOWEL = /[aeiouy]/i;

// Common first and second halves of lyric compounds. The dictionary splits
// these by sound alone (`ups/tate`, `mains/tream`); singers split at the seam.
const COMPOUND_HEADS = new Set(
	"some any no what how when where who with through out in up down back main week birth sun moon star heart life day night rain fire home side high low under over after mid good bad for every".split(
		" ",
	),
);
const COMPOUND_TAILS = new Set(
	"body bodies one thing things where time times day days way ways self selves side out in ever how more stream state seat end light lights night nights shine beat break ground town place line land house man men world bound ward wards while dream bye made".split(
		" ",
	),
);

const splitCompound = (word: string) => {
	const lower = word.toLowerCase();
	for (let seam = lower.length - 2; seam >= 2; seam--) {
		if (
			COMPOUND_HEADS.has(lower.slice(0, seam)) &&
			COMPOUND_TAILS.has(lower.slice(seam))
		) {
			return [
				...prosodicSplit(word.slice(0, seam)),
				...prosodicSplit(word.slice(seam)),
			];
		}
	}
	return undefined;
};

/**
 * Keeps `ck`, `x` and `ight` in the syllable they close: `rock/ing`,
 * `sex/y`, `fight/ing`. `daugh/ter` is left alone.
 */
const fixOnsets = (parts: string[]) => {
	const result = [...parts];
	for (let index = 1; index < result.length; index++) {
		const previous = result[index - 1];
		const part = result[index];
		const moved = /^ck/i.test(part)
			? 2
			: (/^x/i.test(part) && VOWEL.test(part.slice(1))) ||
					(/igh$/i.test(previous) &&
						/^t(?:ing|in['’]?|er|ers|en|ed|est)$/i.test(part))
				? 1
				: 0;
		if (moved === 0) continue;
		result[index - 1] = previous + result[index].slice(0, moved);
		result[index] = result[index].slice(moved);
	}
	return result.filter(Boolean);
};

/** A piece with no vowel is not a sung syllable: join it to its neighbor. */
const mergeVowelless = (parts: string[]) => {
	const result: string[] = [];
	for (const part of parts) {
		if (result.length > 0 && !VOWEL.test(part))
			result[result.length - 1] += part;
		else if (result.length > 0 && !VOWEL.test(result[result.length - 1]))
			result[result.length - 1] += part;
		else result.push(part);
	}
	return result;
};

/** Vowel sounds in a written part, not counting a silent final `e`, `es` or `ed`. */
const countVowelGroups = (part: string) => {
	let letters = part
		.toLowerCase()
		.replace(/[^a-z]/g, "")
		.replace(/^y(?=[aeiou])/, "");
	if (/[aeiouy].*[^aeiouy]e[sd]?$/.test(letters))
		letters = letters.replace(/e[sd]?$/, "");
	return letters.match(/[aeiouy]+/g)?.length ?? 0;
};

/**
 * Cuts worth a second look: a part with no vowel sound or with two of them
 * (`Balen/ci/a/ga`), or a cut between two sounded vowels, which depends on
 * how the word is sung (`li/on`, `wo/ah`). `n't` and `-ing` after a vowel
 * (`did/n't`, `go/in'`) are fine, and so is a silent `e` (`some/one`).
 */
export const isUnsureSplit = (parts: string[]) => {
	if (parts.length < 2 || parts.every((part) => /^[A-Z]$/.test(part)))
		return false;
	return parts.some(
		(part, index) =>
			(countVowelGroups(part) !== 1 && !/^n['’]t$/i.test(part)) ||
			(index > 0 &&
				/[aeiou]$/i.test(parts[index - 1]) &&
				!/[^aeiou]e$/i.test(parts[index - 1]) &&
				/^[aeiou]/i.test(part) &&
				!/^in(?:g|['’])?$/i.test(part)),
	);
};

const lookupDictionary = (word: string) => {
	const entry = dictionary.get(word.toLowerCase());
	if (entry === undefined) return undefined;
	return fixOnsets(
		splitAtLengths(word, typeof entry === "number" ? [entry] : entry),
	);
};

function prosodicSplit(word: string): string[] {
	// Letter-by-letter acronyms: `DJ`, `TV`. Doubled letters are interjections (`HMM`, `SHH`).
	if (/^[A-Z]{2,4}$/.test(word) && !VOWEL.test(word) && !/(.)\1/.test(word)) {
		return Array.from(word);
	}

	// `didn't`, `couldn't`: `n't` after a consonant is its own syllable.
	// After a vowel (`don't`, `can't`, `aren't`) it stays in one.
	const negation = /^(.*[b-df-hj-np-tv-xz])(n['’]t)$/i.exec(word);
	if (negation && VOWEL.test(negation[1])) {
		return [...prosodicSplit(negation[1]), negation[2]];
	}
	if (/[aeiou]n['’]t$/i.test(word)) return [word];

	// Dropped-g spellings split like the `-ing` form. With an apostrophe
	// (`singin'`) always; without one (`singin`) only when the dictionary
	// knows the `-ing` word, so `begin` and `cabin` are left alone.
	const droppedG = /^(.*[a-z]in)(['’]?)$/i.exec(word);
	if (
		droppedG &&
		!dictionary.has(word.toLowerCase()) &&
		(droppedG[2] || dictionary.has(`${droppedG[1].toLowerCase()}g`))
	) {
		const full = prosodicSplit(`${droppedG[1]}g`);
		if (full.length > 1) return splitLike(word, full);
	}

	// Two-syllable `every` is sung `eve/ry`, also in `everything`.
	const every = /^(every)(.*)$/i.exec(word);
	if (every) {
		const head = [every[1].slice(0, 3), every[1].slice(3)];
		return every[2] ? [...head, ...prosodicSplit(every[2])] : head;
	}

	// `un-` keeps its own syllable: `un/stop/pa/ble`, not `uns/top/pa/ble`.
	const parts =
		splitCompound(word) ??
		lookupDictionary(word) ??
		mergeVowelless(fixOnsets(mergeContractionSuffix(compromiseSplit(word))));
	if (
		/^un[b-df-hj-np-tv-z]{2}/i.test(word) &&
		parts.length > 1 &&
		parts[0].length === 3
	) {
		return [word.slice(0, 2), parts[0].slice(2) + parts[1], ...parts.slice(2)];
	}
	return parts;
}

const isJapaneseCharacter = (char: string | undefined) =>
	!!char &&
	/[々\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
const isJapanesePunctuation = (char: string | undefined) =>
	!!char && /[\p{P}\p{S}]/u.test(char);
const isJapaneseModifier = (char: string | undefined) =>
	!!char && "ャュョゃゅょンッっ".includes(char);

/** Adapted from amll-dev/amll-editor's Japanese basic engine. */
export const splitJapaneseText = (text: string) => {
	if (!text.trim()) return [text];
	const chars = Array.from(text);
	const tokens: string[] = [];
	while (chars.length > 0) {
		const token: string[] = [];
		if (isJapaneseCharacter(chars[0])) {
			token.push(chars.shift() ?? "");
			if (isJapaneseModifier(chars[0])) token.push(chars.shift() ?? "");
			while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
			tokens.push(token.join(""));
			continue;
		}
		while (
			chars.length > 0 &&
			!isJapaneseCharacter(chars[0]) &&
			!isJapanesePunctuation(chars[0]) &&
			!/^\s$/u.test(chars[0] ?? "")
		) {
			token.push(chars.shift() ?? "");
		}
		while (isJapanesePunctuation(chars[0])) token.push(chars.shift() ?? "");
		if (token.length > 0) tokens.push(token.join(""));
		if (chars.length > 0 && /^\s$/u.test(chars[0] ?? "")) {
			tokens.push(chars.shift() ?? "");
		}
	}
	return tokens;
};

export const SYLLABIFICATION_ENGINES: SyllabificationEngine[] = [
	{
		id: "prosodic",
		name: "English (Prosodic)",
		description:
			"Dictionary-backed English syllable boundaries with a speech fallback.",
		split: (word) => prosodicSplit(word),
		splitDetailed: (word) => {
			const parts = prosodicSplit(word);
			return { parts, unsure: isUnsureSplit(parts) };
		},
	},
	{
		id: "basic",
		name: "Basic",
		description:
			"Keep Latin words whole and split CJK text using the existing rules.",
		split: (word) => [word],
	},
	{
		id: "japanese",
		name: "Japanese (Basic)",
		description:
			"Use the existing CJK character splitting rules for Japanese text.",
		split: (word) => [word],
	},
	{
		id: "silabas",
		name: "Spanish (Silabas)",
		description: "Spanish orthographic syllable splitting.",
		split: (word) => {
			try {
				return silabas(word).syllables();
			} catch {
				return [word];
			}
		},
	},
	{
		id: "syllabify-fr",
		name: "French (Syllabify-fr)",
		description: "French orthographic syllable splitting.",
		split: (word) => syllabifyFr(word).syllabes,
	},
	{
		id: "syllabify",
		name: "Russian (Syllabify)",
		description: "Russian orthographic syllable splitting.",
		split: (word) => {
			try {
				return syllabify(word);
			} catch {
				return [word];
			}
		},
	},
	...hyphenationLanguages.map<SyllabificationEngine>(
		([language, name, hasBetterEngine]) => ({
			id: `hyphenation-${language}`,
			name: `${name}${hasBetterEngine ? " (legacy)" : ""}`,
			description: `Use the existing ${name} hyphenation patterns.`,
			split: (word) => [word],
		}),
	),
	{
		id: "none",
		name: "None",
		description: "Do not split words automatically.",
		split: (word) => [word],
	},
];
SYLLABIFICATION_ENGINES.sort((left, right) =>
	left.name.localeCompare(right.name),
);

export const getSyllabificationEngine = (id: SegmentationEngineId) =>
	SYLLABIFICATION_ENGINES.find((engine) => engine.id === id) ??
	SYLLABIFICATION_ENGINES[0];
