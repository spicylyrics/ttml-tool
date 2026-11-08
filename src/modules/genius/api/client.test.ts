import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	extractLyricsFromEmbed,
	GeniusApi,
	GeniusLyricsBlockedError,
} from "./client";

describe("GeniusApi.getLyrics", () => {
	const embed = String.raw`document.write(JSON.parse('\"<div class=\\\"rg_embed_body\\\">Hello<\\/div>\"'))`;
	const ok = () => new Response(embed, { status: 200 });
	const challenge = () => new Response("<html>", { status: 403 });
	const fetchMock = vi.fn<typeof fetch>();

	const getLyrics = async () => {
		const result = GeniusApi.getLyrics(1).then(
			(lyrics) => ({ lyrics }),
			(error: unknown) => ({ error }),
		);
		await vi.runAllTimersAsync();
		return result;
	};

	beforeEach(() => {
		fetchMock.mockReset();
		vi.useFakeTimers();
		vi.stubGlobal("fetch", fetchMock);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("retries when the browser hides a Cloudflare challenge as a network error", async () => {
		fetchMock
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockResolvedValueOnce(ok());

		await expect(getLyrics()).resolves.toEqual({ lyrics: "Hello" });
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("retries a visible 403", async () => {
		fetchMock.mockResolvedValueOnce(challenge()).mockResolvedValueOnce(ok());

		await expect(getLyrics()).resolves.toEqual({ lyrics: "Hello" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("reports a block after three failed attempts", async () => {
		fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

		const result = await getLyrics();
		expect(result).toEqual({ error: expect.any(GeniusLyricsBlockedError) });
		expect(result).toMatchObject({
			error: { songUrl: "https://genius.com/songs/1" },
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("does not retry a missing song", async () => {
		fetchMock.mockResolvedValue(new Response("", { status: 404 }));

		const result = await getLyrics();
		expect(result).toEqual({ error: expect.any(Error) });
		expect(result).not.toEqual({ error: expect.any(GeniusLyricsBlockedError) });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("does not retry or blame Genius while offline", async () => {
		vi.stubGlobal("navigator", { onLine: false });
		const offline = new TypeError("Failed to fetch");
		fetchMock.mockRejectedValue(offline);

		await expect(getLyrics()).resolves.toEqual({ error: offline });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

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
