import { GeniusApi } from "$/modules/genius/api/client";
import type { GeniusArtistDetail } from "$/modules/genius/types";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import type { SongMatch, SourceWriter } from "./types";

const STAGE_NAME_PREFIXES = ["King ", "The ", "Mr. ", "aka ", "alias ", "DJ "];

/** Best guess at an artist's legal name from their Genius profile. */
export function guessRealName(
	artistName: string,
	detail: Pick<GeniusArtistDetail, "alternate_names" | "description">,
): string {
	const description = detail.description.plain || "";
	const bornMatch = description.match(
		/born\s+([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/,
	);
	const realNameMatch = description.match(
		/real\s+name\s+(?:is\s+)?([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/i,
	);
	const lowerArtist = artistName.toLowerCase();
	const candidates = (detail.alternate_names ?? []).filter((name) => {
		const wordCount = name.split(" ").length;
		return (
			!name.toLowerCase().includes(lowerArtist) &&
			!lowerArtist.includes(name.toLowerCase()) &&
			wordCount >= 2 &&
			wordCount <= 4 &&
			!STAGE_NAME_PREFIXES.some((prefix) => name.startsWith(prefix)) &&
			name.split(" ").every((word) => /^[A-Z]/.test(word)) &&
			!name.includes("http") &&
			!name.includes("www.")
		);
	});
	return (
		bornMatch?.[1] ||
		realNameMatch?.[1] ||
		candidates.sort((a, b) => a.length - b.length)[0] ||
		artistName
	);
}

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
