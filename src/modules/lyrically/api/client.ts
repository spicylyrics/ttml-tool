import type { LyricallyTrack } from "../types";

export const LyricallyApi = {
	/**
	 * Search for lyrics using the aggregator API.
	 * Swapped to api.lyrics.ovh which uses Deezer internally for search, resolving the offline domain paxsenix.biz.
	 * @param query Search keywords (e.g. "Artist - Song")
	 * @returns A list of potential matches with lyrics already included.
	 */
	async search(query: string): Promise<LyricallyTrack[]> {
		if (!query.trim()) return [];

		try {
			const res = await fetch(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`);
			if (!res.ok) throw new Error("Search failed");
			const json = await res.json();
			
			// Map Deezer response to our track format
			return (json.data || []).map((track: any) => {
				const rawCover = track.album?.cover_xl || track.album?.cover_medium || "";
				// Deezer API returns http:// which causes mixed-content errors on Vercel
				const secureCover = rawCover.replace("http://", "https://");
				
				return {
					name: track.title,
					artist: track.artist?.name || "Unknown Artist",
					album: track.album?.title || "",
					cover: secureCover,
					source: "lyrics.ovh",
					lyrics: "" // Fetched lazily
				};
			});

		} catch (error) {
			console.error("Lyrics API Error:", error);
			throw error;
		}
	},

	/**
	 * Get lyrics directly for a specific song and artist.
	 * @param name Song name
	 * @param artist Artist name
	 */
	async getLyrics(name: string, artist: string): Promise<LyricallyTrack> {
		try {
			const res = await fetch(
				`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(name)}`
			);
			if (!res.ok) throw new Error("Lyrics not found on public database.");
			
			const data = await res.json();
			return {
				name,
				artist,
				source: "lyrics.ovh",
				lyrics: data.lyrics || ""
			};
		} catch (error) {
			console.error("Lyrics API Error:", error);
			throw error;
		}
	},
};


