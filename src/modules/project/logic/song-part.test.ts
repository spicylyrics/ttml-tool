// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "./ttml-parser";
import exportTTMLText from "./ttml-writer";

const NS =
	'xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" xmlns:amll="http://www.example.com/ns/amll"';

const p = (text: string, begin: number, extra = "") =>
	`<p begin="00:0${begin}.000" end="00:0${begin}.900"${extra}>${text}</p>`;

const apple = `<tt ${NS}><head/><body>
<div itunes:song-part="Verse">${p("one", 1)}${p("two", 2)}</div>
<div itunes:song-part="PreChorus">${p("three", 3)}</div>
<div itunes:song-part="Chorus">${p("four", 4)}</div>
<div itunes:song-part="Verse">${p("five", 5)}</div>
<div itunes:song-part="Chorus">${p("six", 6)}</div>
<div itunes:song-part="Chorus">${p("seven", 7)}</div>
<div itunes:song-part="Drop">${p("eight", 8)}</div>
<div>${p("nine", 9)}</div>
</body></tt>`;

const labels = (xml: string) => {
	const lyric = parseLyric(xml);
	return lyric.lyricLines.map(
		(line) =>
			lyric.sections?.find((section) => section.id === line.sectionId)?.label,
	);
};

describe("itunes:song-part import", () => {
	it("makes one section per div, numbered per category", () => {
		expect(labels(apple)).toEqual([
			"[Verse 1]",
			"[Verse 1]",
			"[Pre-Chorus 1]",
			"[Chorus 1]",
			"[Verse 2]",
			"[Chorus 2]",
			"[Chorus 3]",
			"[Drop]",
			undefined,
		]);
		const lyric = parseLyric(apple);
		expect(lyric.sections?.map((section) => section.category)).toEqual([
			"verse",
			"pre-chorus",
			"chorus",
			"verse",
			"chorus",
			"chorus",
			"other",
		]);
	});

	it("merges same-valued runs set on <p>", () => {
		const xml = `<tt ${NS}><head/><body><div>${p("a", 1, ' itunes:song-part="Hook"')}${p("b", 2, ' itunes:song-part="Hook"')}${p("c", 3, ' itunes:song-part="Outro"')}</div></body></tt>`;
		expect(labels(xml)).toEqual(["[Hook 1]", "[Hook 1]", "[Outro 1]"]);
	});

	it("adds no sections to a TTML without song-parts", () => {
		const plain = `<tt ${NS}><head/><body><div>${p("a", 1)}${p("b", 2)}</div></body></tt>`;
		const lyric = parseLyric(plain);
		expect(lyric.sections).toBeUndefined();
		expect(lyric.lyricLines.every((line) => !line.sectionId)).toBe(true);
	});

	it("lets amll:sections win over song-part", () => {
		const ours = parseLyric(apple);
		const exported = exportTTMLText(ours);
		expect(exported).not.toContain("song-part");
		const withSongParts = exported.replace(
			/<p /,
			'<p itunes:song-part="Bridge" ',
		);
		const reread = parseLyric(withSongParts);
		expect(reread.sections?.map((section) => section.label)).toEqual(
			ours.sections?.map((section) => section.label),
		);
		expect(reread.lyricLines.map((line) => line.sectionId)).toEqual(
			ours.lyricLines.map((line) => line.sectionId),
		);
	});
});
