/**
 * Builds the word list for the community split vote: the labeling words,
 * more corpus words, and dictionary words sampled by spelling pattern. Each
 * word gets its candidate splits, the whole word (a control every honest voter
 * ticks) and one decoy that cuts off a vowel-less piece (a control nobody
 * honest ticks).
 *
 * AUTOSPLIT_WORDS=<words.jsonl> AUTOSPLIT_VOTE_OUT=<file.json> pnpm exec vitest run research/autosplit/build-vote-words
 */
import { readFileSync, writeFileSync } from "node:fs";
import nlp from "compromise";
import { franc } from "franc-min";
import { it } from "vitest";
import prosodicDictionary from "$/modules/segmentation/data/prosodic-dict.json";
import type {
	SegmentationConfig,
	SegmentationEngineId,
} from "$/modules/segmentation/types";
import { loadHyphenator } from "$/modules/segmentation/utils/hyphen-loader";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";
import { CURATED } from "./wordlist";

interface Row {
	file: string;
	word: string;
	parts: string[];
}

const wordsPath = process.env.AUTOSPLIT_WORDS;
const outPath = process.env.AUTOSPLIT_VOTE_OUT;
const TARGET = 2500;
const CORPUS_COUNT = 900;
const MAX_CANDIDATES = 3;

const isLetter = (c: string) => /[\p{L}\p{M}]/u.test(c);
const core = (word: string) =>
	word
		.replace(/^[^\p{L}\p{M}\p{N}'’$&]+|[^\p{L}\p{M}\p{N}'’$&]+$/gu, "")
		.replace(/’/g, "'");
const songKey = (file: string) =>
	file
		.replace(/\.ttml$/, "")
		.replace(/\s*[-(]\s*(slowed|sped up|reverb|remix|full version).*$/i, "")
		.toLowerCase();

const config = (engine: SegmentationEngineId): SegmentationConfig => ({
	engine,
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
});

// Spelling patterns for sampling dictionary words, most specific first.
const PATTERNS: [string, RegExp][] = [
	["-tion/-sion", /[st]ion(s)?$/],
	["-ing", /ing$/],
	["-ed", /[^e]ed$/],
	["-le", /[^aeiou]le(s)?$/],
	["-ly", /ly$/],
	["-er/-est", /(er|est)(s)?$/],
	["-ful/-less/-ness", /(ful|less|ness)$/],
	["-able/-ible", /[ai]ble$/],
	["-ous/-ious", /ous$/],
	["-y ending", /[^aeiou]y$/],
	["un-/re-/de-/dis-/mis-/pre-", /^(un|re|de|dis|mis|pre)[a-z]{3}/],
	["over-/under-/out-", /^(over|under|out)[a-z]{3}/],
	["vowel pair", /(ea|ee|oo|ou|ow|ai|ay|ie|ei|oa|oi|oy|ue|ui|au|aw|eu|ew)/],
	["vowel next to vowel", /[aeiou][aeiou]/],
	["doubled consonant", /([b-df-hj-np-tv-z])\1/],
	["consonant digraph", /(th|ch|sh|ng|ck|ph|gh|wh|qu|x)/],
	["silent e", /[aeiou][^aeiou]e(s)?$/],
	["other", /./],
];

const patternOf = (word: string) =>
	PATTERNS.find(([, re]) => re.test(word))?.[0] ?? "other";

/** A cut that leaves a piece with no vowel: one sung syllable cut in two. */
function decoy(split: string): string | undefined {
	const parts = split.split("/");
	const vowel = /[aeiouyàâäéèêëïîôöùûü]/i;
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part.length >= 3 && !vowel.test(part.at(-1) ?? "")) {
			return [
				...parts.slice(0, i),
				part.slice(0, -1),
				part.slice(-1),
				...parts.slice(i + 1),
			].join("/");
		}
	}
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part.length >= 2 && !vowel.test(part[0]) && vowel.test(part.slice(1))) {
			return [
				...parts.slice(0, i),
				part[0],
				part.slice(1),
				...parts.slice(i + 1),
			].join("/");
		}
	}
	return undefined;
}

it.skipIf(!wordsPath || !outPath)(
	"build community vote word list",
	{ timeout: 900_000 },
	async () => {
		const rows: Row[] = readFileSync(wordsPath as string, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));

		const textByFile = new Map<string, string[]>();
		for (const row of rows) {
			const list = textByFile.get(row.file) ?? [];
			list.push(row.word);
			textByFile.set(row.file, list);
		}
		const english = new Set(
			[...textByFile]
				.filter(
					([, words]) => franc(words.join(" "), { minLength: 20 }) === "eng",
				)
				.map(([file]) => file),
		);

		// lowercase core -> split string -> songs using it
		const corpus = new Map<string, Map<string, Set<string>>>();
		// lowercase core -> spelling as written -> songs using it
		const casing = new Map<string, Map<string, Set<string>>>();
		for (const row of rows) {
			if (!english.has(row.file)) continue;
			const word = core(row.word);
			if (
				!word ||
				word.length > 20 ||
				[...word].some((c) => /[^\p{Script=Latin}\p{M}'-]/u.test(c))
			)
				continue;
			const key = word.toLowerCase();
			const start = row.word.replace(/’/g, "'").indexOf(word);
			const cuts: number[] = [];
			let offset = 0;
			for (const part of row.parts.slice(0, -1)) {
				offset += part.length;
				const at = offset - start;
				if (at > 0 && at < word.length) cuts.push(at);
			}
			const split = cut(key, cuts);
			const variants = corpus.get(key) ?? new Map<string, Set<string>>();
			const songs = variants.get(split) ?? new Set<string>();
			songs.add(songKey(row.file));
			variants.set(split, songs);
			corpus.set(key, variants);
			const forms = casing.get(key) ?? new Map<string, Set<string>>();
			const formSongs = forms.get(word) ?? new Set<string>();
			formSongs.add(songKey(row.file));
			forms.set(word, formSongs);
			casing.set(key, forms);
		}

		// Show names as names (`Johnny`, `Kentucky`). Makers capitalize line
		// starts too, and a chorus repeats one song's lines many times, so a
		// word counts as a name from the TTMLs only when every song (3 or more)
		// capitalizes it and the parser doesn't call it a common word.
		const displayCase = (key: string) => {
			const tags = (nlp(key).json()[0] as { terms: { tags: string[] }[] } | undefined)
				?.terms[0]?.tags ?? [];
			const capitalized = `${key[0].toUpperCase()}${key.slice(1)}`;
			if (tags.some((t) => NAME_TAGS.has(t))) return capitalized;
			const forms = [...(casing.get(key) ?? new Map<string, Set<string>>())];
			const songs = new Set(forms.flatMap(([, s]) => [...s]));
			const lowerSongs = new Set(
				forms.filter(([form]) => !/^\p{Lu}/u.test(form)).flatMap(([, s]) => [...s]),
			);
			if (songs.size >= 3 && lowerSongs.size === 0 && !tags.some((t) => COMMON_TAGS.has(t)))
				return forms.sort((a, b) => b[1].size - a[1].size)[0][0];
			return key;
		};

		const hyphenate = await loadHyphenator("en-us");
		const engineSplit = (word: string, engine: SegmentationEngineId) => {
			const c = config(engine);
			if (engine === "hyphenation-en-us" && hyphenate) c.hyphenator = hyphenate;
			return segmentWord(
				{ ...newLyricWord(), word, startTime: 0, endTime: 1000 },
				c,
			)
				.map((w) => w.word)
				.join("/");
		};

		const entries: {
			word: string;
			group: string;
			candidates: string[];
			sources: Record<string, string[]>;
			decoy?: string;
		}[] = [];
		const seen = new Set<string>();
		const addWord = (word: string, group: string) => {
			const key = word.toLowerCase();
			if (seen.has(key)) return false;
			const sources = new Map<string, string[]>();
			const push = (split: string, source: string) => {
				const cased = recase(split, word);
				sources.set(cased, [...(sources.get(cased) ?? []), source]);
			};
			// Order is priority: only the first MAX_CANDIDATES are shown.
			push(engineSplit(word, "prosodic"), "rules");
			const variants = [...(corpus.get(key) ?? new Map())].sort(
				(a, b) => b[1].size - a[1].size,
			);
			for (const [split, songs] of variants.slice(0, 1))
				push(split, `corpus:${songs.size}`);
			// Hyphenation often cuts fewer times at real boundaries (`vanes/sa`),
			// but sometimes inside a sung syllable (`bliv/ion`). Keep it when a TTML
			// maker used it or every cut is one a singer could make.
			const hyphenated = recase(engineSplit(word, "hyphenation-en-us"), word);
			const hyphenCuts = cutsOf(hyphenated);
			if (
				sources.has(hyphenated) ||
				hyphenCuts.every((at, i) =>
					plausibleCut(word, at, hyphenCuts[i - 1], hyphenCuts[i + 1]),
				)
			)
				push(hyphenated, "hyphenation");
			// Cut placement is the open question (`pla/ying` vs `play/ing`), so
			// offer the first split with one cut moved a letter, when it's a cut a
			// singer could make.
			const first = [...sources.keys()].find((s) => s.includes("/"));
			if (first) for (const shifted of shifts(first)) push(shifted, "shift");
			for (const [split, songs] of variants.slice(1))
				push(split, `corpus:${songs.size}`);
			// Fewer cuts are always allowed by the guide (`remem/ber`), and they
			// show whether voters prefer every syllable split.
			if (first && first.split("/").length >= 3)
				for (const merged of fewer(first)) push(merged, "fewer");
			// The page offers "Keep whole" on every word, so it's no candidate.
			sources.delete(word);
			// Words with one option or none (`real`, `fire`) get a split by vowel
			// sounds, so there's something to compare.
			if (sources.size < 2) {
				const split = vowelSplit(word);
				if (split && split !== word) push(split, "vowels");
			}
			const candidates = [...sources.keys()].slice(0, MAX_CANDIDATES);
			if (candidates.length === 0) return false;
			seen.add(key);
			// A decoy on every word clutters the list; about one word in four
			// is enough to spot voters who tick everything.
			const wrong = hash(key) % 4 === 0 ? decoy(candidates[0]) : undefined;
			entries.push({
				word,
				group,
				candidates,
				sources: Object.fromEntries(
					candidates.map((c) => [c, sources.get(c) ?? []]),
				),
				...(wrong && wrong !== word && !candidates.includes(wrong)
					? { decoy: wrong }
					: {}),
			});
			return true;
		};

		for (const [category, words] of Object.entries(CURATED))
			for (const word of words) addWord(word, `curated: ${category}`);

		const frequent = [...corpus]
			.filter(([key, variants]) => {
				if ([...key].filter(isLetter).length < 3 || seen.has(key)) return false;
				const anySplit = [...variants.keys()].some((s) => s.includes("/"));
				return anySplit || engineSplit(key, "prosodic").includes("/");
			})
			.map(([key, variants]) => ({
				key,
				songs: new Set([...variants.values()].flatMap((s) => [...s])).size,
			}))
			// A spelling from one song is often a one-off (`ainoo`) or a name;
			// keep it only when it's a known word.
			.filter(({ key, songs }) => songs >= 2 || dictionary.has(key))
			.sort((a, b) => b.songs - a.songs || a.key.localeCompare(b.key))
			.slice(0, CORPUS_COUNT);
		for (const { key } of frequent) addWord(displayCase(key), "corpus");

		// Fill with dictionary words, round-robin across spelling patterns in
		// frequency order, so rare patterns get as many words as common ones.
		const buckets = new Map<string, string[]>();
		for (const key of Object.keys(prosodicDictionary)) {
			if (!/^[a-z]{4,}$/.test(key) || seen.has(key)) continue;
			// The dictionary was built from text split at apostrophes, so it has
			// the front halves of contractions (`doesn`, `couldn`).
			if (CONTRACTION_FRAGMENTS.has(key)) continue;
			const pattern = patternOf(key);
			buckets.set(pattern, [...(buckets.get(pattern) ?? []), key]);
		}
		const queues = [...buckets].map(([pattern, words]) => ({
			pattern,
			words,
		}));
		while (entries.length < TARGET && queues.some((q) => q.words.length)) {
			for (const queue of queues) {
				if (entries.length >= TARGET) break;
				while (queue.words.length) {
					const word = queue.words.shift() as string;
					if (addWord(displayCase(word), `dictionary: ${queue.pattern}`)) break;
				}
			}
		}

		writeFileSync(
			outPath as string,
			JSON.stringify({ version: 1, words: entries }, null, 0),
		);
		const groups = new Map<string, number>();
		for (const e of entries)
			groups.set(e.group.split(":")[0], (groups.get(e.group.split(":")[0]) ?? 0) + 1);
		console.log(entries.length, "words", Object.fromEntries(groups));
		console.log(
			"no decoy:",
			entries.filter((e) => !e.decoy).length,
			"no candidates:",
			entries.filter((e) => !e.candidates.length).length,
		);
	},
);

const dictionary = new Set(Object.keys(prosodicDictionary));
// Parser tags that mean a capitalized name. A bare `FirstName` isn't enough:
// `mark`, `grace` and `jack` get it too.
const NAME_TAGS = new Set(
	"MaleName FemaleName Place Country City Region WeekDay Month".split(" "),
);
const COMMON_TAGS = new Set(
	"Expression Pronoun Determiner Conjunction Preposition Verb Adverb".split(" "),
);
const CONTRACTION_FRAGMENTS = new Set(
	"aren couldn didn doesn hadn hasn isn mightn mustn needn oughtn shouldn wasn weren wouldn".split(
		" ",
	),
);
const VOWEL = /[aeiouyàâäéèêëïîôöùûü]/i;
// Consonant clusters English syllables can start with.
const ONSETS = new Set(
	"bl br ch cl cr dr dw fl fr gl gr kn ph pl pr qu sc sch scr sh shr sk sl sm sn sp sph spl spr squ st str sw th thr tr tw wh wr".split(
		" ",
	),
);
// Letter pairs that make one sound and are never cut apart.
const DIGRAPHS = new Set("ch ck gh ph qu sh th wh".split(" "));
// Two vowels that are often two syllables (`li/on`, `fu/el`, `pra/yer`).
const HIATUS = /^(ia|io|iu|eo|ua|ue|uo|ya|ye|yo|.[ïëü])$/i;

/**
 * True when cutting `word` before index `at`, inside the piece from `start` to
 * `end`, gives pieces a singer could sing.
 */
function plausibleCut(word: string, at: number, start = 0, end = word.length) {
	const left = word.slice(start, at);
	const right = word.slice(at, end);
	if (!VOWEL.test(left) || !VOWEL.test(right) || /['’]/.test(word)) return false;
	const pair = word.slice(at - 1, at + 1).toLowerCase();
	if (DIGRAPHS.has(pair)) return false;
	// A consonant plus `l` or `r` starts one syllable together (`a/gree`, not `ag/ree`).
	if (/^[bcdfgkpt][lr]$/.test(pair) && pair !== "tl" && pair !== "dl") return false;
	// A `y` before a consonant ends the vowel before it (`may/be`, not `ma/ybe`);
	// one before a vowel starts the next syllable (`you/th`, not `y/outh`).
	if (/^y[^aeiou]/i.test(right)) return false;
	if (/^y$/i.test(left) && /^[aeiou]/i.test(right)) return false;
	// The `u` after `q` or `g` is a consonant sound (`qu/een`, `gu/ard`).
	if (/^[qg]$/i.test(word[at - 2] ?? "") && /^u$/i.test(word[at - 1])) return false;
	// A hyphen stays at the end of the piece before it (`check-/up`).
	if (right.startsWith("-")) return false;
	// A silent final `e`, `-ue` or a plain `-ed` is no syllable of its own
	// (`smi/le`, `e/yes`, `lea/gue`, `lo/ved`); `-ted` and `-ded` are (`wan/ted`).
	if (/^[^aeiou]*es?$/i.test(right) || /^gues?$/i.test(right)) return false;
	if (/^[^aeiou]?ed$/i.test(right) && !/^[td]ed$/i.test(right)) return false;
	if (/^y$/i.test(right) && VOWEL.test(word[at - 1])) return false;
	// A consonant pulled onto the left is how dictionaries cut (`nev/er`,
	// `plan/et`): one consonant between two vowels, leaving more than a lone
	// vowel letter (`craz/y`). Grabbing the second of two consonants (`aft/er`,
	// `summ/er`) is not, unless the left part is a word (`play/ing`).
	if (
		!VOWEL.test(word[at - 1]) &&
		VOWEL.test(word[at]) &&
		!/^y[aeiou]/i.test(right) &&
		!dictionary.has(word.slice(0, at).toLowerCase()) &&
		(right.length < 2 || !VOWEL.test(word[at - 2] ?? ""))
	)
		return false;
	// `-tion`, `-sion`, `-cial` are one syllable (`ac/tion`, not `act/ion`).
	if (/^[tsc]$/i.test(word[at - 1]) && /^i[aoe]/i.test(right)) return false;
	// A silent `e` before a suffix is no syllable (`grate/ful`, not `grat/eful`).
	if (/^e(ful|ly|ment|less|ness)/i.test(right)) return false;
	// Two vowels side by side: only where they're usually two sounds.
	if (VOWEL.test(word[at - 1]) && VOWEL.test(word[at]) && !/^y/i.test(right))
		return HIATUS.test(pair);
	// `y` before a vowel is a consonant (`pla/ying`).
	const onset = /^(?:y(?=[aeiou])|[^aeiouyàâäéèêëïîôöùûü])*/i
		.exec(right)?.[0]
		.toLowerCase();
	if (onset && onset.length > 1 && !ONSETS.has(onset)) return false;
	if (onset === "x" || onset === "ng") return false;
	return true;
}

const cutsOf = (split: string) => {
	const cuts: number[] = [];
	let offset = 0;
	for (const part of split.split("/").slice(0, -1)) {
		offset += part.length;
		cuts.push(offset);
	}
	return cuts;
};

/**
 * A split by vowel groups, for words no source splits: `fu/el`, `Ro/lex`,
 * `na/ïve`. One consonant goes with the next vowel. Undefined when the result
 * isn't something a singer would do (`qu/een`, `smi/le`).
 */
function vowelSplit(word: string) {
	const groups = [...word.matchAll(/[aeiouyàâäéèêëïîôöùûü]+/gi)].filter(
		(m) => !(m[0].toLowerCase() === "y" && m.index === 0),
	);
	const cuts: number[] = [];
	if (groups.length >= 2) {
		for (let i = 1; i < groups.length; i++) {
			const start = groups[i].index;
			const end = groups[i - 1].index + groups[i - 1][0].length;
			cuts.push(start > end ? start - 1 : start);
		}
	} else if (groups.length === 1 && groups[0][0].length >= 2) {
		cuts.push(groups[0].index + 1);
	}
	return cuts.length &&
		cuts.every((at, i) => plausibleCut(word, at, cuts[i - 1], cuts[i + 1]))
		? cut(word, cuts)
		: undefined;
}

/**
 * `split` with one cut moved one letter, where the moved cut is one a singer
 * could make (`play/ing` vs `pla/ying`, `mo/ney` vs `mon/ey`). Some of these
 * are wrong on purpose: that's what the vote is for.
 */
function shifts(split: string) {
	const word = split.replaceAll("/", "");
	if (!/^\p{L}+$/u.test(word)) return [];
	const cuts = cutsOf(split);
	const result: string[] = [];
	cuts.forEach((at, i) => {
		for (const moved of [at - 1, at + 1]) {
			if (moved <= (cuts[i - 1] ?? 0) || moved >= (cuts[i + 1] ?? word.length))
				continue;
			if (plausibleCut(word, moved, cuts[i - 1], cuts[i + 1]))
				result.push(cut(word, cuts.with(i, moved)));
		}
	});
	return result;
}

/** `split` with its first two and its last two pieces joined. */
function fewer(split: string) {
	const pieces = split.split("/");
	return [
		[pieces[0] + pieces[1], ...pieces.slice(2)].join("/"),
		[...pieces.slice(0, -2), pieces.at(-2) + pieces.at(-1)].join("/"),
	];
}

/** A small stable hash, so the same words get decoys on every build. */
function hash(text: string) {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	return h;
}

function cut(word: string, cuts: number[]) {
	let out = "";
	let start = 0;
	for (const end of cuts) {
		out += `${word.slice(start, end)}/`;
		start = end;
	}
	return out + word.slice(start);
}

/** Applies a lowercase split's boundaries to the original casing. */
function recase(split: string, word: string) {
	const parts = split.split("/");
	if (parts.join("").length !== word.length) return split;
	let offset = 0;
	return parts
		.map((part) => {
			const piece = word.slice(offset, offset + part.length);
			offset += part.length;
			return piece;
		})
		.join("/");
}
