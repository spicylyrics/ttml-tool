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
const MAX_CANDIDATES = 5;

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
		}

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
			push(engineSplit(word, "prosodic"), "rules");
			push(engineSplit(word, "hyphenation-en-us"), "hyphenation");
			const variants = [...(corpus.get(key) ?? new Map())].sort(
				(a, b) => b[1].size - a[1].size,
			);
			for (const [split, songs] of variants) push(split, `corpus:${songs.size}`);
			// Cut placement is the open question (`pla/ying` vs `play/ing`), so
			// offer the first split with one cut moved a letter either way.
			const first = [...sources.keys()].find((s) => s.includes("/"));
			if (first) for (const shifted of shifts(first)) push(shifted, "shift");
			// The page offers "Keep whole" on every word, so it's no candidate.
			sources.delete(word);
			// Words nobody splits (`real`, `prayer`, `loved`) still need a split to
			// judge, or the page would only show the decoy.
			if (sources.size === 0 && !group.startsWith("dictionary")) {
				const split = vowelSplit(word);
				if (split) sources.set(split, ["vowels"]);
			}
			const candidates = [...sources.keys()].slice(0, MAX_CANDIDATES);
			if (candidates.length === 0) return false;
			seen.add(key);
			const wrong = decoy(candidates[0] ?? word);
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
			.sort((a, b) => b.songs - a.songs || a.key.localeCompare(b.key))
			.slice(0, CORPUS_COUNT);
		for (const { key } of frequent) addWord(key, "corpus");

		// Fill with dictionary words, round-robin across spelling patterns in
		// frequency order, so rare patterns get as many words as common ones.
		const buckets = new Map<string, string[]>();
		for (const key of Object.keys(prosodicDictionary)) {
			if (!/^[a-z]{4,}$/.test(key) || seen.has(key)) continue;
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
					if (addWord(word, `dictionary: ${queue.pattern}`)) break;
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

/**
 * A split by vowel groups, for words no source splits: `re/al`, `lo/ved`,
 * `Ro/lex`. One consonant goes with the next vowel; two vowels in a row are
 * cut apart only when the word has a single vowel group.
 */
function vowelSplit(word: string) {
	const vowel = /[aeiouyàâäéèêëïîôöùûü]/i;
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
	const split = cut(word, cuts);
	const pieces = split.split("/");
	return pieces.length > 1 && pieces.every((p) => vowel.test(p) || p.includes("'"))
		? split
		: undefined;
}

/** `split` with one cut moved one letter, keeping a vowel in every piece. */
function shifts(split: string) {
	const word = split.replaceAll("/", "");
	const cuts: number[] = [];
	let offset = 0;
	for (const part of split.split("/").slice(0, -1)) {
		offset += part.length;
		cuts.push(offset);
	}
	const vowel = /[aeiouyàâäéèêëïîôöùûü]/i;
	const result: string[] = [];
	cuts.forEach((at, i) => {
		for (const moved of [at - 1, at + 1]) {
			const next = cuts.with(i, moved);
			const pieces = cut(word, next).split("/");
			if (
				pieces.length === cuts.length + 1 &&
				pieces.every((piece) => piece && vowel.test(piece)) &&
				// A silent final `e` is no syllable of its own (`en/tir/e`).
				!/^[^aeiouy]*es?$/i.test(pieces.at(-1) ?? "") &&
				// Moving a cut between two vowels mostly breaks a vowel sound (`dre/am`).
				!(vowel.test(word[moved - 1]) && vowel.test(word[moved]))
			)
				result.push(cut(word, next));
		}
	});
	return result;
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
