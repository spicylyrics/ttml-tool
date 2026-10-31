// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { TTMLLyric } from "$/types/ttml";
import { parseLyric } from "./ttml-parser";
import exportTTMLText from "./ttml-writer";

function ttml(paragraph: string) {
	return `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:amll="http://www.example.com/ns/amll"><head/><body><div>${paragraph}</div></body></tt>`;
}

function withoutIds(lyric: TTMLLyric) {
	return lyric.lyricLines.map(({ id: _id, words, ...line }) => ({
		...line,
		agent: line.agent ?? "v1",
		words: words.map(({ id: _wordId, ...word }) => word),
	}));
}

function roundTrip(xml: string) {
	const parsed = parseLyric(xml);
	const reparsed = parseLyric(exportTTMLText(parsed));
	expect(withoutIds(reparsed)).toEqual(withoutIds(parsed));
	return parsed.lyricLines;
}

describe("TTML round trip", () => {
	it("moves trailing spaces out of a timed syllable and keeps them on export", () => {
		const [line] = roundTrip(
			ttml(
				'<p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:03.000">hello  </span></p>',
			),
		);
		expect(line.words.map((w) => w.word)).toEqual(["hello", "  "]);
		expect(line.words[0]).toMatchObject({ startTime: 1000, endTime: 3000 });
		expect(line.words[1]).toMatchObject({ startTime: 0, endTime: 0 });
	});

	it("keeps timing on each syllable of a multi-word line", () => {
		const [line] = roundTrip(
			ttml(
				'<p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000">one </span><span begin="00:02.000" end="00:03.000">two</span></p>',
			),
		);
		expect(line.words.map((w) => [w.word, w.startTime])).toEqual([
			["one", 1000],
			[" ", 0],
			["two", 2000],
		]);
	});

	it("leaves line-synced text whole", () => {
		const [line] = roundTrip(
			ttml('<p begin="00:01.000" end="00:03.000">a whole line  </p>'),
		);
		expect(line.words.map((w) => w.word).join("")).toBe("a whole line  ");
	});

	it("opens old files with obscene and empty-beat marks and drops them on export", () => {
		const xml = ttml(
			'<p begin="00:01.000" end="00:03.000"><span begin="00:01.000" end="00:02.000" amll:obscene="true" amll:empty-beat="2">bad </span><span begin="00:02.000" end="00:03.000">word</span></p>',
		);
		const [line] = parseLyric(xml).lyricLines;
		expect(
			line.words.filter((w) => w.word.trim()).map((w) => [w.word, w.obscene]),
		).toEqual([
			["bad", false],
			["word", false],
		]);
		const exported = exportTTMLText(parseLyric(xml));
		expect(exported).not.toContain("obscene");
		expect(exported).not.toContain("empty-beat");
	});

	it("writes the duet singer as a person and keeps duets on reimport", () => {
		const xml = ttml(
			'<p begin="00:01.000" end="00:02.000" ttm:agent="v1">main</p><p begin="00:02.000" end="00:03.000" ttm:agent="v2">duet</p>',
		);
		const exported = exportTTMLText(parseLyric(xml));
		expect(exported).toMatch(/<ttm:agent type="person" xml:id="v2"\/>/);
		expect(exported).not.toContain('type="other"');
		const lines = roundTrip(xml);
		expect(lines.map((line) => line.isDuet)).toEqual([false, true]);
	});

	it("treats v1 as the main singer whatever order agents are declared in", () => {
		const xml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v2"/><ttm:agent type="person" xml:id="v1"/></metadata></head><body><div><p begin="00:01.000" end="00:02.000" ttm:agent="v1">main</p><p begin="00:02.000" end="00:03.000" ttm:agent="v2">duet</p></div></body></tt>`;
		const lines = parseLyric(xml).lyricLines;
		expect(lines.map((line) => line.isDuet)).toEqual([false, true]);
	});
});

const ITUNES_TT = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal"`;

describe("romanized word gaps", () => {
	const xml = `${ITUNES_TT}><head><metadata><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><transliterations><transliteration><text for="L1"><span begin="00:01.000" end="00:01.500">yu</span><span begin="00:01.500" end="00:02.000">me</span> <span begin="00:02.000" end="00:03.000">wo</span>
		<span begin="00:03.000" end="00:04.000">mi</span></text></transliteration></transliterations></iTunesMetadata></metadata></head><body><div><p begin="00:01.000" end="00:04.000" itunes:key="L1"><span begin="00:01.000" end="00:01.500">ゆ</span><span begin="00:01.500" end="00:02.000">め</span><span begin="00:02.000" end="00:03.000">を</span><span begin="00:03.000" end="00:04.000">見</span></p></div></body></tt>`;

	it("keeps spaces between romanized syllables of an unspaced line", () => {
		const [line] = roundTrip(xml);
		// The newline before "mi" is indentation, not a gap.
		expect(line.words.map((w) => w.romanWord)).toEqual([
			"yu",
			"me ",
			"wo",
			"mi",
		]);
	});

	it("writes the gap between spans, as Apple does", () => {
		const out = exportTTMLText(parseLyric(xml));
		expect(out).toContain(">me</span> <span");
		expect(out).toContain(">yu</span><span");
	});
});

describe("translation language", () => {
	const withTranslation = (lang: string, text: string) =>
		`${ITUNES_TT}><head/><body><div><p begin="00:01.000" end="00:02.000">line<span ttm:role="x-translation" xml:lang="${lang}">${text}</span></p></div></body></tt>`;

	it("exports translations as English by default", () => {
		const parsed = parseLyric(withTranslation("es", "hola"));
		expect(
			exportTTMLText({ ...parsed, translationLanguage: undefined }),
		).toContain('xml:lang="en"');
	});

	it("keeps the imported language", () => {
		const out = exportTTMLText(parseLyric(withTranslation("es", "hola")));
		expect(out).toContain('xml:lang="es"');
	});

	it("drops the zh-CN tag older exports put on non-Chinese translations", () => {
		const parsed = parseLyric(withTranslation("zh-CN", "a dream"));
		expect(parsed.translationLanguage).toBeUndefined();
		expect(exportTTMLText(parsed)).toContain('xml:lang="en"');
	});

	it("keeps zh-CN on Chinese translations", () => {
		const parsed = parseLyric(withTranslation("zh-CN", "一个梦"));
		expect(parsed.translationLanguage).toBe("zh-CN");
	});
});
