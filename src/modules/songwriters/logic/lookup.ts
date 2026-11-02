import { getGeniusWriters, searchGenius } from "./genius";
import { namesToAdd, normalizeName } from "./merge";
import {
	buildRecordingQuery,
	getRecordingWriters,
	searchRecordings,
} from "./musicbrainz";
import type { SongMatch, SourceResult } from "./types";

export interface SongSearch {
	/** Songs to pick from: Genius first when it's set up, else MusicBrainz. */
	candidates: SongMatch[];
	genius: SongMatch[];
	musicbrainz: SongMatch[];
	errors: Partial<Record<SongMatch["source"], string>>;
}

const message = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

export async function searchSongs(
	title: string,
	artist: string,
	geniusApiKey: string,
): Promise<SongSearch> {
	const [genius, musicbrainz] = await Promise.allSettled([
		geniusApiKey
			? searchGenius(`${artist} ${title}`.trim(), geniusApiKey)
			: Promise.resolve([]),
		searchRecordings(buildRecordingQuery(title, artist)),
	]);
	const geniusHits = genius.status === "fulfilled" ? genius.value : [];
	const mbHits = musicbrainz.status === "fulfilled" ? musicbrainz.value : [];
	const errors: SongSearch["errors"] = {};
	if (genius.status === "rejected") errors.genius = message(genius.reason);
	if (musicbrainz.status === "rejected")
		errors.musicbrainz = message(musicbrainz.reason);
	return {
		candidates: geniusHits.length > 0 ? geniusHits : mbHits,
		genius: geniusHits,
		musicbrainz: mbHits,
		errors,
	};
}

/** Same title, and one artist name contains the other. */
export function isSameSong(a: SongMatch, b: { title: string; artist: string }) {
	if (normalizeName(a.title) !== normalizeName(b.title)) return false;
	const artistA = normalizeName(a.artist);
	const artistB = normalizeName(b.artist);
	if (!artistA || !artistB) return true;
	return artistA.includes(artistB) || artistB.includes(artistA);
}

/**
 * Credits from every source for the picked song. The source it came from
 * uses the pick; the other uses its own search result for the same song.
 */
export async function lookUpWriters(
	picked: SongMatch,
	search: SongSearch,
	geniusApiKey: string,
): Promise<SourceResult[]> {
	const geniusMatch =
		picked.source === "genius"
			? picked
			: search.genius.find((hit) => isSameSong(hit, picked));
	const mbMatch =
		picked.source === "musicbrainz"
			? picked
			: search.musicbrainz.find((hit) => isSameSong(hit, picked));

	const tasks: Promise<SourceResult>[] = [];
	if (geniusApiKey) {
		tasks.push(
			geniusMatch
				? getGeniusWriters(geniusMatch.id, geniusApiKey).then(
						({ writers }) => ({
							source: "genius" as const,
							match: geniusMatch,
							writers,
						}),
						(error) => ({
							source: "genius" as const,
							match: geniusMatch,
							writers: [],
							error: message(error),
						}),
					)
				: Promise.resolve({ source: "genius", match: null, writers: [] }),
		);
	}
	tasks.push(
		mbMatch
			? getRecordingWriters(mbMatch).then(
					(writers) => ({
						source: "musicbrainz" as const,
						match: mbMatch,
						writers,
					}),
					(error) => ({
						source: "musicbrainz" as const,
						match: mbMatch,
						writers: [],
						error: message(error),
					}),
				)
			: Promise.resolve({ source: "musicbrainz", match: null, writers: [] }),
	);
	return Promise.all(tasks);
}

/**
 * Songwriters to add for a song picked elsewhere (the lyrics import), with
 * no one reviewing them: the names every source with credits agrees on, by
 * legal name, minus those already in the list. A Genius pick keeps its id so
 * the lookup doesn't have to guess the song on Genius.
 */
export async function findSongwritersToAdd(
	song: { title: string; artist: string; geniusId?: string },
	geniusApiKey: string,
	existing: string[],
): Promise<string[]> {
	const search = await searchSongs(song.title, song.artist, geniusApiKey);
	const picked: SongMatch | undefined =
		song.geniusId && geniusApiKey
			? {
					source: "genius",
					id: song.geniusId,
					title: song.title,
					artist: song.artist,
				}
			: [...search.musicbrainz, ...search.genius].find((match) =>
					isSameSong(match, song),
				);
	if (!picked) return [];
	return namesToAdd(
		await lookUpWriters(picked, search, geniusApiKey),
		existing,
	);
}
