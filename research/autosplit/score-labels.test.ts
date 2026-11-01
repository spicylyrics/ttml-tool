/**
 * Scores the current engine against hand labels exported from the Sung
 * syllable splits artifact (one JSON file per word). Writes word, prediction
 * and the accepted splits, so two engine versions can be compared.
 *
 * LABELS_DIR=<dir of label JSON> LABELS_OUT=<out.json> pnpm exec vitest run research/autosplit/score-labels
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";

const dir = process.env.LABELS_DIR;
const out = process.env.LABELS_OUT;

it.skipIf(!dir || !out)("score against labels", () => {
	const rows = [];
	for (const file of readdirSync(dir as string)) {
		const doc = JSON.parse(readFileSync(join(dir as string, file), "utf8"));
		const data = doc.data ?? doc;
		const pred = segmentWord(
			{ ...newLyricWord(), word: data.word, endTime: 1000 },
			{
				engine: "prosodic",
				splitCJK: true,
				splitEnglish: true,
				punctuationWeight: 0.2,
				punctuationMode: "merge",
				removeEmptySegments: true,
				ignoreList: new Set(),
				customRules: new Map(),
				learnedRules: new Map(),
			},
		)
			.map((w) => w.word)
			.join("/");
		rows.push({
			word: data.word,
			category: data.category,
			pred,
			accepted: (data.accepted ?? []).map((a: { split: string }) => a.split),
			def: data.def,
			skip: data.skip,
			unsure: data.unsure,
		});
	}
	writeFileSync(out as string, JSON.stringify(rows));
});
