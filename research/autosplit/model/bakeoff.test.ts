/**
 * Does a per-cut model trained on TX24's splits beat the current rules?
 *
 * 1. Distill: train the model to reproduce the rules (dictionary lookup,
 *    speech fallback, n't / -in' / compounds) over a broad word list, and check
 *    it agrees with them on words it never saw. The prosodic dictionary alone is
 *    a poor target: it only lists words the speech fallback gets wrong.
 * 2. 5-fold: fine-tune the distilled model on 4/5 of TX24's splits (labels,
 *    plus local votes when given) and score the other 1/5 against the rules.
 *    Acronyms, digits, symbols and apostrophe words always go to the rules.
 * 3. Unsure band of the fine-tuned model: a cut between 35% and 65% sure.
 *
 * LABELS_DIR=<label JSON dir> CORPUS_WORDS=<words.jsonl> VOTE_WORDS=<words.json>
 *   [VOTES=<votes.jsonl>] MODEL_OUT=<dir> pnpm exec vitest run research/autosplit/model/bakeoff
 *
 * The weights come from the rules, which use the prosodic dictionary (AGPL,
 * adapted from amll-editor), so they stay out of this repo.
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import prosodicDictionary from "$/modules/segmentation/data/prosodic-dict.json";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";
import {
	cutProbabilities,
	cutsOf,
	type Example,
	type Model,
	predictCuts,
	splitAt,
	trainModel,
} from "./model";

const labelsDir = process.env.LABELS_DIR;
const corpusPath = process.env.CORPUS_WORDS;
const voteWordsPath = process.env.VOTE_WORDS;
const votesPath = process.env.VOTES;
const outDir = process.env.MODEL_OUT;

const dictionary = new Set(Object.keys(prosodicDictionary));

const hash = (text: string) => {
	let h = 2166136261;
	for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
	return h;
};

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

/** Words the model leaves to the rules: acronyms, digits, symbols, apostrophes. */
const ruleOnly = (original: string) =>
	/^[A-Z]{2,4}$/.test(original) || /[^\p{L}]/u.test(original);

/** Words the vote no longer uses: dashed (processing splits there) or stretched. */
const outOfDomain = (word: string) =>
	/[-/]/.test(word) || /(\p{L})\1\1/iu.test(word);

interface Gold {
	original: string;
	word: string;
	def: string;
	accepted: Set<string>;
	source: "label" | "vote";
}

function loadGold() {
	const gold = new Map<string, Gold>();
	let dropped = 0;
	for (const file of readdirSync(labelsDir as string)) {
		const doc = JSON.parse(
			readFileSync(join(labelsDir as string, file), "utf8"),
		);
		const data = doc.data ?? doc;
		const original = String(data.word);
		const word = original.toLowerCase();
		if (data.skip || !data.def || outOfDomain(word)) {
			dropped++;
			continue;
		}
		const accepted = new Set<string>(
			(data.accepted ?? []).map((a: { split: string }) =>
				a.split.toLowerCase(),
			),
		);
		accepted.add(String(data.def).toLowerCase());
		gold.set(word, {
			original,
			word,
			def: String(data.def).toLowerCase(),
			accepted,
			source: "label",
		});
	}
	// Votes are newer than the labels, so they replace them.
	if (votesPath && existsSync(votesPath)) {
		for (const line of readFileSync(votesPath, "utf8")
			.split("\n")
			.filter(Boolean)) {
			const vote = JSON.parse(line);
			if (vote.skipped || !vote.pick) continue;
			const original = String(vote.word);
			const word = original.toLowerCase();
			const splits = [...vote.ticked, vote.pick, vote.custom]
				.filter(Boolean)
				.map((s: string) => s.toLowerCase())
				.filter((s: string) => s.replaceAll("/", "") === word);
			if (
				outOfDomain(word) ||
				!splits.includes(String(vote.pick).toLowerCase())
			)
				continue;
			gold.set(word, {
				original,
				word,
				def: String(vote.pick).toLowerCase(),
				accepted: new Set(splits),
				source: "vote",
			});
		}
	}
	return { gold: [...gold.values()], dropped };
}

/** Every word the model should know: dictionary, TTML words, vote words. */
function broadWordList() {
	const words = new Set<string>(dictionary);
	if (corpusPath)
		for (const line of readFileSync(corpusPath, "utf8")
			.split("\n")
			.filter(Boolean)) {
			const core = String(JSON.parse(line).word)
				.toLowerCase()
				.replace(/’/g, "'")
				.replace(/^[^\p{L}']+|[^\p{L}']+$/gu, "");
			words.add(core);
		}
	if (voteWordsPath)
		for (const w of JSON.parse(readFileSync(voteWordsPath, "utf8")).words)
			words.add(String(w.word).toLowerCase());
	return [...words].filter(
		(w) => /^[\p{L}']{2,24}$/u.test(w) && /\p{L}/u.test(w),
	);
}

interface Tally {
	n: number;
	exact: number;
	acceptable: number;
	tp: number;
	fp: number;
	fn: number;
}
const tally = (): Tally => ({
	n: 0,
	exact: 0,
	acceptable: 0,
	tp: 0,
	fp: 0,
	fn: 0,
});
function add(t: Tally, predicted: string, def: string, accepted: Set<string>) {
	t.n++;
	if (predicted === def) t.exact++;
	if (accepted.has(predicted)) t.acceptable++;
	const p = new Set(cutsOf(predicted));
	const d = new Set(cutsOf(def));
	for (const c of p)
		if (d.has(c)) t.tp++;
		else t.fp++;
	for (const c of d) if (!p.has(c)) t.fn++;
}
const pct = (a: number, b: number) =>
	b ? `${((100 * a) / b).toFixed(1)}%` : "-";
const row = (name: string, t: Tally) =>
	`| ${name} | ${t.n} | ${pct(t.exact, t.n)} | ${pct(t.acceptable, t.n)} | ${pct(t.tp, t.tp + t.fp)} | ${pct(t.tp, t.tp + t.fn)} |`;
const HEAD =
	"| | words | exact (your pick) | acceptable (any you marked right) | cut precision | cut recall |\n|---|---|---|---|---|---|";

const toExample = (word: string, split: string, weight = 1): Example => {
	const set = new Set(cutsOf(split));
	return {
		word,
		targets: [...word].slice(1).map((_, k) => (set.has(k + 1) ? 1 : 0)),
		weight,
	};
};

const modelSplit = (model: Model, word: string) =>
	splitAt(word, predictCuts(model, word).cuts);

it.skipIf(!labelsDir || !outDir)(
	"per-cut model bake-off",
	{ timeout: 3_600_000 },
	() => {
		mkdirSync(outDir as string, { recursive: true });
		const report: string[] = ["# Per-cut model bake-off", ""];
		const { gold, dropped } = loadGold();
		const goldWords = new Set(gold.map((g) => g.word));

		// 1. Distill the rules over a broad word list, gold words left out.
		const broad = broadWordList().filter((w) => !goldWords.has(w));
		const targets = new Map(broad.map((w) => [w, rules(w)] as const));
		const usable = broad.filter(
			(w) => targets.get(w)?.replaceAll("/", "") === w,
		);
		const distillTest = usable.filter((w) => hash(w) % 10 === 0);
		const distillTrain = usable.filter((w) => hash(w) % 10 !== 0);
		const probe = trainModel(
			distillTrain.map((w) => toExample(w, targets.get(w) as string)),
		);
		let agree = 0;
		let agreeOov = 0;
		let oov = 0;
		for (const w of distillTest) {
			const same = modelSplit(probe, w) === targets.get(w);
			if (same) agree++;
			if (!dictionary.has(w)) {
				oov++;
				if (same) agreeOov++;
			}
		}
		report.push(
			"## 1. Learning the current rules",
			"",
			`Trained to copy the rules on ${distillTrain.length} words (dictionary, TTML words, vote words; your words left out). On ${distillTest.length} words it never saw, it gives the same split as the rules ${pct(agree, distillTest.length)} of the time (${pct(agreeOov, oov)} on words outside the dictionary).`,
			"",
			"The prosodic dictionary alone is a poor target: it only lists words the speech fallback gets wrong, so the fallback matches it 0% of the time by construction.",
			"",
		);
		const distilled = trainModel(
			usable.map((w) => toExample(w, targets.get(w) as string)),
		);
		// The same, but the model also sees the rules' cut at each gap, so it only
		// has to learn when to overrule them.
		const withRules = (example: Example, ruleSplit: string): Example => ({
			...example,
			ruleSplit,
		});
		const distilledR = trainModel(
			usable.map((w) =>
				withRules(
					toExample(w, targets.get(w) as string),
					targets.get(w) as string,
				),
			),
		);

		// 2. 5-fold fine-tune on TX24's splits.
		const sets = {
			"in dictionary": {
				rules: tally(),
				distilled: tally(),
				tuned: tally(),
				overrule: tally(),
			},
			"not in dictionary": {
				rules: tally(),
				distilled: tally(),
				tuned: tally(),
				overrule: tally(),
			},
		};
		const flagged = { right: 0, wrong: 0 };
		const clear = { right: 0, wrong: 0 };
		const changes: string[] = [];
		for (let fold = 0; fold < 5; fold++) {
			const test = gold.filter((g) => hash(g.word) % 5 === fold);
			const train = gold.filter(
				(g) => hash(g.word) % 5 !== fold && !ruleOnly(g.original),
			);
			const tuned = trainModel(
				train.map((g) => toExample(g.word, g.def, 3)),
				{ start: distilled, epochs: 4, rate: 0.1 },
			);
			const overruler = trainModel(
				train.map((g) =>
					withRules(toExample(g.word, g.def, 3), rules(g.original)),
				),
				{ start: distilledR, epochs: 4, rate: 0.1 },
			);
			for (const g of test) {
				const group =
					sets[dictionary.has(g.word) ? "in dictionary" : "not in dictionary"];
				const r = rules(g.original);
				const routed = (m: Model) =>
					ruleOnly(g.original) ? r : modelSplit(m, g.word);
				const t = ruleOnly(g.original)
					? r
					: splitAt(g.word, predictCuts(overruler, g.word, 0.5, r).cuts);
				add(group.rules, r, g.def, g.accepted);
				add(group.distilled, routed(distilled), g.def, g.accepted);
				add(group.tuned, routed(tuned), g.def, g.accepted);
				add(group.overrule, t, g.def, g.accepted);
				if (!ruleOnly(g.original)) {
					const unsure = cutProbabilities(overruler, g.word, r).some(
						(p) => p >= 0.35 && p <= 0.65,
					);
					const bucket = unsure ? flagged : clear;
					if (g.accepted.has(t)) bucket.right++;
					else bucket.wrong++;
				}
				const rOk = g.accepted.has(r);
				const tOk = g.accepted.has(t);
				if (rOk !== tOk)
					changes.push(
						`${tOk ? "fixed" : "broke"} ${g.word}: rules ${r}, model ${t}, you ${g.def}`,
					);
			}
		}
		report.push(
			"## 2. Learning from your splits (5-fold)",
			"",
			`${gold.length} of your words (${gold.filter((g) => g.source === "label").length} labels, ${gold.filter((g) => g.source === "vote").length} votes; ${dropped} skipped, dashed or stretched left out). Each fifth is scored by a model fine-tuned on the other four fifths. Acronyms, digits, symbols and apostrophe words go to the rules in every row. Rules are \`fix/autosplit-rules\` (#263).`,
			"",
		);
		for (const [name, t] of Object.entries(sets))
			report.push(
				`### ${name}`,
				"",
				HEAD,
				row("Rules", t.rules),
				row("Model copying the rules", t.distilled),
				row("Model fine-tuned on your splits", t.tuned),
				row(
					"Model overruling the rules, fine-tuned on your splits",
					t.overrule,
				),
				"",
			);
		const flaggedN = flagged.right + flagged.wrong;
		const clearN = clear.right + clear.wrong;
		report.push(
			"## 3. Unsure band (model overruling the rules)",
			"",
			`Flagged when any cut is between 35% and 65% sure: ${pct(flaggedN, flaggedN + clearN)} of words. Wrong when flagged: ${pct(flagged.wrong, flaggedN)}. Wrong otherwise: ${pct(clear.wrong, clearN)}.`,
			"",
			`## Where that model and the rules disagree on right vs wrong (${changes.filter((c) => c.startsWith("fixed")).length} fixed, ${changes.filter((c) => c.startsWith("broke")).length} broke)`,
			"",
			...changes.sort().map((c) => `- ${c}`),
			"",
		);
		writeFileSync(join(outDir as string, "report.md"), report.join("\n"));

		const final = trainModel(
			gold
				.filter((g) => !ruleOnly(g.original))
				.map((g) => withRules(toExample(g.word, g.def, 3), rules(g.original))),
			{ start: distilledR, epochs: 4, rate: 0.1 },
		);
		const sparse: Record<number, number> = {};
		final.weights.forEach((w, k) => {
			if (Math.abs(w) > 1e-4) sparse[k] = Number(w.toFixed(4));
		});
		writeFileSync(
			join(outDir as string, "model.json"),
			JSON.stringify({ bits: final.bits, weights: sparse }),
		);
		console.log(report.join("\n"));
	},
);
