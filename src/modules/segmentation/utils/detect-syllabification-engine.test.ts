import { describe, expect, it } from "vitest";
import type { LyricLine } from "$/types/ttml";
import {
	detectSyllabificationEngine,
	matchesSavedSyllabificationEngine,
} from "./detect-syllabification-engine";

const lyrics = (text: string) =>
	[
		{
			words: text.split(/\s+/).map((word) => ({ word })),
		},
	] as LyricLine[];

describe("detectSyllabificationEngine", () => {
	it("uses script detection for Cyrillic and Han lyrics", () => {
		expect(detectSyllabificationEngine(lyrics("это русские слова песни"))).toBe(
			"syllabify",
		);
		expect(detectSyllabificationEngine(lyrics("這是一首中文歌曲"))).toBe(
			"basic",
		);
	});

	it("uses language identification for sufficiently long Latin lyrics", () => {
		expect(
			detectSyllabificationEngine(
				lyrics(
					"This is a simple English lyric with enough text to detect its language.",
				),
			),
		).toBe("prosodic");
		expect(
			detectSyllabificationEngine(
				lyrics(
					"To jest prosty polski tekst piosenki zawierający wystarczająco dużo słów do rozpoznania języka.",
				),
			),
		).toBe("hyphenation-pl");
	});

	it("does not guess when there are no lyrics", () => {
		expect(detectSyllabificationEngine([])).toBeUndefined();
	});

	it("judges a Japanese song by its English words only", () => {
		expect(
			detectSyllabificationEngine(
				lyrics(
					"君の名前を呼んでいた this is a simple English lyric with enough text to detect its language",
				),
			),
		).toBe("prosodic");
		expect(
			detectSyllabificationEngine(lyrics("これは日本語の歌詞です")),
		).toBeUndefined();
	});

	it("only auto-applies when the suggestion matches the saved engine", () => {
		const russianLyrics = lyrics("это русские слова песни");

		expect(matchesSavedSyllabificationEngine(russianLyrics, "syllabify")).toBe(
			true,
		);
		expect(matchesSavedSyllabificationEngine(russianLyrics, "prosodic")).toBe(
			false,
		);
		expect(matchesSavedSyllabificationEngine([], "prosodic")).toBe(false);
		// Japanese splits on its own; with no English to judge, any engine is fine.
		expect(
			matchesSavedSyllabificationEngine(
				lyrics("これは日本語の歌詞です"),
				"prosodic",
			),
		).toBe(true);
	});
});
