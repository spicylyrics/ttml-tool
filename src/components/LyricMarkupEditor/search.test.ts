import { describe, expect, it } from "vitest";
import { type LyricMarkupFormat, parseMarkup } from "./markup";
import {
	applyChanges,
	expandReplacement,
	findMatches,
	keepMarks,
	replacementChanges,
	type SearchOptions,
} from "./search";

const FORMAT: LyricMarkupFormat = {
	mode: "lyric-trans",
	lineSeparatorMode: "interleaved-line",
	lineSeparator: "|",
	swapTransAndRoman: false,
	wordSeparator: "\\",
	enableSpecialPrefix: true,
	bgLyricPrefix: "<",
	duetLyricPrefix: ">",
	makeSections: true,
};

const OPTIONS: SearchOptions = {
	query: "",
	caseSensitive: false,
	wholeWord: false,
	regex: false,
	rows: "all",
};

const SAMPLE = `[Verse 1]
Hel\\lo beau\\ti\\ful world
Hola mundo hermoso
<Beau\\ti\\ful\\ day
Día hermoso`;

function search(
	text: string,
	options: Partial<SearchOptions>,
	format = FORMAT,
) {
	return findMatches(
		text,
		parseMarkup(text, format),
		{ ...OPTIONS, ...options },
		format.wordSeparator,
	);
}

const found = (text: string, options: Partial<SearchOptions>) =>
	search(text, options).matches.map((match) =>
		text.slice(match.from, match.to),
	);

function replaceAll(
	text: string,
	options: Partial<SearchOptions>,
	template: string,
	format = FORMAT,
) {
	const { matches } = search(text, options, format);
	return applyChanges(
		text,
		replacementChanges(
			text,
			matches,
			template,
			{ ...OPTIONS, ...options },
			format.wordSeparator,
		),
	);
}

describe("lyric search", () => {
	it("matches across split marks and covers them in the range", () => {
		expect(found(SAMPLE, { query: "beautiful" })).toEqual([
			"beau\\ti\\ful",
			"Beau\\ti\\ful",
		]);
		expect(found(SAMPLE, { query: "lo beau" })).toEqual(["lo beau"]);
	});

	it("looks at the marks as written when the search contains one", () => {
		expect(found(SAMPLE, { query: "ti\\ful" })).toEqual(["ti\\ful", "ti\\ful"]);
		expect(found(SAMPLE, { query: "beautiful\\" })).toEqual([]);
	});

	it("never starts or ends a match on a mark", () => {
		const [match] = search("ab\\cd", { query: "b" }).matches;
		expect(match.to - match.from).toBe(1);
	});

	it("never searches section headers or line prefixes", () => {
		expect(found(SAMPLE, { query: "verse" })).toEqual([]);
		expect(found(SAMPLE, { query: "<" })).toEqual([]);
	});

	it("limits to lyric or translation rows", () => {
		expect(found(SAMPLE, { query: "hermoso", rows: "lyrics" })).toEqual([]);
		expect(found(SAMPLE, { query: "hermoso", rows: "translations" })).toEqual([
			"hermoso",
			"hermoso",
		]);
		expect(found(SAMPLE, { query: "world", rows: "translations" })).toEqual([]);
	});

	it("reads same-line translations as translation rows", () => {
		const format: LyricMarkupFormat = {
			...FORMAT,
			lineSeparatorMode: "same-line-separator",
		};
		const text = "my\\ wor\\ld|mi mundo";
		const rows = (rows: SearchOptions["rows"]) =>
			search(text, { query: "m", rows }, format).matches.map(
				(match) => match.row,
			);
		expect(rows("all")).toEqual(["lyric", "translation", "translation"]);
		expect(rows("lyrics")).toEqual(["lyric"]);
		expect(rows("translations")).toEqual(["translation", "translation"]);
		// The separator between the two parts is never part of a match.
		expect(search(text, { query: "d|m" }, format).matches).toEqual([]);
	});

	it("matches case and whole words when asked", () => {
		expect(found(SAMPLE, { query: "beautiful", caseSensitive: true })).toEqual([
			"beau\\ti\\ful",
		]);
		expect(found("Hello helloo hello", { query: "hello" })).toHaveLength(3);
		expect(
			found("Hello helloo hello", { query: "hello", wholeWord: true }),
		).toEqual(["Hello", "hello"]);
		// Letters outside ASCII still count as part of a word.
		expect(found("café caf", { query: "caf", wholeWord: true })).toEqual([
			"caf",
		]);
	});

	it("runs regular expressions on the text without marks", () => {
		expect(found(SAMPLE, { query: "b\\w+l", regex: true })).toEqual([
			"beau\\ti\\ful",
			"Beau\\ti\\ful",
		]);
		expect(found(SAMPLE, { query: "^h\\w+", regex: true })).toEqual([
			"Hel\\lo",
			"Hola",
		]);
	});

	it("reports a broken pattern instead of throwing", () => {
		expect(search(SAMPLE, { query: "(", regex: true })).toEqual({
			matches: [],
			error: "invalid",
		});
	});

	it("skips zero-width matches without hanging", () => {
		expect(found("abc", { query: "x*", regex: true })).toEqual([]);
	});

	it("keeps only the matches inside a range", () => {
		const start = SAMPLE.indexOf("<");
		expect(
			found(SAMPLE, {
				query: "beautiful",
				within: { from: start, to: SAMPLE.length },
			}),
		).toEqual(["Beau\\ti\\ful"]);
	});
});

describe("lyric replace", () => {
	it("keeps marks on letters that didn't change", () => {
		expect(keepMarks("col\\our", "colour", "color", "\\")).toBe("col\\or");
		expect(keepMarks("beau\\ti\\ful", "beautiful", "Beautiful", "\\")).toBe(
			"Beau\\ti\\ful",
		);
		// The mark inside the changed letters goes.
		expect(keepMarks("ab\\cd", "abcd", "axyd", "\\")).toBe("axyd");
		// A replacement with its own marks is used as written.
		expect(keepMarks("col\\our", "colour", "co\\lor", "\\")).toBe("co\\lor");
	});

	it("never leaves a mark at either end of the replacement", () => {
		expect(keepMarks("a\\bc", "abc", "bc", "\\")).toBe("bc");
	});

	it("keeps the space mark between two words", () => {
		expect(
			replaceAll("my\\ \\wor\\ld", { query: "my world" }, "My world"),
		).toBe("My\\ \\wor\\ld");
	});

	it("replaces every match and leaves other rows alone", () => {
		expect(
			replaceAll(SAMPLE, { query: "hermoso", rows: "translations" }, "bonito"),
		).toBe(SAMPLE.split("hermoso").join("bonito"));
		// "ful" didn't change, so the mark before it stays.
		expect(replaceAll(SAMPLE, { query: "beautiful" }, "wonderful")).toBe(
			SAMPLE.replace("beau\\ti\\ful", "wonder\\ful").replace(
				"Beau\\ti\\ful",
				"wonder\\ful",
			),
		);
	});

	it("fills in regex groups", () => {
		expect(
			replaceAll(
				"Hola mundo",
				{ query: "(\\w+) (\\w+)", regex: true },
				"$2 $1",
			),
		).toBe("mundo Hola");
		const [match] = search("abc", { query: "(?<x>b)", regex: true }).matches;
		expect(expandReplacement("[$<x>|$&|$$|$1|$9]", match, true)).toBe(
			"[b|b|$|b|$9]",
		);
		// Plain replacements never read $ tokens.
		expect(expandReplacement("$1", match, false)).toBe("$1");
	});
});
