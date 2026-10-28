import { describe, expect, it, vi } from "vitest";
import type {
	GeniusSearchHit,
	GeniusSearchResponse,
} from "$/modules/genius/types";
import {
	buildRomanizedQueries,
	fetchRomanizedLyrics,
	findRomanizedCandidates,
	GENIUS_ROMANIZATIONS_ARTIST,
	normalizeForMatch,
	rankRomanizedCandidates,
} from "./genius-romanized";

const hit = (
	id: number,
	title: string,
	artistNames: string,
	primaryArtist = artistNames,
) => ({
	id,
	title,
	full_title: `${title} by ${artistNames}`,
	artist_names: artistNames,
	song_art_image_thumbnail_url: "",
	primary_artist: { name: primaryArtist },
});

const idol = { title: "アイドル", artist: "YOASOBI" };

describe("normalizeForMatch", () => {
	it("folds width, case and punctuation", () => {
		expect(normalizeForMatch("ＹＯＡＳＯＢＩ - Idol!")).toBe("yoasobi idol");
	});
});

describe("buildRomanizedQueries", () => {
	it("searches artist and title first, then title alone", () => {
		expect(buildRomanizedQueries(idol)).toEqual([
			"YOASOBI アイドル romanized",
			"アイドル romanized",
		]);
	});

	it("drops duplicates and empty queries", () => {
		expect(buildRomanizedQueries({ title: "Idol", artist: "" })).toEqual([
			"Idol romanized",
		]);
		expect(buildRomanizedQueries({ title: "", artist: "" })).toEqual([]);
	});
});

describe("rankRomanizedCandidates", () => {
	it("keeps only romanized pages", () => {
		const ranked = rankRomanizedCandidates(
			[
				hit(1, "アイドル (Idol)", "YOASOBI"),
				hit(2, "Idol (English Translation)", "Genius English Translations"),
				hit(
					3,
					"YOASOBI - アイドル (Idol) (Romanized)",
					GENIUS_ROMANIZATIONS_ARTIST,
				),
			],
			idol,
		);
		expect(ranked.map((candidate) => candidate.id)).toEqual([3]);
		expect(ranked[0].official).toBe(true);
	});

	it("accepts a Romanized marker from other uploaders", () => {
		const ranked = rankRomanizedCandidates(
			[hit(4, "アイドル (Idol) [Romaji]", "Someone")],
			idol,
		);
		expect(ranked).toHaveLength(1);
		expect(ranked[0].official).toBe(false);
	});

	it("ranks the matching song above other romanized songs", () => {
		const ranked = rankRomanizedCandidates(
			[
				hit(
					5,
					"YOASOBI - 夜に駆ける (Racing Into The Night) (Romanized)",
					GENIUS_ROMANIZATIONS_ARTIST,
				),
				hit(6, "Ado - アイドル (Romanized)", GENIUS_ROMANIZATIONS_ARTIST),
				hit(
					7,
					"YOASOBI - アイドル (Idol) (Romanized)",
					GENIUS_ROMANIZATIONS_ARTIST,
				),
			],
			idol,
		);
		expect(ranked.map((candidate) => candidate.id)).toEqual([7, 6, 5]);
	});

	it("prefers the official account on an equal match", () => {
		const ranked = rankRomanizedCandidates(
			[
				hit(8, "YOASOBI - アイドル (Romanized)", "Fan"),
				hit(9, "YOASOBI - アイドル (Romanized)", GENIUS_ROMANIZATIONS_ARTIST),
			],
			idol,
		);
		expect(ranked.map((candidate) => candidate.id)).toEqual([9, 8]);
	});

	it("drops duplicate hits from overlapping searches", () => {
		const same = hit(
			10,
			"YOASOBI - アイドル (Romanized)",
			GENIUS_ROMANIZATIONS_ARTIST,
		);
		expect(rankRomanizedCandidates([same, same], idol)).toHaveLength(1);
	});
});

describe("findRomanizedCandidates", () => {
	const response = (hits: ReturnType<typeof hit>[]): GeniusSearchResponse => ({
		meta: { status: 200 },
		response: {
			hits: hits.map(
				(result) =>
					({
						type: "song",
						index: "song",
						highlights: [],
						result,
					}) as unknown as GeniusSearchHit,
			),
		},
	});

	it("searches every query with the token and merges the ranked hits", async () => {
		const search = vi
			.fn()
			.mockResolvedValueOnce(
				response([
					hit(
						11,
						"YOASOBI - アイドル (Idol) (Romanized)",
						GENIUS_ROMANIZATIONS_ARTIST,
					),
				]),
			)
			.mockResolvedValueOnce(
				response([
					hit(
						11,
						"YOASOBI - アイドル (Idol) (Romanized)",
						GENIUS_ROMANIZATIONS_ARTIST,
					),
					hit(12, "アイドル (Idol)", "YOASOBI"),
				]),
			);

		const candidates = await findRomanizedCandidates(idol, "token", { search });

		expect(search).toHaveBeenCalledWith("YOASOBI アイドル romanized", "token");
		expect(search).toHaveBeenCalledWith("アイドル romanized", "token");
		expect(candidates.map((candidate) => candidate.id)).toEqual([11]);
	});

	it("keeps the other query's results when one search fails", async () => {
		const search = vi
			.fn()
			.mockRejectedValueOnce(new Error("500"))
			.mockResolvedValueOnce(
				response([
					hit(
						13,
						"YOASOBI - アイドル (Idol) (Romanized)",
						GENIUS_ROMANIZATIONS_ARTIST,
					),
				]),
			);
		const candidates = await findRomanizedCandidates(idol, "token", { search });
		expect(candidates.map((candidate) => candidate.id)).toEqual([13]);
	});

	it("passes search failures through when every search fails", async () => {
		const search = vi.fn().mockRejectedValue(new Error("401"));
		await expect(
			findRomanizedCandidates(idol, "bad", { search }),
		).rejects.toThrow("401");
	});
});

describe("fetchRomanizedLyrics", () => {
	it("fetches the picked song's lyrics", async () => {
		const getLyrics = vi.fn().mockResolvedValue("Kimi no na wo");
		await expect(fetchRomanizedLyrics(11, { getLyrics })).resolves.toBe(
			"Kimi no na wo",
		);
		expect(getLyrics).toHaveBeenCalledWith(11);
	});
});
