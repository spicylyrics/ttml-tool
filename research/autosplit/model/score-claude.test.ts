/**
 * Scores a hand-made split list (one annotator, e.g. Claude in TX24's style)
 * against TX24's labels, next to the rules on the same words.
 *
 * LABELS_DIR=<label JSON dir> SPLITS=<claude-splits.json> [REPORT=<out.md>]
 *   pnpm exec vitest run research/autosplit/model/score-claude
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";

const labelsDir = process.env.LABELS_DIR;
const splitsPath = process.env.SPLITS;

const rules = (word: string) =>
	segmentWord(
		{ ...newLyricWord(), word, endTime: 1000 },
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
		.join("/")
		.toLowerCase();

it.skipIf(!labelsDir || !splitsPath)(
	"score hand-made splits against labels",
	() => {
		const labels = new Map<string, { def: string; accepted: Set<string> }>();
		for (const file of readdirSync(labelsDir as string)) {
			const doc = JSON.parse(
				readFileSync(join(labelsDir as string, file), "utf8"),
			);
			const data = doc.data ?? doc;
			if (data.skip || !data.def) continue;
			const accepted = new Set<string>(
				(data.accepted ?? []).map((a: { split: string }) =>
					a.split.toLowerCase(),
				),
			);
			accepted.add(String(data.def).toLowerCase());
			labels.set(String(data.word).toLowerCase(), {
				def: String(data.def).toLowerCase(),
				accepted,
			});
		}
		const list: { word: string; split: string; unsure: boolean }[] = JSON.parse(
			readFileSync(splitsPath as string, "utf8"),
		).words;
		const tally = () => ({ n: 0, exact: 0, acceptable: 0 });
		const mine = tally();
		const theirs = tally();
		const unsure = tally();
		const disagreements: string[] = [];
		for (const entry of list) {
			const label = labels.get(entry.word.toLowerCase());
			if (!label) continue;
			const split = entry.split.toLowerCase();
			const r = rules(entry.word);
			for (const [t, s] of [
				[mine, split],
				[theirs, r],
			] as const) {
				t.n++;
				if (s === label.def) t.exact++;
				if (label.accepted.has(s)) t.acceptable++;
			}
			if (entry.unsure) {
				unsure.n++;
				if (label.accepted.has(split)) unsure.acceptable++;
			}
			if (!label.accepted.has(split))
				disagreements.push(
					`${entry.word}: me ${split}, rules ${r}, you ${label.def}`,
				);
		}
		const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;
		const report = [
			"# Hand-made splits vs your labels",
			"",
			`${mine.n} words appear in both the list and your labels.`,
			"",
			"| | exact (your pick) | acceptable (any you marked right) |",
			"|---|---|---|",
			`| Claude | ${pct(mine.exact, mine.n)} | ${pct(mine.acceptable, mine.n)} |`,
			`| Rules (#263) | ${pct(theirs.exact, theirs.n)} | ${pct(theirs.acceptable, theirs.n)} |`,
			"",
			`Words I marked unsure: ${unsure.n}, acceptable ${unsure.n ? pct(unsure.acceptable, unsure.n) : "-"}.`,
			"",
			`## Where I'm not acceptable (${disagreements.length})`,
			"",
			...disagreements.map((d) => `- ${d}`),
			"",
		].join("\n");
		if (process.env.REPORT) writeFileSync(process.env.REPORT, report);
		console.log(report);
	},
);
