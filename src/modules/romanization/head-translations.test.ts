// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	type LyricLine,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";

const timedLine = (
	text: string,
	start: number,
	extra: Partial<LyricLine> = {},
): LyricLine => ({
	...newLyricLine(),
	startTime: start,
	endTime: start + 1000,
	words: [
		{
			...newLyricWord(),
			word: text,
			startTime: start,
			endTime: start + 1000,
			romanWord: extra.isBG ? "" : "kimi",
		},
	],
	...extra,
});

const lyric = (): TTMLLyric => ({
	metadata: [{ key: "songwriter", value: ["Someone"] }],
	lyricLines: [
		timedLine("君", 0, { translatedLyric: "You" }),
		timedLine("あ", 500, { isBG: true, translatedLyric: "Ah" }),
		timedLine("僕", 2000, { translatedLyric: "Me" }),
		timedLine("空", 4000),
	],
});

const translations = (parsed: TTMLLyric) =>
	parsed.lyricLines.map((line) => [line.isBG, line.translatedLyric]);

const expected = [
	[false, "You"],
	[true, "Ah"],
	[false, "Me"],
	[false, ""],
];

describe("translation export formats", () => {
	it("keeps inline translations by default", () => {
		const xml = exportTTMLText(lyric());
		expect(xml).toContain('ttm:role="x-translation"');
		expect(xml).not.toContain("<translations>");
		expect(translations(parseLyric(xml))).toEqual(expected);
	});

	it("writes head-level translations and reads them back", () => {
		const xml = exportTTMLText(lyric(), undefined, {
			translationFormat: "head",
			translationLanguage: "en",
		});
		expect(xml).not.toContain('ttm:role="x-translation"');
		expect(xml).toContain('<translation xml:lang="en">');
		expect(xml).toContain(
			'<text for="L1">You<span ttm:role="x-bg">(Ah)</span></text>',
		);
		expect(xml).toContain('<text for="L2">Me</text>');
		expect(/<translations>.*<\/translations>/s.exec(xml)?.[0]).not.toContain(
			'for="L3"',
		);
		const parsed = parseLyric(xml);
		expect(translations(parsed)).toEqual(expected);
		// Romanization and songwriters survive next to it.
		expect(parsed.lyricLines[0].words[0].romanWord).toBe("kimi");
		expect(
			parsed.metadata.find(({ key }) => key === "songwriter")?.value,
		).toEqual(["Someone"]);
	});

	it("round-trips head translations through a second export", () => {
		const options = { translationFormat: "head" as const };
		const first = exportTTMLText(lyric(), undefined, options);
		const second = exportTTMLText(parseLyric(first), undefined, options);
		expect(translations(parseLyric(second))).toEqual(expected);
	});

	it("reads inline exports into head exports and back", () => {
		const inline = exportTTMLText(lyric());
		const head = exportTTMLText(parseLyric(inline), undefined, {
			translationFormat: "head",
		});
		const inlineAgain = exportTTMLText(parseLyric(head));
		expect(translations(parseLyric(inlineAgain))).toEqual(expected);
	});

	it("adds an iTunesMetadata block when there is none", () => {
		const plain: TTMLLyric = {
			metadata: [],
			lyricLines: [timedLine("Hi", 0, { translatedLyric: "Hola" })],
		};
		plain.lyricLines[0].words[0].romanWord = "";
		const xml = exportTTMLText(plain, undefined, {
			translationFormat: "head",
			translationLanguage: "es",
		});
		expect(xml).toContain("<iTunesMetadata");
		expect(xml).toContain('<translation xml:lang="es">');
		expect(translations(parseLyric(xml))).toEqual([[false, "Hola"]]);
	});
});
