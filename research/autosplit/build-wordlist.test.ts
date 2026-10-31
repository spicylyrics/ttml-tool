/**
 * Builds the word list for the split-labeling page: curated words plus the
 * most frequent English words in a TTML corpus, each with candidate splits.
 *
 * AUTOSPLIT_WORDS=<words.jsonl> AUTOSPLIT_OUT=<dir> pnpm exec vitest run research/autosplit/build-wordlist
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { franc } from "franc-min";
import { it } from "vitest";
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
const outDir = process.env.AUTOSPLIT_OUT;
const FREQUENT_COUNT = 150;

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
const docId = (word: string) =>
	[...word.toLowerCase()]
		.map((c) => (/[a-z0-9]/.test(c) ? c : `_${c.codePointAt(0)?.toString(16)}`))
		.join("");

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

it.skipIf(!wordsPath || !outDir)(
	"build split-labeling word list",
	{ timeout: 600_000 },
	async () => {
		const rows: Row[] = readFileSync(wordsPath as string, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));

		// English files only: the corpus suggestions should be English splits.
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

		// lowercase core -> split string ("eve/ry") -> songs using it
		const corpus = new Map<string, Map<string, Set<string>>>();
		const tokenCount = new Map<string, number>();
		for (const row of rows) {
			if (!english.has(row.file)) continue;
			const word = core(row.word);
			if (
				!word ||
				[...word].some((c) => /[^\p{Script=Latin}\p{M}\p{N}'$&-]/u.test(c))
			)
				continue;
			const key = word.toLowerCase();
			// Rebuild the core's split from the span texts.
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
			tokenCount.set(key, (tokenCount.get(key) ?? 0) + 1);
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
			id: string;
			word: string;
			category: string;
			tokens: number;
			songs: number;
			candidates: { split: string; sources: string[] }[];
		}[] = [];
		const seen = new Set<string>();
		const addWord = (word: string, category: string) => {
			const key = word.toLowerCase();
			if (seen.has(key)) return;
			seen.add(key);
			const candidates = new Map<string, string[]>();
			const push = (split: string, source: string) => {
				// Keep the word's own casing in the candidate.
				const cased = recase(split, word);
				candidates.set(cased, [...(candidates.get(cased) ?? []), source]);
			};
			push(engineSplit(word, "prosodic"), "Prosodic");
			push(engineSplit(word, "hyphenation-en-us"), "Hyphenation");
			const variants = [...(corpus.get(key) ?? new Map())].sort(
				(a, b) => b[1].size - a[1].size,
			);
			for (const [split, songs] of variants)
				push(
					split,
					`Your TTMLs (${songs.size} ${songs.size === 1 ? "song" : "songs"})`,
				);
			const allSongs = new Set(variants.flatMap(([, s]) => [...s]));
			entries.push({
				id: docId(word),
				word,
				category,
				tokens: tokenCount.get(key) ?? 0,
				songs: allSongs.size,
				candidates: [...candidates].map(([split, sources]) => ({
					split,
					sources,
				})),
			});
		};

		for (const [category, words] of Object.entries(CURATED))
			for (const word of words) addWord(word, category);

		// Most widespread English words in the corpus that someone split or an
		// engine would split, ranked by how many songs use them.
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
			.slice(0, FREQUENT_COUNT);
		for (const { key } of frequent) addWord(key, "Frequent in your TTMLs");

		writeFileSync(
			join(outDir as string, "words.json"),
			JSON.stringify({ version: 1, words: entries }),
		);
		console.log(entries.length, "words");
	},
);

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
