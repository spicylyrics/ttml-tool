import { it } from "vitest";
import prosodic from "$/modules/segmentation/data/prosodic-dict.json";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";

const words = (process.env.PROBE ?? "").split(",");
it.skipIf(!process.env.PROBE)("probe", () => {
	const d = prosodic as Record<string, unknown>;
	for (const w of words) {
		const out = segmentWord(
			{ ...newLyricWord(), word: w, startTime: 0, endTime: 1000 },
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
		).map((x) => x.word);
		const key = w.toLowerCase().replace(/[^a-z']/g, "");
		console.log(
			`${w.padEnd(14)} ${out.join("/").padEnd(18)} dict=${JSON.stringify(d[key] ?? d[key.replace(/'.*$/, "")])}`,
		);
	}
});
