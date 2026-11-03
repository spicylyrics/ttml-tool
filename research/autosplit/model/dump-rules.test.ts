/**
 * Writes the rules' split for every voted word, so the Python scorer can
 * compare a model against them without running the engine.
 *
 * VOTES=<votes.jsonl> RULES_OUT=<rules.json> pnpm exec vitest run research/autosplit/model/dump-rules
 */
import { readFileSync, writeFileSync } from "node:fs";
import { it } from "vitest";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";

const votesPath = process.env.VOTES;
const outPath = process.env.RULES_OUT;

it.skipIf(!votesPath || !outPath)("dump rules splits", () => {
	const out: Record<string, string> = {};
	for (const line of readFileSync(votesPath as string, "utf8")
		.split("\n")
		.filter(Boolean)) {
		const word = String(JSON.parse(line).word);
		out[word] = segmentWord(
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
			.join("/");
	}
	writeFileSync(outPath as string, JSON.stringify(out));
});
