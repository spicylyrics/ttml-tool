import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	buildSpicyLines,
	createSpicyLineBuilder,
	groupSpicyTokens,
	isRtl,
	keyFor,
	type SpicyToken,
	type SpicyWordGroup,
	type SpicyWordProblems,
} from "./model";

const token = (
	id: string,
	spaceAfter = false,
	letters?: string[],
	breakAfter = false,
): SpicyToken => ({
	id,
	text: id,
	startTime: 0,
	endTime: 100,
	letters,
	isBackground: false,
	spaceAfter: spaceAfter || undefined,
	breakAfter: breakAfter || undefined,
});

const flatten = (groups: SpicyWordGroup[]) =>
	groups.flatMap((group) => group.items);

describe("Spicy conversion ownership", () => {
	it("reuses unchanged tokens and keeps grouping equivalent after edits", () => {
		const build = createSpicyLineBuilder();
		const source = Array.from({ length: 8 }, (_, index) => ({
			...newLyricLine(),
			id: `line-${index}`,
			startTime: index * 5000,
			endTime: index * 5000 + 2000,
			isBG: index === 2 || index === 3,
			words: [
				{
					...newLyricWord(),
					word: "Hello ",
					startTime: index * 5000,
					endTime: index * 5000 + 2000,
				},
			],
		}));
		const first = build(source, false, false, false, true, undefined, true);
		const edited = source.map((line, index) =>
			index === 2
				? {
						...line,
						endTime: line.endTime + 250,
						words: line.words.map((word) => ({
							...word,
							endTime: word.endTime + 250,
						})),
					}
				: line,
		);
		const next = build(edited, false, false, false, true, undefined, true);
		expect(next).toEqual(
			buildSpicyLines(edited, false, false, false, true, undefined, true),
		);
		expect(next.find((line) => line.id === "line-7")).toBe(
			first.find((line) => line.id === "line-7"),
		);
		expect(next.find((line) => line.id === "line-2")?.words).not.toBe(
			first.find((line) => line.id === "line-2")?.words,
		);
		const untimed = edited.map((line, index) =>
			index === 0
				? {
						...line,
						startTime: 0,
						endTime: 0,
						words: line.words.map((word) => ({
							...word,
							startTime: 0,
							endTime: 0,
						})),
					}
				: line,
		);
		for (const simple of [false, true]) {
			for (const romanized of [false, true]) {
				expect(
					build(untimed, simple, romanized, true, false, undefined, true),
				).toEqual(
					buildSpicyLines(
						untimed,
						simple,
						romanized,
						true,
						false,
						undefined,
						true,
					),
				);
			}
		}
	});

	it("does not mutate TTML input and preserves token keys across repeated conversion", () => {
		const word = {
			...newLyricWord(),
			id: "word",
			word: "Hi",
			startTime: 100,
			endTime: 600,
		};
		const line = {
			...newLyricLine(),
			id: "line",
			startTime: 100,
			endTime: 600,
			words: [word],
		};
		const input = [line];
		const snapshot = structuredClone(input);
		const first = buildSpicyLines(input, false, false)[0];
		const second = buildSpicyLines(input, false, false)[0];
		expect(input).toEqual(snapshot);
		expect(keyFor(first, first.words[0], 0)).toBe("line:word:0");
		expect(keyFor(second, second.words[0], 0)).toBe(
			keyFor(first, first.words[0], 0),
		);
		expect(keyFor(first, first.words[0], 1)).not.toBe(
			keyFor(first, first.words[0], 0),
		);
	});
});

describe("groupSpicyTokens", () => {
	it("keeps complete words as separate layout items", () => {
		const tokens = [token("one", true), token("two", true), token("three")];
		const groups = groupSpicyTokens(tokens);

		expect(
			groups.map((group) => group.items.map(({ token }) => token.id)),
		).toEqual([["one"], ["two"], ["three"]]);
		expect(groups.map((group) => group.hasTrailingSpace)).toEqual([
			true,
			true,
			false,
		]);
	});

	it("groups connected syllables and includes the final syllable", () => {
		const tokens = [
			token("be"),
			token("au"),
			token("ti"),
			token("ful", true),
			token("day"),
		];
		const groups = groupSpicyTokens(tokens);

		expect(groups).toHaveLength(2);
		expect(groups[0].items.map(({ token }) => token.id)).toEqual([
			"be",
			"au",
			"ti",
			"ful",
		]);
		expect(groups[0].hasTrailingSpace).toBe(true);
		expect(groups[1].items.map(({ token }) => token.id)).toEqual(["day"]);
	});

	it("builds multiple syllable groups around literal spaces", () => {
		const tokens = [token("hel"), token("lo", true), token("wor"), token("ld")];

		expect(
			groupSpicyTokens(tokens).map((group) =>
				group.items.map(({ token }) => token.id),
			),
		).toEqual([
			["hel", "lo"],
			["wor", "ld"],
		]);
	});

	it("preserves held tokens and every original token index", () => {
		const tokens = [
			token("held", true, ["h", "e", "l", "d"]),
			token("sy"),
			token("lla"),
			token("ble"),
		];
		const flattened = flatten(groupSpicyTokens(tokens));

		expect(flattened.map(({ token }) => token)).toEqual(tokens);
		expect(flattened.map(({ wordIndex }) => wordIndex)).toEqual([0, 1, 2, 3]);
		expect(flattened[0].token.letters).toEqual(["h", "e", "l", "d"]);
	});

	it("creates wrap boundaries for adjacent CJK or romanized tokens without spaces", () => {
		const tokens = [
			token("世", false, undefined, true),
			token("界", false, undefined, true),
			token("romanization", false, undefined, true),
		];
		const groups = groupSpicyTokens(tokens);

		expect(
			groups.map((group) => group.items.map(({ token }) => token.id)),
		).toEqual([["世"], ["界"], ["romanization"]]);
		expect(groups.every((group) => !group.hasTrailingSpace)).toBe(true);
	});

	it("returns no groups for an empty line", () => {
		expect(groupSpicyTokens([])).toEqual([]);
	});
});

describe("buildSpicyLines", () => {
	it("preserves TTML line order when timestamps are out of sequence", () => {
		const first = newLyricLine();
		first.id = "ttml-first";
		first.startTime = 4_000;
		first.endTime = 5_000;
		first.words = [
			{ ...newLyricWord(), startTime: 4_000, endTime: 5_000, word: "First" },
		];
		const second = newLyricLine();
		second.id = "ttml-second";
		second.startTime = 0;
		second.endTime = 1_000;
		second.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "Second" },
		];

		expect(
			buildSpicyLines([first, second], false, false)
				.filter((line) => !line.isDotLine)
				.map((line) => line.id),
		).toEqual(["ttml-first", "ttml-second"]);
	});

	it("uses the first strong character to detect RTL lines", () => {
		expect(isRtl("  123 - שלום")).toBe(true);
		expect(isRtl("Hello مرحبا")).toBe(false);

		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "مرحبا" },
		];
		expect(buildSpicyLines([line], false, false)[0].isRtl).toBe(true);
	});

	it("marks a full-line timed word as line-synced and retains its text", () => {
		const line = newLyricLine();
		line.id = "line-synced";
		line.startTime = 1_000;
		line.endTime = 2_000;
		line.isLineSynced = true;
		line.romanLyric = "Zheng hang";
		line.words = [
			{
				...newLyricWord(),
				startTime: 1_000,
				endTime: 2_000,
				word: "Whole line",
				romanWord: "Ignored per-line romanization",
			},
		];

		const [normal] = buildSpicyLines([line], false, false);
		const [romanized] = buildSpicyLines([line], false, true);

		expect(normal).toMatchObject({ isLineSynced: true, text: "Whole line" });
		expect(romanized).toMatchObject({ text: "Zheng hang" });
	});

	it("keeps multi-word karaoke lines on the word-synced path", () => {
		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 500, word: "Ka" },
			{ ...newLyricWord(), startTime: 500, endTime: 1_000, word: "raoke" },
		];

		expect(buildSpicyLines([line], false, false)[0].isLineSynced).toBe(false);
	});

	it("keeps a single timed word on the word-synced path", () => {
		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "Hello" },
		];

		expect(buildSpicyLines([line], false, false)[0]).toMatchObject({
			isLineSynced: false,
			words: [{ text: "Hello" }],
		});
	});

	it("can force every lyric line onto the line-synced renderer", () => {
		const line = newLyricLine();
		line.startTime = 0;
		line.endTime = 1_000;
		line.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "Hello" },
		];

		expect(buildSpicyLines([line], false, false, true)[0].isLineSynced).toBe(
			true,
		);
	});

	it("places interlude dots on the next vocal line's side", () => {
		const first = newLyricLine();
		first.id = "first";
		first.startTime = 0;
		first.endTime = 1_000;
		first.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "First" },
		];
		const next = newLyricLine();
		next.id = "next";
		next.startTime = 4_000;
		next.endTime = 5_000;
		next.isDuet = true;
		next.words = [
			{ ...newLyricWord(), startTime: 4_000, endTime: 5_000, word: "التالي" },
		];

		const dot = buildSpicyLines([first, next], false, false).find(
			(line) => line.isDotLine,
		);

		expect(dot?.isDuet).toBe(true);
		expect(dot?.isRtl).toBe(true);
	});

	it("starts interludes after each lead's group, background vocals included", () => {
		const first = newLyricLine();
		first.id = "first";
		first.startTime = 0;
		first.endTime = 1_000;
		first.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "First" },
		];
		const overlappingMain = newLyricLine();
		overlappingMain.id = "overlapping-main";
		overlappingMain.startTime = 0;
		overlappingMain.endTime = 3_000;
		overlappingMain.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 3_000, word: "Overlap" },
		];
		const background = newLyricLine();
		background.id = "background";
		background.startTime = 0;
		background.endTime = 7_000;
		background.isBG = true;
		background.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 7_000, word: "Background" },
		];
		const next = newLyricLine();
		next.id = "next";
		next.startTime = 6_000;
		next.endTime = 7_000;
		next.words = [
			{ ...newLyricWord(), startTime: 6_000, endTime: 7_000, word: "Next" },
		];

		const lines = buildSpicyLines(
			[first, overlappingMain, background, next],
			false,
			false,
		);

		// The background runs to 7s, so its lead does too and no interlude fits
		// before the next line; only the next group's start counts, not every
		// earlier lead's end.
		expect(lines.find((line) => line.isDotLine)).toBeUndefined();
		expect(
			lines.map((line) => [line.id, line.startTime, line.endTime]),
		).toEqual([
			["first", 0, 1_000],
			["overlapping-main", 0, 7_000],
			["background", 0, 7_000],
			["next", 6_000, 7_000],
		]);
	});

	it("measures interludes from this lead's end, not the latest earlier one", () => {
		const line = (id: string, startTime: number, endTime: number) => ({
			...newLyricLine(),
			id,
			startTime,
			endTime,
			words: [{ ...newLyricWord(), startTime, endTime, word: id }],
		});
		const dot = buildSpicyLines(
			[
				line("long", 0, 9_000),
				line("short", 1_000, 2_000),
				line("next", 6_000, 7_000),
			],
			false,
			false,
		).find((row) => row.isDotLine);

		expect(dot).toMatchObject({ startTime: 2_000, endTime: 6_000 });
	});

	it("splits held words into whole grapheme clusters", () => {
		const held = (word: string) => {
			const line = newLyricLine();
			line.startTime = 0;
			line.endTime = 2_000;
			line.words = [{ ...newLyricWord(), startTime: 0, endTime: 2_000, word }];
			return buildSpicyLines([line], false, false)[0].words[0].letters;
		};

		expect(held("éa")).toEqual(["é", "a"]);
		expect(held("ஸ்ரீ")).toEqual(["ஸ்ரீ"]);
	});

	it("drops a background vocal's parentheses and keeps zero-length syllables", () => {
		const main = newLyricLine();
		main.startTime = 0;
		main.endTime = 1_000;
		main.words = [
			{ ...newLyricWord(), startTime: 0, endTime: 1_000, word: "Main" },
		];
		const background = newLyricLine();
		background.isBG = true;
		background.startTime = 200;
		background.endTime = 800;
		background.words = [
			{ ...newLyricWord(), startTime: 200, endTime: 500, word: "(oh" },
			{ ...newLyricWord(), startTime: 500, endTime: 500, word: "yeah)" },
		];

		const [, bg] = buildSpicyLines([main, background], false, false);
		expect(bg.words.map((word) => word.text)).toEqual(["oh", "yeah"]);
		expect([bg.startTime, bg.endTime]).toEqual([200, 500]);
	});
});

describe("Spicy timing problem marks", () => {
	const build = (problems?: SpicyWordProblems) => {
		const line = newLyricLine();
		line.startTime = 1_000;
		line.endTime = 2_000;
		line.words = [
			{ ...newLyricWord(), id: "ok", word: "Fine ", startTime: 1_000 },
			{ ...newLyricWord(), id: "backwards", word: "back ", startTime: 1_600 },
			{ ...newLyricWord(), id: "untimed", word: "none" },
		];
		line.words[0].endTime = 1_400;
		line.words[1].endTime = 1_500;
		return buildSpicyLines([line], false, false, false, false, problems)[0];
	};

	it("drops a word that ends before it starts when no problems are shown", () => {
		const line = build();
		expect(line.words.map((word) => word.id)).toEqual(["ok", "untimed"]);
		expect(line.words.every((word) => word.problems === undefined)).toBe(true);
	});

	it("keeps and marks flagged words, playing a backwards word as zero-length", () => {
		const line = build(
			new Map([
				["backwards", ["endsBeforeStart"]],
				["untimed", ["untimed"]],
			]),
		);
		expect(line.words.map((word) => [word.id, word.problems])).toEqual([
			["ok", undefined],
			["backwards", ["endsBeforeStart"]],
			["untimed", ["untimed"]],
		]);
		const backwards = line.words[1];
		expect([backwards.startTime, backwards.endTime]).toEqual([1_600, 1_600]);
	});
});

describe("Spicy zero-width handling", () => {
	const zwsp = String.fromCodePoint(0x200b);
	const wordJoiner = String.fromCodePoint(0x2060);
	const zwnj = String.fromCodePoint(0x200c);
	const line = (words: Array<[string, number, number]>) => ({
		...newLyricLine(),
		id: "line",
		startTime: 0,
		endTime: 3_000,
		words: words.map(([word, startTime, endTime], index) => ({
			...newLyricWord(),
			id: `w${index}`,
			word,
			startTime,
			endTime,
		})),
	});

	it("drops a syllable that is only a zero-width space", () => {
		const [spicy] = buildSpicyLines(
			[
				line([
					["Hi ", 0, 500],
					[zwsp, 500, 600],
					["there", 600, 900],
				]),
			],
			false,
			false,
		);
		expect(spicy.words.map((word) => word.text)).toEqual(["Hi", "there"]);
	});

	it("gives a held word no empty letter for an invisible mark", () => {
		const [spicy] = buildSpicyLines(
			[line([[`lo${zwsp}ve${wordJoiner}`, 0, 2_000]])],
			false,
			false,
		);
		expect(spicy.words[0].text).toBe("love");
		expect(spicy.words[0].letters).toEqual(["l", "o", "v", "e"]);
	});

	it("keeps the joiners that shape a word", () => {
		// Persian "mi" + ZWNJ + "ravam": the ZWNJ keeps the first part unjoined.
		const word = `می${zwnj}روم`;
		const [spicy] = buildSpicyLines([line([[word, 0, 400]])], false, false);
		expect(spicy.words[0].text).toBe(word);
	});
});

describe("Spicy untimed lines", () => {
	const line = (
		id: string,
		startTime: number,
		endTime: number,
		isBG = false,
	) => ({
		...newLyricLine(),
		id,
		startTime,
		endTime,
		isBG,
		words: [{ ...newLyricWord(), id: `${id}-w`, word: id, startTime, endTime }],
	});
	const build = (lines: ReturnType<typeof line>[]) =>
		buildSpicyLines(lines, false, false, false, false, undefined, true);

	it("drops untimed lines unless asked to show them", () => {
		const lines = [line("a", 1_000, 2_000), line("b", 0, 0)];
		expect(buildSpicyLines(lines, false, false).map((l) => l.id)).toEqual([
			"a",
		]);
		const shown = build(lines);
		expect(shown.map((l) => [l.id, l.isUntimed])).toEqual([
			["a", undefined],
			["b", true],
		]);
		// Zero-length where the line before it ends, so it is never active.
		expect([shown[1].startTime, shown[1].endTime]).toEqual([2_000, 2_000]);
	});

	it("puts an interlude after untimed lines, right before the next timed one", () => {
		const shown = build([
			line("a", 1_000, 2_000),
			line("b", 0, 0),
			line("c", 9_000, 10_000),
		]);
		expect(shown.map((l) => (l.isDotLine ? "dots" : l.id))).toEqual([
			"a",
			"b",
			"dots",
			"c",
		]);
		expect([shown[2].startTime, shown[2].endTime]).toEqual([2_000, 9_000]);
	});

	it("keeps the leading interlude next to the first timed line", () => {
		const shown = build([line("b", 0, 0), line("c", 9_000, 10_000)]);
		expect(shown.map((l) => (l.isDotLine ? "dots" : l.id))).toEqual([
			"b",
			"dots",
			"c",
		]);
	});

	it("never stretches a lead over an untimed background vocal", () => {
		const shown = build([line("a", 1_000, 2_000), line("bg", 0, 0, true)]);
		expect(shown.map((l) => [l.id, l.isUntimed])).toEqual([
			["a", undefined],
			["bg", true],
		]);
		expect([shown[0].startTime, shown[0].endTime]).toEqual([1_000, 2_000]);
	});
});

describe("Spicy line being synced", () => {
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
	// Mid-sync: the first word set the line's start, its end comes with the last word.
	const syncing = {
		...newLyricLine(),
		id: "s",
		startTime: 1_000,
		endTime: 0,
		words: [
			word("a", "One ", 1_000, 1_400),
			word("b", "two ", 1_400, 0),
			word("c", "three", 0, 0),
		],
	};

	it("shows the line before its last word is synced", () => {
		expect(buildSpicyLines([syncing], false, false)).toEqual([]);
		const [line] = buildSpicyLines(
			[syncing],
			false,
			false,
			false,
			false,
			undefined,
			true,
		);
		expect([line.id, line.startTime, line.endTime]).toEqual([
			"s",
			1_000,
			1_400,
		]);
		expect(line.isUntimed).toBeUndefined();
		// The word in progress and the ones after it stay, hollow.
		expect(line.words.map((token) => [token.text, token.isUntimed])).toEqual([
			["One", undefined],
			["two", true],
			["three", true],
		]);
	});
});
