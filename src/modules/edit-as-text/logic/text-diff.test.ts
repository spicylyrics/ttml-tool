// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import {
	type LyricLine,
	type LyricSection,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import fixture from "./fixtures/synced.ttml?raw";
import { editTextFormat, serializeLyrics } from "./serialize";
import {
	alignByKey,
	applyEditedText,
	lineSimilarity,
	mergeWords,
	parseEditedText,
} from "./text-diff";

const VERSE: LyricSection = {
	id: "s-verse",
	label: "[Verse 1]",
	category: "verse",
	ordinal: 1,
	color: "red",
	notes: "keep me",
};
const CHORUS_A: LyricSection = {
	id: "s-chorus-a",
	label: "[Chorus]",
	category: "chorus",
};
const CHORUS_B: LyricSection = {
	id: "s-chorus-b",
	label: "[Chorus]",
	category: "chorus",
};

/** The synced fixture with sections: two Choruses back to back, and an unsectioned last line. */
function synced(): TTMLLyric {
	const lyrics = parseLyric(fixture);
	const sectionOf = [
		"s-verse",
		"s-verse",
		"s-verse",
		"s-chorus-a",
		"s-chorus-a",
		"s-chorus-b",
	];
	lyrics.lyricLines.forEach((line, index) => {
		const id = sectionOf[index];
		if (id) {
			line.sectionId = id;
			line.geniusHeader = id === "s-verse" ? "[Verse 1]" : "[Chorus]";
		}
	});
	lyrics.sections = [VERSE, CHORUS_A, CHORUS_B].map((section) => ({
		...section,
	}));
	return deepFreeze(lyrics);
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object") {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

const timing = (line: LyricLine) =>
	line.words.map((word) => [word.id, word.word, word.startTime, word.endTime]);

const edit = (lyrics: TTMLLyric, change: (text: string) => string) => {
	const format = editTextFormat(lyrics);
	const text = serializeLyrics(lyrics, format);
	return applyEditedText(lyrics, change(text), format);
};

const replaceRow = (text: string, from: string, to: string) => {
	const rows = text.split("\n");
	const index = rows.indexOf(from);
	if (index === -1) throw new Error(`no row ${from}`);
	rows[index] = to;
	return rows.join("\n");
};

describe("serializeLyrics", () => {
	it("writes headers, prefixes, splits and translation rows", () => {
		const lyrics = synced();
		expect(serializeLyrics(lyrics, editTextFormat(lyrics))).toBe(
			[
				"[Verse 1]",
				"Beau\\ti\\ful\\ \\one,\\ \\I-I\\ \\know",
				"Hermosa, lo sé",
				"Hold\\ \\me\\ \\close",
				"",
				"<close\\ \\now",
				"",
				"[Chorus]",
				">La\\-la\\ \\tonight",
				"",
				"Hold\\ \\me\\ \\close",
				"",
				"[Chorus]",
				"Say\\ \\teh\\ \\word",
				"",
				"Hold\\ \\me\\ \\close",
				"",
			].join("\n"),
		);
	});

	it("pads sections with blank rows only without translation rows", () => {
		const lyrics = deepFreeze({
			metadata: [],
			lyricLines: synced().lyricLines.map((line) => ({
				...line,
				translatedLyric: "",
			})),
			sections: synced().sections,
		});
		const text = serializeLyrics(lyrics, editTextFormat(lyrics));
		expect(text.split("\n").slice(0, 6)).toEqual([
			"[Verse 1]",
			"Beau\\ti\\ful\\ \\one,\\ \\I-I\\ \\know",
			"Hold\\ \\me\\ \\close",
			"<close\\ \\now",
			"",
			"[Chorus]",
		]);
	});

	it("keeps the user's separator and prefixes but never loses words or roles", () => {
		const lyrics = synced();
		const format = editTextFormat(lyrics, {
			mode: "lyric",
			lineSeparatorMode: "same-line-separator",
			lineSeparator: "|",
			swapTransAndRoman: true,
			wordSeparator: "",
			enableSpecialPrefix: false,
			bgLyricPrefix: "(",
			duetLyricPrefix: "",
		});
		expect(format).toMatchObject({
			mode: "lyric-trans",
			lineSeparatorMode: "interleaved-line",
			swapTransAndRoman: false,
			wordSeparator: "\\",
			enableSpecialPrefix: true,
			bgLyricPrefix: "(",
			duetLyricPrefix: ">",
			makeSections: true,
		});
	});

	it("adds brackets to a header label edited without them", () => {
		const lyrics = deepFreeze({
			metadata: [],
			lyricLines: [{ ...newLyricLine(), sectionId: "x", words: [] }],
			sections: [{ id: "x", label: "Bridge", category: "bridge" as const }],
		});
		expect(serializeLyrics(lyrics, editTextFormat(lyrics))).toBe(
			"[Bridge]\n\\",
		);
	});
});

describe("applyEditedText", () => {
	it("changes nothing when the text isn't edited", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) => text);
		expect(result.summary).toMatchObject({
			unchanged: 7,
			moved: 0,
			edited: 0,
			added: 0,
			removed: 0,
			droppedTimedWords: 0,
			hasChanges: false,
		});
		expect(result.lyricLines).toEqual(lyrics.lyricLines);
		expect(result.sections).toEqual(lyrics.sections);
	});

	it("keeps every timing, the fixed word's too, when a typo is fixed", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "Say\\ \\teh\\ \\word", "Say\\ \\the\\ \\word"),
		);
		expect(result.summary).toMatchObject({
			unchanged: 6,
			edited: 1,
			added: 0,
			removed: 0,
			droppedTimedWords: 0,
			hasChanges: true,
		});
		expect(result.summary.lossyLines).toEqual([]);
		for (const index of [0, 1, 2, 3, 4, 6])
			expect(result.lyricLines[index]).toEqual(lyrics.lyricLines[index]);
		const fixed = result.lyricLines[5];
		const old = lyrics.lyricLines[5];
		expect(fixed.id).toBe(old.id);
		expect(fixed.startTime).toBe(old.startTime);
		expect(fixed.sectionId).toBe("s-chorus-b");
		expect(fixed.words[0]).toBe(old.words[0]);
		expect(fixed.words[4]).toBe(old.words[4]);
		expect(old.words[2].startTime).toBeGreaterThan(0);
		expect(fixed.words[2]).toMatchObject({
			id: old.words[2].id,
			word: "the",
			startTime: old.words[2].startTime,
			endTime: old.words[2].endTime,
		});
	});

	it("keeps hyphenated words whole", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) => text);
		expect(result.lyricLines[0].words.map((word) => word.word)).toContain(
			"I-I",
		);
		const tokens = parseEditedText("we-we\\go", editTextFormat(lyrics));
		expect(
			tokens.flatMap((token) =>
				token.type === "line" ? token.line.words.map((word) => word.word) : [],
			),
		).toEqual(["we-we", "go"]);
	});

	it("keeps word timings when only the role changes", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "<close\\ \\now", "close\\ \\now"),
		);
		expect(result.summary).toMatchObject({ edited: 1, droppedTimedWords: 0 });
		expect(result.lyricLines[2].isBG).toBe(false);
		expect(result.lyricLines[2].id).toBe(lyrics.lyricLines[2].id);
		expect(timing(result.lyricLines[2])).toEqual(timing(lyrics.lyricLines[2]));
	});

	it("keeps word timings when the translation changes", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "Hermosa, lo sé", "Preciosa, lo sé"),
		);
		expect(result.summary).toMatchObject({ edited: 1, droppedTimedWords: 0 });
		expect(result.lyricLines[0].translatedLyric).toBe("Preciosa, lo sé");
		expect(timing(result.lyricLines[0])).toEqual(timing(lyrics.lyricLines[0]));
	});

	it("drops only the joined syllables when a split is removed", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace("Beau\\ti\\ful", "Beautiful"),
		);
		expect(result.summary).toMatchObject({ edited: 1, droppedTimedWords: 3 });
		const words = result.lyricLines[0].words;
		expect(words.map((word) => word.word)).toEqual([
			"Beautiful",
			" ",
			"one,",
			" ",
			"I-I",
			" ",
			"know",
		]);
		expect(words[0].startTime).toBe(0);
		expect(words[2]).toBe(lyrics.lyricLines[0].words[4]);
		expect(words[6]).toBe(lyrics.lyricLines[0].words[8]);
	});

	it("keeps a moved line's timing", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) => {
			const rows = text.split("\n");
			const [say] = rows.splice(13, 2);
			rows.splice(1, 0, say, "");
			return rows.join("\n");
		});
		expect(result.summary).toMatchObject({
			moved: 1,
			edited: 0,
			added: 0,
			removed: 0,
			droppedTimedWords: 0,
			hasChanges: true,
		});
		const moved = result.lyricLines[0];
		expect(moved.id).toBe(lyrics.lyricLines[5].id);
		expect(timing(moved)).toEqual(timing(lyrics.lyricLines[5]));
		expect(moved.sectionId).toBe("s-verse");
	});

	it("adds new lines untimed and inside the section they're typed in", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace(
				">La\\-la\\ \\tonight\n",
				">La\\-la\\ \\tonight\n\nBrand\\ \\new\n",
			),
		);
		expect(result.summary).toMatchObject({ unchanged: 7, added: 1 });
		const added = result.lyricLines[4];
		expect(added.words.map((word) => word.word)).toEqual(["Brand", " ", "new"]);
		expect(added.words.every((word) => word.startTime === 0)).toBe(true);
		expect(added.sectionId).toBe("s-chorus-a");
		expect(added.geniusHeader).toBe("[Chorus]");
	});

	it("counts removed lines and their timed words", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace(">La\\-la\\ \\tonight\n\n", ""),
		);
		expect(result.summary).toMatchObject({
			unchanged: 6,
			removed: 1,
			droppedTimedWords: 3,
		});
		expect(result.lyricLines.map((line) => line.id)).not.toContain(
			lyrics.lyricLines[3].id,
		);
	});

	it("keeps each repeat's own timing when one repeat is removed", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) => {
			const rows = text.split("\n");
			rows.splice(10, 2); // the "Hold me close" in the first Chorus
			return rows.join("\n");
		});
		expect(result.summary).toMatchObject({ unchanged: 6, removed: 1 });
		const ids = result.lyricLines.map((line) => line.id);
		expect(ids).toContain(lyrics.lyricLines[1].id);
		expect(ids).toContain(lyrics.lyricLines[6].id);
		expect(ids).not.toContain(lyrics.lyricLines[4].id);
		expect(timing(result.lyricLines[5])).toEqual(timing(lyrics.lyricLines[6]));
	});

	it("keeps unsectioned lines unsectioned and back-to-back sections apart", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "Say\\ \\teh\\ \\word", "Say\\ \\the\\ \\word"),
		);
		expect(result.lyricLines.map((line) => line.sectionId)).toEqual([
			"s-verse",
			"s-verse",
			"s-verse",
			"s-chorus-a",
			"s-chorus-a",
			"s-chorus-b",
			undefined,
		]);
		expect(result.lyricLines[6].geniusHeader).toBeUndefined();
	});

	it("keeps a renamed section's id and metadata", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace("[Verse 1]", "[Bridge]"),
		);
		expect(result.summary.hasChanges).toBe(true);
		expect(result.summary.edited).toBe(0);
		const section = result.sections.find((item) => item.id === "s-verse");
		expect(section).toMatchObject({
			label: "[Bridge]",
			category: "bridge",
			color: "red",
			notes: "keep me",
		});
		expect(result.lyricLines[0].geniusHeader).toBe("[Bridge]");
	});

	it("starts a new section where a header is typed", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace("\n<close", "\n[Outro]\n<close"),
		);
		expect(result.summary).toMatchObject({ unchanged: 7, hasChanges: true });
		const outro = result.sections.find((item) => item.label === "[Outro]");
		expect(outro).toMatchObject({ category: "outro" });
		expect(result.lyricLines[2].sectionId).toBe(outro?.id);
		expect(result.lyricLines[1].sectionId).toBe("s-verse");
	});

	it("moves lines into the section above when their header is deleted", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			text.replace("\n[Chorus]\n>La", "\n>La"),
		);
		expect(result.summary.hasChanges).toBe(true);
		expect(result.lyricLines[3].sectionId).toBe("s-verse");
		expect(result.lyricLines[4].sectionId).toBe("s-verse");
		expect(result.sections.map((section) => section.id)).toEqual([
			"s-verse",
			"s-chorus-b",
		]);
	});

	it("keeps a similar line rewritten in place as the same line", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "Say\\ \\teh\\ \\word", "Say\\ \\teh\\ \\word\\ \\now"),
		);
		expect(result.summary).toMatchObject({
			edited: 1,
			added: 0,
			removed: 0,
			droppedTimedWords: 0,
		});
		const before = lyrics.lyricLines[5];
		const after = result.lyricLines[5];
		expect(after.id).toBe(before.id);
		expect(timing(after).slice(0, 5)).toEqual(timing(before));
		expect(after.words[6]).toMatchObject({ word: "now", startTime: 0 });
	});

	it("treats a dissimilar line rewritten in place as a delete and an add", () => {
		const lyrics = synced();
		const result = edit(lyrics, (text) =>
			replaceRow(text, "Say\\ \\teh\\ \\word", "Something\\ \\else"),
		);
		expect(result.summary).toMatchObject({
			edited: 0,
			added: 1,
			removed: 1,
			droppedTimedWords: 3,
		});
		expect(result.lyricLines[5].id).not.toBe(lyrics.lyricLines[5].id);
		expect(result.lyricLines[5].sectionId).toBe("s-chorus-b");
	});

	it("removes everything for empty text", () => {
		const lyrics = synced();
		const result = applyEditedText(lyrics, "", editTextFormat(lyrics));
		expect(result.lyricLines).toEqual([]);
		expect(result.sections).toEqual([]);
		expect(result.summary).toMatchObject({ removed: 7, hasChanges: true });
	});

	it("round-trips empty lines without changes", () => {
		const lyrics = synced();
		const empty = {
			...newLyricLine(),
			words: [],
			sectionId: "s-verse",
			geniusHeader: "[Verse 1]",
		};
		const emptyBG = {
			...newLyricLine(),
			isBG: true,
			words: [{ ...newLyricWord(), word: " " }],
			translatedLyric: "bg",
			sectionId: "s-chorus-a",
			geniusHeader: "[Chorus]",
		};
		const withEmpty = deepFreeze({
			...lyrics,
			lyricLines: [
				...lyrics.lyricLines.slice(0, 1),
				empty,
				...lyrics.lyricLines.slice(1, 4),
				emptyBG,
				...lyrics.lyricLines.slice(4),
			],
		});
		const format = editTextFormat(withEmpty);
		expect(format.mode).toBe("lyric-trans");
		const text = serializeLyrics(withEmpty, format);
		expect(text.split("\n")).toContain("\\");
		expect(text.split("\n")).toContain("<\\");
		const result = applyEditedText(withEmpty, text, format);
		expect(result.summary).toMatchObject({
			unchanged: 9,
			removed: 0,
			added: 0,
			hasChanges: false,
		});
		expect(result.lyricLines).toEqual(withEmpty.lyricLines);
	});

	it("round-trips a lone empty line", () => {
		const empty = { ...newLyricLine(), words: [] };
		const lyrics = deepFreeze({
			metadata: [],
			lyricLines: [empty],
			sections: [],
		});
		const result = edit(lyrics, (text) => text);
		expect(result.summary).toMatchObject({ unchanged: 1, hasChanges: false });
		expect(result.lyricLines).toEqual([empty]);
		const filled = edit(lyrics, () => "Hello");
		expect(filled.summary).toMatchObject({ added: 1, removed: 1 });
	});

	it("treats a trailing space on the last word as unchanged", () => {
		const word = (text: string, start: number): LyricWord => ({
			...newLyricWord(),
			word: text,
			startTime: start,
			endTime: start + 100,
		});
		const line = {
			...newLyricLine(),
			words: [word("Hi", 100), word("there ", 200)],
		};
		const lyrics = deepFreeze({
			metadata: [],
			lyricLines: [line],
			sections: [],
		});
		const result = edit(lyrics, (text) => text);
		expect(result.summary.hasChanges).toBe(false);
		expect(result.lyricLines[0]).toEqual(line);
	});

	it("round-trips romanization, translation and a background duet line", () => {
		const word = (text: string, start: number): LyricWord => ({
			...newLyricWord(),
			word: text,
			startTime: start,
			endTime: start + 100,
		});
		const first = {
			...newLyricLine(),
			words: [word("Kimi", 100), word(" ", 0), word("ga", 300)],
			translatedLyric: "You",
			romanLyric: "kimi ga",
		};
		const second = {
			...newLyricLine(),
			isBG: true,
			isDuet: true,
			words: [word("oh", 500)],
		};
		const lyrics = deepFreeze({
			metadata: [],
			lyricLines: [first, second],
			sections: [],
		});
		const format = editTextFormat(lyrics);
		expect(format.mode).toBe("lyric-trans-roman");
		const text = serializeLyrics(lyrics, format);
		expect(text).toBe("Kimi\\ \\ga\nYou\nkimi ga\n<>oh\n\n");
		const result = applyEditedText(lyrics, text, format);
		expect(result.summary.hasChanges).toBe(false);
		expect(result.lyricLines).toEqual([first, second]);

		const edited = applyEditedText(
			lyrics,
			text.replace("kimi ga", "kimi-ga"),
			format,
		);
		expect(edited.summary).toMatchObject({ edited: 1, droppedTimedWords: 0 });
		expect(edited.lyricLines[0].romanLyric).toBe("kimi-ga");
		expect(timing(edited.lyricLines[0])).toEqual(timing(first));
	});
});

describe("mergeWords", () => {
	const timed = (text: string, start: number): LyricWord => ({
		...newLyricWord(),
		word: text,
		startTime: start,
		endTime: start + 1,
	});

	it("keeps matched words in order and adds the rest untimed", () => {
		const old = [timed("a", 1), timed("b", 2), timed("c", 3)];
		const result = mergeWords(old, ["a", "x", "c", "d"]);
		expect(result.words[0]).toBe(old[0]);
		expect(result.words[2]).toBe(old[2]);
		expect(result.words[1]).toMatchObject({ word: "x", startTime: 0 });
		expect(result.words[3]).toMatchObject({ word: "d", startTime: 0 });
		expect(result).toMatchObject({ droppedTimed: 1, keptTimed: 2 });
	});

	it("matches repeated words in order", () => {
		const old = [timed("la", 1), timed("la", 2), timed("la", 3)];
		const result = mergeWords(old, ["la", "la"]);
		expect(result.words).toEqual([old[0], old[1]]);
		expect(result.droppedTimed).toBe(1);
	});

	it("ignores spacing around a word but takes the new text", () => {
		const old = [timed("end ", 1)];
		const result = mergeWords(old, ["end"]);
		expect(result.words[0]).toMatchObject({
			id: old[0].id,
			word: "end",
			startTime: 1,
		});
	});

	it("keeps a changed word's timing by position when the count is the same", () => {
		const old = [timed("I", 1), timed(" ", 2), timed("lvoe", 3)];
		const result = mergeWords(old, ["I", " ", "love"]);
		expect(result.words[0]).toBe(old[0]);
		expect(result.words[2]).toMatchObject({
			id: old[2].id,
			word: "love",
			startTime: 3,
			romanWord: "",
		});
		expect(result).toMatchObject({ droppedTimed: 0, keptTimed: 3 });
	});

	it("matches by text when a same-count edit shifts the words", () => {
		const old = ["a", " ", "b", " ", "c", " ", "d"].map((text, index) =>
			timed(text, index + 1),
		);
		const result = mergeWords(old, ["a", " ", "c", " ", "d", " ", "e"]);
		expect(result.words[2]).toBe(old[4]);
		expect(result.words[4]).toBe(old[6]);
		expect(result.words[6]).toMatchObject({ word: "e", startTime: 0 });
		// "b" and one of the spaces around it.
		expect(result.droppedTimed).toBe(2);
	});

	it("doesn't count untimed old words as dropped", () => {
		const result = mergeWords([newLyricWord()], ["new"]);
		expect(result.droppedTimed).toBe(0);
	});
});

describe("alignByKey", () => {
	const ops = (a: string, b: string) =>
		alignByKey([...a], [...b], (x, y) => x === y)
			.map((op) =>
				op.type === "equal" ? "=" : op.type === "delete" ? "-" : "+",
			)
			.join("");

	it("aligns common prefixes, suffixes and the middle", () => {
		expect(ops("abc", "abc")).toBe("===");
		expect(ops("abc", "axc")).toBe("=-+=");
		expect(ops("", "ab")).toBe("++");
		expect(ops("ab", "")).toBe("--");
		expect(ops("abcd", "acbd")).toMatch(/^=.*=$/);
	});
});

describe("lineSimilarity", () => {
	it("scores near-identical lines high and unrelated ones low", () => {
		expect(lineSimilarity("Say teh word", "Say the word")).toBeGreaterThan(0.5);
		expect(lineSimilarity("Hello, World", "hello world")).toBe(1);
		expect(lineSimilarity("Hold me close", "Nothing alike")).toBeLessThan(0.5);
		expect(lineSimilarity("a", "b")).toBe(0);
	});
});
