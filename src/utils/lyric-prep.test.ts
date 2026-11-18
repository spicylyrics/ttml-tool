import { describe, expect, it } from "vitest";
import { prepareLyricLine } from "./lyric-prep";

describe("prepareLyricLine", () => {
	it.each([
		["你,好", "你, \\好"],
		["你，好", "你，\\好"],
		["君、僕", "君、\\僕"],
		["你，Hello", "你，\\Hello"],
		["Hello、你", "Hello、\\你"],
	])("splits words after commas without spaces: %s", (input, expected) => {
		expect(prepareLyricLine(input, { splitWords: false })).toBe(expected);
	});

	it("splits non-BMP CJK characters by code point", () => {
		expect(prepareLyricLine("𠮷野", { splitWords: false })).toBe("𠮷\\野");
		expect(prepareLyricLine("𠮷，野", { splitWords: false })).toBe("𠮷，\\野");
	});

	it("preserves existing line features while splitting CJK text", () => {
		expect(
			prepareLyricLine("[Verse]你，好 (君、僕)", { splitWords: false }),
		).toBe("你，\\好\n<君、\\僕");
	});

	it("keeps adjacent CJK and Latin word boundaries", () => {
		expect(prepareLyricLine("你Hello世界", { splitWords: false })).toBe(
			"你\\Hello\\世\\界",
		);
	});

	it("escapes literal spaces for the text importer", () => {
		expect(prepareLyricLine("你，好 world")).toBe("你，\\好\\ \\world");
	});

	it.each([
		["I'm sorry,\"", "I'm sorry,\""],
		['She said "go."', 'She said "go."'],
		['"Why?" he asked', '"Why?" he asked'],
		["Run!' she said", "Run!' she said"],
		["“Hello,” she said", "“Hello,” she said"],
		["It's ‘over’", "It's ‘over’"],
		['I said "stop (stop)"', 'I said "stop"\n<Stop'],
		['Words " here', 'Words" here'],
		['" Hello', '"Hello'],
		['well, "hi"', 'well, "hi"'],
	])("keeps quotes and closing marks on their word: %s", (input, expected) => {
		expect(prepareLyricLine(input, { splitWords: false })).toBe(expected);
		// With words split, the marks stay inside their word.
		expect(prepareLyricLine(input)).toBe(expected.replace(/ /g, "\\ \\"));
	});

	it("turns each step off on its own", () => {
		const line = "Mm-hmm -- wait (yeah) [x]  ok";
		const plain = (steps: Parameters<typeof prepareLyricLine>[1]) =>
			prepareLyricLine(line, { splitWords: false, ...steps });
		expect(plain({})).toBe("Mm-\\hmm — wait ok\n<Yeah");
		expect(plain({ emDashes: false })).toBe("Mm-\\hmm -- wait ok\n<Yeah");
		expect(plain({ splitHyphens: false })).toBe("Mm-hmm — wait ok\n<Yeah");
		expect(plain({ backgroundVocals: false })).toBe(
			"Mm-\\hmm — wait (yeah) ok",
		);
		expect(plain({ capitalizeBackground: false })).toBe(
			"Mm-\\hmm — wait ok\n<yeah",
		);
		expect(plain({ removeInlineBrackets: false })).toBe(
			"Mm-\\hmm — wait [x] ok\n<Yeah",
		);
		expect(prepareLyricLine(line)).toBe(
			"Mm-\\hmm\\ \\—\\ \\wait\\ \\ok\n<Yeah",
		);
		expect(prepareLyricLine("你好", { splitCjk: false })).toBe("你好");
		expect(
			prepareLyricLine("a ,b", {
				punctuationSpacing: false,
				splitCjk: false,
				splitWords: false,
			}),
		).toBe("a ,b");
		expect(
			prepareLyricLine("a   b", { collapseSpaces: false, splitWords: false }),
		).toBe("a   b");
	});

	it("splits Japanese into words when the dictionary says where they start", () => {
		const words = () => new Set([1, 2, 4, 5, 8]);
		expect(prepareLyricLine("君の名前を呼んでいた", {}, words)).toBe(
			"君\\の\\名前\\を\\呼んで\\いた",
		);
		// Without it, one character at a time as before.
		expect(prepareLyricLine("名前", {})).toBe("名\\前");
	});

	it("lowercases ad-libs joined from between words and reports the line", () => {
		const joined: string[] = [];
		const report = (suggestion: string) => joined.push(suggestion);
		expect(
			prepareLyricLine(
				"It go in (When you), out (Ride it), do it real slow (Slide)",
				{ splitWords: false },
				undefined,
				report,
			),
		).toBe("It go in, out, do it real slow\n<When you, ride it, slide");
		expect(joined).toEqual([
			"It go in, out, do it real slow (When you, ride it, slide)",
		]);
		// "I" and words in capitals keep their case.
		expect(
			prepareLyricLine("Go (Oh) now (I'm here) (OK)", { splitWords: false }),
		).toBe("Go now\n<Oh, I'm here, OK");
		// One ad-lib is nothing to review.
		prepareLyricLine("Hello (Oh)", {}, undefined, report);
		expect(joined).toHaveLength(1);
		// With capitalizing off, the source case stays.
		expect(
			prepareLyricLine("a (Oh) b (Yeah)", {
				splitWords: false,
				capitalizeBackground: false,
			}),
		).toBe("a b\n<Oh, Yeah");
	});
});
