import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import {
	normalizeApostrophes,
	normalizeCyrillicEs,
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
	normalizeLyricText,
} from "./apostrophe-normalization";

describe("normalizeApostrophes", () => {
	it("converts supported apostrophe-like characters to ASCII apostrophes", () => {
		expect(normalizeApostrophes("`´ʻʼ՚‘’‚‛′‵＇")).toBe("''''''''''''");
	});

	it("leaves unrelated text unchanged while normalizing apostrophe-like characters", () => {
		expect(normalizeApostrophes('"Keep — punctuation, 1′ 2″"')).toBe(
			'"Keep — punctuation, 1\' 2″"',
		);
	});
});

describe("normalizeCyrillicEs", () => {
	it("converts Cyrillic Е and е embedded in Latin words", () => {
		expect(normalizeCyrillicEs("thе Еcho тeст")).toBe("the Echo тeст");
	});

	it("preserves genuine Cyrillic words", () => {
		expect(normalizeCyrillicEs("Елена, привет, ещё")).toBe(
			"Елена, привет, ещё",
		);
	});
});

describe("normalizeImportedLyricApostrophes", () => {
	const lyrics: TTMLLyric = {
		metadata: [{ key: "musicName", value: ["Don’t skip metadata"] }],
		marks: [
			{ timeMs: 500, label: "Singer’s cue", description: "Don’t miss it" },
		],
		sections: [
			{
				id: "section-‘one’",
				label: "Verse ‘One’",
				category: "verse",
				repeatGroupId: "repeat-‘one’",
			},
		],
		lyricLines: [
			{
				id: "line-‘one’",
				startTime: 0,
				endTime: 1,
				ignoreSync: false,
				isBG: false,
				isDuet: false,
				translatedLyric: "You’re here",
				romanLyric: "Lʼamour",
				geniusHeader: "[Singer’s Verse]",
				language: "x-‘test’",
				agent: "agent-‘one’",
				words: [
					{
						id: "word-‘one’",
						startTime: 0,
						endTime: 1,
						word: "It‘s fine",
						romanWord: "d’Accord",
						obscene: false,
					},
				],
			},
		],
	};

	it("normalizes all user-visible imported text", () => {
		const normalized = normalizeImportedLyricApostrophes(lyrics, true);

		expect(normalized.lyricLines[0]).toMatchObject({
			translatedLyric: "You're here",
			romanLyric: "L'amour",
			geniusHeader: "[Singer's Verse]",
			words: [
				{
					word: "It's fine",
					romanWord: "d'Accord",
				},
			],
		});
		expect(normalized.metadata[0].value).toEqual(["Don't skip metadata"]);
		expect(normalized.marks?.[0]).toMatchObject({
			label: "Singer's cue",
			description: "Don't miss it",
		});
		expect(normalized.sections?.[0]).toMatchObject({
			label: "Verse 'One'",
		});
	});

	it("preserves machine-facing strings", () => {
		const normalized = normalizeImportedLyricApostrophes(lyrics, true);

		expect(normalized.metadata[0].key).toBe("musicName");
		expect(normalized.sections?.[0]).toMatchObject({
			id: "section-‘one’",
			category: "verse",
			repeatGroupId: "repeat-‘one’",
		});
		expect(normalized.lyricLines[0]).toMatchObject({
			id: "line-‘one’",
			language: "x-‘test’",
			agent: "agent-‘one’",
			words: [{ id: "word-‘one’" }],
		});
	});

	it("preserves source text when disabled", () => {
		expect(normalizeImportedLyricApostrophes(lyrics, false)).toBe(lyrics);
	});

	it("applies both active normalizers in one pass", () => {
		const normalized = normalizeLyricText(lyrics, {
			normalizeApostrophes: true,
			normalizeCyrillicEs: true,
		});

		expect(normalized.metadata[0].value).toEqual(["Don't skip metadata"]);
		expect(normalized.lyricLines[0].words[0].word).toBe("It's fine");
	});

	it("normalizes all lyric text when enabled", () => {
		const normalized = normalizeImportedLyricCyrillicEs(
			{
				...lyrics,
				metadata: [{ key: "musicName", value: ["Thе Song"] }],
				marks: [{ timeMs: 500, label: "Thе cue", description: "Еcho now" }],
				sections: [
					{
						id: "thе-section",
						label: "Thе Verse",
						category: "verse",
					},
				],
				lyricLines: [
					{
						...lyrics.lyricLines[0],
						geniusHeader: "[Thе Verse]",
						translatedLyric: "Теst",
						romanLyric: "Еcho",
						words: [
							{
								...lyrics.lyricLines[0].words[0],
								word: "Неy",
								romanWord: "Еcho",
							},
						],
					},
				],
			},
			true,
		);

		expect(normalized.lyricLines[0]).toMatchObject({
			translatedLyric: "Тest",
			romanLyric: "Echo",
			geniusHeader: "[The Verse]",
			words: [{ word: "Нey", romanWord: "Echo" }],
		});
		expect(normalized.metadata[0].value).toEqual(["The Song"]);
		expect(normalized.marks?.[0]).toMatchObject({
			label: "The cue",
			description: "Echo now",
		});
		expect(normalized.sections?.[0]).toMatchObject({
			id: "thе-section",
			label: "The Verse",
		});
	});
});
