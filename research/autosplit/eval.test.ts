/**
 * Research harness, not a product test: scores the app's auto-split engines
 * against word splits from finished TTML files.
 *
 * AUTOSPLIT_WORDS=<words.jsonl> AUTOSPLIT_OUT=<dir> pnpm exec vitest run research/autosplit
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
import { getSyllabificationEngine } from "$/modules/segmentation/utils/syllabification-engines";
import { newLyricWord } from "$/types/ttml";

interface Row {
	file: string;
	word: string;
	parts: string[];
}

const wordsPath = process.env.AUTOSPLIT_WORDS;
const outDir = process.env.AUTOSPLIT_OUT;

const isLetter = (c: string) => /[\p{L}\p{M}]/u.test(c);

/** Boundaries inside the word, ignoring ones next to edge punctuation. */
const boundaries = (word: string, parts: string[]) => {
	const result: number[] = [];
	let offset = 0;
	for (const part of parts.slice(0, -1)) {
		offset += part.length;
		const left = word.slice(0, offset);
		const right = word.slice(offset);
		if ([...left].some(isLetter) && [...right].some(isLetter))
			result.push(offset);
	}
	return result;
};

const songKey = (file: string) =>
	file
		.replace(/\.ttml$/, "")
		.replace(/\s*[-(]\s*(slowed|sped up|reverb|remix|full version).*$/i, "")
		.toLowerCase();

const baseConfig = (engine: SegmentationEngineId): SegmentationConfig => ({
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

const engineForFranc: Record<string, SegmentationEngineId> = {
	eng: "prosodic",
	spa: "silabas",
	fra: "syllabify-fr",
	deu: "hyphenation-de",
	ind: "hyphenation-id",
	ita: "hyphenation-it",
	pol: "hyphenation-pl",
	por: "hyphenation-pt",
	rus: "syllabify",
};

it.skipIf(!wordsPath || !outDir)(
	"autosplit corpus evaluation",
	{ timeout: 600_000 },
	async () => {
		const rows: Row[] = readFileSync(wordsPath as string, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line));

		const byFile = new Map<string, Row[]>();
		for (const row of rows) {
			const list = byFile.get(row.file) ?? [];
			list.push(row);
			byFile.set(row.file, list);
		}

		// Per file: language and how heavily it is split.
		const fileInfo = new Map<
			string,
			{ lang: string; density: number; latin: boolean }
		>();
		for (const [file, list] of byFile) {
			const text = list.map((r) => r.word).join(" ");
			const letters = [...text].filter(isLetter);
			const latin =
				letters.filter((c) => /\p{Script=Latin}/u.test(c)).length >
				letters.length * 0.8;
			const long = list.filter((r) => [...r.word].filter(isLetter).length >= 5);
			const density =
				long.filter((r) => r.parts.length > 1).length /
				Math.max(1, long.length);
			const lang = /\p{Script=Cyrillic}/u.test(text)
				? "rus"
				: franc(text, { minLength: 20 });
			fileInfo.set(file, { lang, density, latin });
		}

		const hyphenators = new Map<string, (t: string) => string>();
		for (const lang of ["en-us", "de", "es", "fr", "it", "pt", "pl", "id"]) {
			const fn = await loadHyphenator(lang);
			if (fn) hyphenators.set(lang, fn);
		}

		const predict = (word: string, engine: SegmentationEngineId) => {
			const config = baseConfig(engine);
			if (engine.startsWith("hyphenation-"))
				config.hyphenator = hyphenators.get(engine.slice(12));
			const out = segmentWord(
				{ ...newLyricWord(), word, startTime: 0, endTime: 1000 },
				config,
			);
			return out.map((w) => w.word);
		};

		// Corpus lexicon: majority split of each lowercased word in *other* songs.
		const lexicon = new Map<string, Map<string, Map<string, number>>>();
		for (const row of rows) {
			const key = row.word.toLowerCase().replace(/[^\p{L}\p{M}'’]/gu, "");
			if (!key) continue;
			const song = songKey(row.file);
			const b = boundaries(row.word, row.parts).join(",");
			const bySong = lexicon.get(key) ?? new Map();
			const counts = bySong.get(song) ?? new Map();
			counts.set(b, (counts.get(b) ?? 0) + 1);
			bySong.set(song, counts);
			lexicon.set(key, bySong);
		}
		const lexiconLookup = (word: string, song: string, splitOnly: boolean) => {
			const key = word.toLowerCase().replace(/[^\p{L}\p{M}'’]/gu, "");
			const bySong = lexicon.get(key);
			if (!bySong) return undefined;
			// One vote per other song, so repeated choruses don't dominate.
			const votes = new Map<string, number>();
			for (const [other, counts] of bySong) {
				if (other === song) continue;
				let best = "";
				let bestCount = -1;
				for (const [b, n] of counts)
					if (n > bestCount) [best, bestCount] = [b, n];
				votes.set(best, (votes.get(best) ?? 0) + 1);
			}
			if (votes.size === 0) return undefined;
			if (splitOnly) votes.delete("");
			if (votes.size === 0) return undefined;
			const [best] = [...votes].sort((a, b) => b[1] - a[1])[0];
			return best ? best.split(",").map(Number) : [];
		};

		type Score = {
			words: number;
			exact: number;
			safe: number; // every predicted boundary is in gold
			goldSplit: number;
			goldSplitExact: number;
			tp: number;
			fp: number;
			fn: number;
			covered: number;
		};
		const empty = (): Score => ({
			words: 0,
			exact: 0,
			safe: 0,
			goldSplit: 0,
			goldSplitExact: 0,
			tp: 0,
			fp: 0,
			fn: 0,
			covered: 0,
		});
		const scores = new Map<string, Score>();
		const errors = new Map<string, Map<string, number>>();
		const add = (
			bucket: string,
			word: string,
			gold: number[],
			pred: number[] | undefined,
		) => {
			const score = scores.get(bucket) ?? empty();
			scores.set(bucket, score);
			score.words++;
			if (gold.length > 0) score.goldSplit++;
			if (!pred) return;
			score.covered++;
			const g = new Set(gold);
			const p = new Set(pred);
			const tp = pred.filter((b) => g.has(b)).length;
			score.tp += tp;
			score.fp += p.size - tp;
			score.fn += g.size - tp;
			const exact = tp === g.size && tp === p.size;
			if (exact) score.exact++;
			if (tp === p.size) score.safe++;
			if (gold.length > 0 && exact) score.goldSplitExact++;
			if (!exact && gold.length > 0) {
				const key = `${cut(word, gold)} <- ${cut(word, pred)}`;
				const errs = errors.get(bucket) ?? new Map();
				errs.set(key, (errs.get(key) ?? 0) + 1);
				errors.set(bucket, errs);
			}
		};
		const cut = (word: string, b: number[]) => {
			let out = "";
			let start = 0;
			for (const end of b) {
				out += `${word.slice(start, end)}/`;
				start = end;
			}
			return (out + word.slice(start)).toLowerCase();
		};

		const engines: SegmentationEngineId[] = [
			"prosodic",
			"hyphenation-en-us",
			"none",
		];
		const englishTypes = new Map<string, number>();

		for (const row of rows) {
			const info = fileInfo.get(row.file);
			if (!info?.latin) continue;
			const letters = [...row.word].filter(isLetter).length;
			if (letters < 2) continue;
			if (info.density < 0.5) continue; // whole-word or lightly split files
			const gold = boundaries(row.word, row.parts);
			const song = songKey(row.file);
			const lang = info.lang;
			const group = lang === "eng" ? "eng" : `other:${lang}`;
			if (lang === "eng") {
				const key = row.word.toLowerCase();
				englishTypes.set(key, (englishTypes.get(key) ?? 0) + 1);
				for (const engine of engines) {
					const pred = boundaries(row.word, predict(row.word, engine));
					add(`eng/${engine}`, row.word, gold, pred);
				}
				const detailed = getSyllabificationEngine("prosodic").splitDetailed?.(
					row.word.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, ""),
				);
				const pros0 = boundaries(row.word, predict(row.word, "prosodic"));
				add(
					`eng/prosodic-${detailed?.unsure ? "unsure" : "sure"}`,
					row.word,
					gold,
					pros0,
				);
				const lex = lexiconLookup(row.word, song, false);
				add("eng/lexicon-only", row.word, gold, lex);
				const pros = boundaries(row.word, predict(row.word, "prosodic"));
				add("eng/lexicon+prosodic", row.word, gold, lex ?? pros);
			} else {
				const engine = engineForFranc[lang];
				if (engine) {
					const pred = boundaries(row.word, predict(row.word, engine));
					add(`${group}/${engine}`, row.word, gold, pred);
				}
				add(`${group}/none`, row.word, gold, []);
				add(
					`${group}/lexicon+engine`,
					row.word,
					gold,
					lexiconLookup(row.word, song, false) ??
						(engine ? boundaries(row.word, predict(row.word, engine)) : []),
				);
			}
		}

		const table = [...scores]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([bucket, s]) => {
				const precision = s.tp / Math.max(1, s.tp + s.fp);
				const recall = s.tp / Math.max(1, s.tp + s.fn);
				return {
					bucket,
					words: s.words,
					coverage: +(s.covered / s.words).toFixed(3),
					exact: +(s.exact / Math.max(1, s.covered)).toFixed(3),
					safe: +(s.safe / Math.max(1, s.covered)).toFixed(3),
					goldSplitExact: +(
						s.goldSplitExact / Math.max(1, s.goldSplit)
					).toFixed(3),
					precision: +precision.toFixed(3),
					recall: +recall.toFixed(3),
					f1: +((2 * precision * recall) / (precision + recall || 1)).toFixed(
						3,
					),
				};
			});
		console.table(table);

		const files = [...fileInfo].map(([file, info]) => ({ file, ...info }));
		writeFileSync(
			join(outDir as string, "results.json"),
			JSON.stringify({ table, files }, null, 1),
		);
		const errorDump: Record<string, [string, number][]> = {};
		for (const [bucket, errs] of errors)
			errorDump[bucket] = [...errs].sort((a, b) => b[1] - a[1]).slice(0, 150);
		writeFileSync(
			join(outDir as string, "errors.json"),
			JSON.stringify(errorDump, null, 1),
		);
	},
);
