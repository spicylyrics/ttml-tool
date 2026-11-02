import { GeniusApi } from "$/modules/genius/api/client";
import { LrcLibApi } from "$/modules/lrclib/api/client";
import { lrcToPlainLyrics } from "$/utils/parse-lrc";

export type OnlineImportSource = "lrclib" | "genius";

/** A search hit from an online source. Picking one only fills the text area and metadata. */
export interface ImportTrack {
	source: OnlineImportSource;
	id: string | number;
	name: string;
	artist: string;
	album?: string;
	duration?: number;
	cover?: string;
	synced?: boolean;
	lyrics?: string;
	fetchLyrics?: () => Promise<string>;
}

export async function searchOnlineLyrics(
	source: OnlineImportSource,
	query: string,
	geniusApiKey: string,
): Promise<ImportTrack[]> {
	if (source === "lrclib") {
		return (await LrcLibApi.search(query)).map((track) => ({
			source,
			id: track.id,
			name: track.name,
			artist: track.artistName,
			album: track.albumName,
			duration: track.duration,
			synced: !!track.syncedLyrics,
			lyrics:
				track.plainLyrics ||
				(track.syncedLyrics ? lrcToPlainLyrics(track.syncedLyrics) : ""),
		}));
	}
	const { hits } = (await GeniusApi.search(query, geniusApiKey)).response;
	return hits.map(({ result }) => ({
		source,
		id: result.id,
		name: result.title,
		artist: result.primary_artist.name,
		album: result.album?.name,
		cover: result.song_art_image_url || result.song_art_image_thumbnail_url,
		fetchLyrics: () => GeniusApi.getLyrics(result.id),
	}));
}
