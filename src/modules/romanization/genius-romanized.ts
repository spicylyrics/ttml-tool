import { GeniusApi } from "$/modules/genius/api/client";
import type { GeniusSearchHit } from "$/modules/genius/types";

/** The account Genius publishes its romanized lyric pages under. */
export const GENIUS_ROMANIZATIONS_ARTIST = "Genius Romanizations";

const ROMANIZED_MARKER = /\b(romani[sz]ed|romaji|rōmaji)\b/i;
const MAX_CANDIDATES = 8;

type HitResult = Pick<
	GeniusSearchHit["result"],
	| "id"
	| "title"
	| "full_title"
	| "artist_names"
	| "song_art_image_thumbnail_url"
> & { primary_artist?: { name: string } };

export interface RomanizedSong {
	title: string;
	artist: string;
}

export interface RomanizedCandidate {
	id: number;
	title: string;
	artist: string;
	cover?: string;
	/** Published by Genius's own romanization account. */
	official: boolean;
	score: number;
}

/** Lowercase, width-folded text with only letters, digits and single spaces. */
export function normalizeForMatch(text: string): string {
	return text
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function tokens(text: string): string[] {
	return normalizeForMatch(text).split(" ").filter(Boolean);
}

/** Share of `wanted`'s tokens that appear in `text`. */
function tokenOverlap(wanted: string, text: string): number {
	const wantedTokens = tokens(wanted);
	if (wantedTokens.length === 0) return 0;
	const have = new Set(tokens(text));
	return (
		wantedTokens.filter((token) => have.has(token)).length / wantedTokens.length
	);
}

function scoreHit(hit: HitResult, song: RomanizedSong): number {
	const official = hit.primary_artist?.name === GENIUS_ROMANIZATIONS_ARTIST;
	const haystack = normalizeForMatch(`${hit.full_title} ${hit.artist_names}`);
	const title = normalizeForMatch(song.title);
	const artist = normalizeForMatch(song.artist);

	let score = official ? 2 : 0;
	if (title) {
		score += haystack.includes(title)
			? 4
			: 3 * tokenOverlap(song.title, haystack);
	}
	if (artist) {
		score += haystack.includes(artist)
			? 2
			: 2 * tokenOverlap(song.artist, haystack);
	}
	return score;
}

/** Search queries for a song's romanized page, most specific first. */
export function buildRomanizedQueries(song: RomanizedSong): string[] {
	const title = song.title.trim();
	const artist = song.artist.trim();
	const queries = [
		[artist, title, "romanized"].filter(Boolean).join(" "),
		[title, "romanized"].filter(Boolean).join(" "),
	];
	return [...new Set(queries)].filter((query) => query !== "romanized");
}

/**
 * Keeps only romanized pages (a "Romanized" marker in the title, or the
 * Genius Romanizations account) and orders them by how well the title and
 * artist match the song. Search order breaks ties.
 */
export function rankRomanizedCandidates(
	hits: readonly HitResult[],
	song: RomanizedSong,
): RomanizedCandidate[] {
	const seen = new Set<number>();
	const ranked: RomanizedCandidate[] = [];
	for (const hit of hits) {
		if (seen.has(hit.id)) continue;
		seen.add(hit.id);
		const official = hit.primary_artist?.name === GENIUS_ROMANIZATIONS_ARTIST;
		if (!official && !ROMANIZED_MARKER.test(hit.full_title)) continue;
		ranked.push({
			id: hit.id,
			title: hit.title,
			artist: hit.artist_names,
			cover: hit.song_art_image_thumbnail_url || undefined,
			official,
			score: scoreHit(hit, song),
		});
	}
	return ranked
		.map((candidate, index) => ({ candidate, index }))
		.sort((a, b) => b.candidate.score - a.candidate.score || a.index - b.index)
		.map(({ candidate }) => candidate)
		.slice(0, MAX_CANDIDATES);
}

type RomanizedSearchApi = Pick<typeof GeniusApi, "search">;

/**
 * Searches Genius for romanized versions of a song and ranks them. One failed
 * query still returns the other's results; it only throws when all fail.
 */
export async function findRomanizedCandidates(
	song: RomanizedSong,
	apiKey: string,
	api: RomanizedSearchApi = GeniusApi,
): Promise<RomanizedCandidate[]> {
	const settled = await Promise.allSettled(
		buildRomanizedQueries(song).map((query) => api.search(query, apiKey)),
	);
	const responses = settled.flatMap((result) =>
		result.status === "fulfilled" ? [result.value] : [],
	);
	const failure = settled.find((result) => result.status === "rejected");
	if (responses.length === 0 && failure) throw failure.reason;
	const hits = responses.flatMap(({ response }) =>
		response.hits.filter((hit) => hit.type === "song").map((hit) => hit.result),
	);
	return rankRomanizedCandidates(hits, song);
}

/** Plain lyrics of a picked candidate, fetched the same way the import does. */
export function fetchRomanizedLyrics(
	id: number,
	api: Pick<typeof GeniusApi, "getLyrics"> = GeniusApi,
): Promise<string> {
	return api.getLyrics(id);
}
