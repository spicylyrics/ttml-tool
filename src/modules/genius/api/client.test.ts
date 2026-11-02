import { describe, expect, it } from "vitest";
import { extractLyricsFromEmbed } from "./client";

describe("extractLyricsFromEmbed", () => {
	it("drops the page title line Genius puts first", () => {
		const embed = (body: string) =>
			String.raw`document.write(JSON.parse('\"<div class=\\\"rg_embed_body\\\">` +
			body +
			String.raw`<\\/div>\"'))`;
		expect(
			extractLyricsFromEmbed(
				embed(
					"[AnythingBecomeMoe「やラララ」ft. 重音テト 歌詞]<br>[Chorus]<br>やラララ",
				),
			),
		).toBe("[Chorus]\nやラララ");
		expect(
			extractLyricsFromEmbed(embed("[Idol Lyrics]<br>[Verse 1]<br>Hello")),
		).toBe("[Verse 1]\nHello");
		// A first section header stays.
		expect(extractLyricsFromEmbed(embed("[Intro]<br>Hello"))).toBe(
			"[Intro]\nHello",
		);
	});

	it("extracts lyrics from Genius's escaped embed payload without evaluating it", () => {
		const embedScript = String.raw`document.write(JSON.parse('\"<div class=\\\"rg_embed_body\\\">First line<br>\\nSecond line\\nI\'m here<\\/div>\"'))`;

		expect(extractLyricsFromEmbed(embedScript)).toBe(
			"First line\nSecond line\nI'm here",
		);
	});

	it("rejects embed responses that do not contain lyrics", () => {
		expect(() => extractLyricsFromEmbed("document.write('nope')")).toThrow(
			"Lyrics were not present",
		);
	});
});
