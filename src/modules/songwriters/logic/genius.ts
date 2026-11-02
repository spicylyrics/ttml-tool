import { GeniusApi } from "$/modules/genius/api/client";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { guessRealName } from "$/modules/lyrics-import/logic/online-sources";
import type { SongMatch, SourceWriter } from "./types";

export async function searchGenius(
	query: string,
	apiKey: string,
): Promise<SongMatch[]> {
	const data = await GeniusApi.search(query, apiKey);
	return data.response.hits
		.filter((hit) => hit.type === "song")
		.map((hit) => ({
			source: "genius",
			id: String(hit.result.id),
			title: hit.result.title,
			artist: hit.result.primary_artist.name,
			album: hit.result.album?.name,
			coverUrl: getBetterGeniusCoverArt(
				hit.result.song_art_image_url ||
					hit.result.song_art_image_thumbnail_url,
				100,
			),
		}));
}

/** Writers credited on Genius, with a legal name guessed from each profile. */
export async function getGeniusWriters(
	songId: string,
	apiKey: string,
): Promise<{ writers: SourceWriter[]; album?: string }> {
	const { song } = (await GeniusApi.getSongById(Number(songId), apiKey))
		.response;
	const writers: SourceWriter[] = [];
	for (const artist of song.writer_artists) {
		let legal: string | undefined;
		try {
			const detail = (await GeniusApi.getArtistById(artist.id, apiKey)).response
				.artist;
			const guess = guessRealName(artist.name, detail);
			if (guess !== artist.name) legal = guess;
		} catch {
			// Keep the credited name when the profile can't be read.
		}
		writers.push({ credited: artist.name, legal });
	}
	return { writers, album: song.album?.name };
}
