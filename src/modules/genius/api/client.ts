import type {
	GeniusArtistResponse,
	GeniusSearchResponse,
	GeniusSongResponse,
} from "../types";

const BASE_URL = "https://api.genius.com";

export const GeniusApi = {
	/**
	 * Search for a song on Genius
	 * @param query The search query (e.g. "Artist - Song")
	 * @param apiKey The Genius API key
	 * @returns A list of search hits
	 */
	async search(query: string, apiKey: string): Promise<GeniusSearchResponse> {
		if (!query.trim()) {
			return { meta: { status: 200 }, response: { hits: [] } };
		}

		try {
			const response = await fetch(
				`${BASE_URL}/search?q=${encodeURIComponent(query)}&access_token=${apiKey}`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Search failed: ${response.status} ${response.statusText}`,
				);
			}

			return (await response.json()) as GeniusSearchResponse;
		} catch (error) {
			console.error("Genius API Error (Search):", error);
			throw error;
		}
	},

	/**
	 * Get detailed information about a song by ID
	 * @param id The Genius song ID
	 * @param apiKey The Genius API key
	 * @returns The song detail response
	 */
	async getSongById(id: number, apiKey: string): Promise<GeniusSongResponse> {
		try {
			const response = await fetch(
				`${BASE_URL}/songs/${id}?access_token=${apiKey}`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Get Song failed: ${response.status} ${response.statusText}`,
				);
			}

			return (await response.json()) as GeniusSongResponse;
		} catch (error) {
			console.error("Genius API Error (GetById):", error);
			throw error;
		}
	},

	/**
	 * Get detailed information about an artist by ID
	 * @param id The Genius artist ID
	 * @param apiKey The Genius API key
	 * @returns The artist detail response
	 */
	async getArtistById(id: number, apiKey: string): Promise<GeniusArtistResponse> {
		try {
			const response = await fetch(
				`${BASE_URL}/artists/${id}?access_token=${apiKey}&text_format=plain`,
			);

			if (!response.ok) {
				throw new Error(
					`Genius Get Artist failed: ${response.status} ${response.statusText}`,
				);
			}

			return (await response.json()) as GeniusArtistResponse;
		} catch (error) {
			console.error("Genius API Error (GetArtistById):", error);
			throw error;
		}
	},
};
