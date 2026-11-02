import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { detectWordTimingProblems } from "./detect-word-timing-problems";

const word = (
	id: string,
	text: string,
	startTime: number,
	endTime: number,
) => ({
	...newLyricWord(),
	id,
	word: text,
	startTime,
	endTime,
});

const line = (
	words: ReturnType<typeof word>[],
	startTime = 1000,
	endTime = 2000,
	extra: Partial<LyricLine> = {},
): LyricLine => ({
	...newLyricLine(),
	id: "line",
	startTime,
	endTime,
	words,
	...extra,
});

describe("detectWordTimingProblems", () => {
	it("finds nothing in a clean line, including zero-length words", () => {
		expect(
			detectWordTimingProblems([
				line([
					word("a", "Hel", 1000, 1300),
					word("b", "lo", 1300, 1300),
					word("c", " ", 0, 0),
					word("d", "you", 1500, 2000),
				]),
			]),
		).toEqual([]);
	});

	it("flags a word that starts before its line", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", 900, 1200)])]),
		).toEqual([
			{ lineId: "line", wordId: "a", problems: ["startsBeforeLine"] },
		]);
	});

	it("flags a word that ends after its line", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", 1500, 2100)])]),
		).toEqual([{ lineId: "line", wordId: "a", problems: ["endsAfterLine"] }]);
	});

	it("reports both window problems on one word", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", 500, 2500)])])[0]
				.problems,
		).toEqual(["startsBeforeLine", "endsAfterLine"]);
	});

	it("flags a word that ends before it starts, and nothing else on it", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", 2500, 500)])])[0]
				.problems,
		).toEqual(["endsBeforeStart"]);
	});

	it("flags an untimed sung word in a timed line, and nothing else on it", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", 0, 0)])])[0].problems,
		).toEqual(["untimed"]);
	});

	it("treats non-finite times as untimed", () => {
		expect(
			detectWordTimingProblems([line([word("a", "Hi", Number.NaN, 1200)])])[0]
				.problems,
		).toEqual(["untimed"]);
	});

	it("never flags whitespace-only words", () => {
		expect(
			detectWordTimingProblems([
				line([word("a", "  ", 0, 0), word("b", "", 2500, 100)]),
			]),
		).toEqual([]);
	});

	it("skips untimed, invalid and line-synced lines", () => {
		const bad = [word("a", "Hi", 0, 0)];
		expect(
			detectWordTimingProblems([
				line(bad, 0, 0),
				line(bad, 2000, 1000),
				line(bad, 1000, 2000, { isLineSynced: true }),
			]),
		).toEqual([]);
	});

	it("checks only per-word timing on background lines", () => {
		expect(
			detectWordTimingProblems([
				line(
					[
						word("a", "(oh", 500, 900),
						word("b", "yeah)", 1900, 2600),
						word("c", "no", 0, 0),
						word("d", "wait", 700, 600),
					],
					1000,
					2000,
					{ isBG: true },
				),
			]).map((issue) => [issue.wordId, issue.problems]),
		).toEqual([
			["c", ["untimed"]],
			["d", ["endsBeforeStart"]],
		]);
	});

	it("reports issues in line order with their line ids", () => {
		expect(
			detectWordTimingProblems([
				line([word("a", "Hi", 900, 1200)], 1000, 2000, { id: "one" }),
				line([word("b", "there", 3000, 3500)], 3000, 4000, { id: "two" }),
				line([word("c", "you", 3900, 4100)], 3000, 4000, { id: "three" }),
			]).map((issue) => `${issue.lineId}:${issue.wordId}`),
		).toEqual(["one:a", "three:c"]);
	});
});
