import { describe, expect, it } from "vitest";
import {
	englishSyllableFixture,
	parseSyllableFixture,
	type SyllableFixtureEntry,
} from "../data/english-syllable-fixture";
import prosodicDictionary from "../data/prosodic-dict.json";
import { splitEnglishByRules } from "./english-rules";
import {
	getSyllabificationEngine,
	splitEnglishWithRules,
} from "./syllabification-engines";

type Splitter = (word: string) => string[];

const boundariesOf = (parts: readonly string[]) => {
	const result = new Set<number>();
	let offset = 0;
	for (const part of parts.slice(0, -1)) {
		offset += part.length;
		result.add(offset);
	}
	return result;
};

const sameSplit = (left: readonly string[], right: readonly string[]) =>
	left.length === right.length &&
	left.every(
		(part, index) => part.toLowerCase() === right[index].toLowerCase(),
	);

/** Exact-match rate, plus boundary precision/recall against the first accepted split. */
const score = (entries: SyllableFixtureEntry[], split: Splitter) => {
	let exact = 0;
	let truePositive = 0;
	let predicted = 0;
	let expected = 0;
	let rightCount = 0;
	const misses: string[] = [];
	for (const { word, accepted } of entries) {
		const result = split(word);
		const match = accepted.find((candidate) => sameSplit(candidate, result));
		if (match) exact++;
		else misses.push(`${word}: ${result.join("|")}`);
		if (accepted.some((candidate) => candidate.length === result.length))
			rightCount++;
		const reference = match ?? accepted[0];
		const got = boundariesOf(result);
		const want = boundariesOf(reference);
		predicted += got.size;
		expected += want.size;
		for (const boundary of got) if (want.has(boundary)) truePositive++;
	}
	const percent = (value: number, total: number) =>
		total === 0 ? 100 : Math.round((value / total) * 1000) / 10;
	return {
		exact: percent(exact, entries.length),
		count: percent(rightCount, entries.length),
		precision: percent(truePositive, predicted),
		recall: percent(truePositive, expected),
		misses,
	};
};

const dictionary = prosodicDictionary as Record<string, number | number[]>;
const tuning = parseSyllableFixture(englishSyllableFixture.tuning);
const holdout = parseSyllableFixture(englishSyllableFixture.holdout);
const prosodic = getSyllabificationEngine("prosodic").split;
const rules: Splitter = (word) => splitEnglishByRules(word) ?? [word];
/** Dictionary first, rules for words it doesn't have (instead of the speech fallback). */
const dictionaryThenRules: Splitter = (word) =>
	dictionary[word.toLowerCase()] !== undefined ? prosodic(word) : rules(word);

describe("English rule-based syllables", () => {
	it("splits representative words", () => {
		expect(rules("happy")).toEqual(["hap", "py"]);
		expect(rules("Dancing")).toEqual(["Danc", "ing"]);
		expect(rules("wanted")).toEqual(["want", "ed"]);
		expect(rules("loved")).toEqual(["loved"]);
		expect(rules("table")).toEqual(["ta", "ble"]);
		expect(rules("something")).toEqual(["some", "thing"]);
		expect(rules("couldn't")).toEqual(["could", "n't"]);
		expect(rules("don't")).toEqual(["don't"]);
		expect(rules("singin'")).toEqual(["sing", "in'"]);
		expect(rules("time")).toEqual(["time"]);
	});

	it("leaves anything it can't read to the caller", () => {
		expect(splitEnglishByRules("café")).toBeNull();
		expect(splitEnglishByRules("2night")).toBeNull();
	});

	it("joins back to the original word", () => {
		for (const { word } of [...tuning, ...holdout]) {
			expect(rules(word).join("")).toBe(word);
		}
	});

	it("benchmarks against the hand-split fixture", () => {
		const fixtureWords = [...tuning, ...holdout];
		const inDictionary = fixtureWords.filter(
			({ word }) => dictionary[word.toLowerCase()] !== undefined,
		);
		const engines: Array<[string, Splitter]> = [
			["current (dictionary + speech fallback)", prosodic],
			["rules", rules],
			["dictionary, then rules", dictionaryThenRules],
			["flagged path (rules, then current)", splitEnglishWithRules],
		];
		const rows = engines.flatMap(([name, split]) =>
			(
				[
					["tuning", tuning],
					["holdout", holdout],
				] as const
			).map(([set, entries]) => ({ name, set, ...score(entries, split) })),
		);
		const dictionaryOnly = score(inDictionary, prosodic);
		console.info(
			[
				`dictionary: ${Object.keys(dictionary).length} entries; covers ${inDictionary.length}/${fixtureWords.length} fixture words; on those, exact ${dictionaryOnly.exact}%, right syllable count ${dictionaryOnly.count}%`,
				...rows.map(
					(row) =>
						`${row.name} [${row.set}]: exact ${row.exact}%, count ${row.count}%, boundary P ${row.precision}% R ${row.recall}%`,
				),
				`rules holdout misses: ${rows.find((row) => row.name === "rules" && row.set === "holdout")?.misses.join(", ")}`,
				`current holdout misses: ${rows.find((row) => row.name.startsWith("current") && row.set === "holdout")?.misses.join(", ")}`,
			].join("\n"),
		);

		// Floors measured when the rules were written; raise them, don't lower them.
		const rulesRow = (set: string) =>
			rows.find((row) => row.name === "rules" && row.set === set);
		expect(rulesRow("tuning")?.exact).toBeGreaterThanOrEqual(98);
		expect(rulesRow("holdout")?.exact).toBeGreaterThanOrEqual(89);
		expect(rulesRow("holdout")?.count).toBe(100);
	});
});
