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

	/**
	 * Fetch plain lyrics for a Genius song directly from the Genius website.
	 * Uses a CORS proxy to bypass browse security policies.
	 * @param songUrl The full Genius song URL (e.g. https://genius.com/Artist-song-lyrics)
	 * @returns Plain-text lyrics string
	 */
	async getLyrics(songUrl: string): Promise<string> {
		try {
			// Using a public CORS proxy to fetch the actual Genius page
			const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(songUrl)}`;
			const resp = await fetch(proxyUrl);
			if (!resp.ok) {
				throw new Error(`Failed to fetch Genius page: ${resp.status} ${resp.statusText}`);
			}
			const html = await resp.text();

			// Parse HTML
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// Genius uses multiple divs with class starting with "Lyrics__Container" for the new layout
			let lyricsContainers = doc.querySelectorAll('[class^="Lyrics__Container"]');

			// Fallback for older layout
			if (lyricsContainers.length === 0) {
				const oldContainer = doc.querySelector(".lyrics");
				if (oldContainer) {
					// In the old layout, it's just one div
					return oldContainer.textContent?.trim() || "";
				}
			}

			if (lyricsContainers.length === 0) {
				throw new Error("Could not find lyrics container in the Genius page");
			}

			let fullLyrics = "";
			for (const container of Array.from(lyricsContainers)) {
				// Replace <br> tags with newlines before getting textContent
				const brs = container.querySelectorAll("br");
				for (const br of Array.from(brs)) {
					br.replaceWith("\n");
				}

				// Genius also puts annotations in <a> tags, which we want as plain text
				fullLyrics += `${container.textContent}\n`;
			}

			// --- Cleanup "slop" ---
			let cleaned = fullLyrics.trim();

			// 1. Remove initial "Contributors" / "Translations" metadata block if it bled into the text
			cleaned = cleaned.replace(/^[0-9]+\sContributors.*Lyrics/i, "");

			// 2. Remove [Section Headers] like [Intro], [Chorus: ...], etc.
			cleaned = cleaned.replace(/\[.*?\]/g, "");

			// 3. Final polish: remove multiple spaces, handle line split slop
			return cleaned
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
				.join("\n");
		} catch (error) {
			console.error("Genius Lyrics Direct Fetch Error:", error);
			throw error;
		}
	},
};
