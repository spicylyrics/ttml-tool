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
			// We try multiple proxies to increase reliability as Genius aggressively blocks them.
			const proxies = [
				(url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
				(url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
				(url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
				(url: string) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
			];

			let resp: Response | null = null;
			let lastError: Error | null = null;

			for (let i = 0; i < proxies.length; i++) {
				try {
					const proxyUrl = proxies[i](songUrl);
					resp = await fetch(proxyUrl);
					if (resp.ok) break;
					lastError = new Error(`Proxy ${i + 1} returned ${resp.status} ${resp.statusText}`);
					
					// If not the last proxy, wait a bit before trying the next one
					if (i < proxies.length - 1) {
						await new Promise(resolve => setTimeout(resolve, 500));
					}
				} catch (e) {
					lastError = e as Error;
				}
			}

			if (!resp || !resp.ok) {
				throw new Error(`Failed to fetch Genius page: ${lastError?.message || "All proxies failed"}`);
			}
			const html = await resp.text();

			// Parse HTML
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, "text/html");

			// Check for anti-bot pages
			if (html.includes("cf-browser-verification") || html.includes("Cloudflare")) {
				throw new Error("Genius request blocked by Cloudflare. Try again later or use a different proxy.");
			}

			// Method 1: Extraction from window.__PRELOADED_STATE__ (Most robust)
			// This contains the lyrics data in a structured format (D-Script)
			try {
				const stateMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\('(.*?)'\)/);
				let stateString = stateMatch ? stateMatch[1] : null;
				if (!stateString) {
					const directMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/);
					stateString = directMatch ? directMatch[1] : null;
				}

				if (stateString) {
					// Handle escaped characters if it was a JSON.parse('') match
					if (stateMatch) {
						stateString = stateString.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
					}
					const state = JSON.parse(stateString);
					
					// The path to lyrics varies, but it's usually in songPage.lyricsData
					const lyricsData = state.songPage?.lyricsData?.body?.html || "";
					if (lyricsData) {
						const lyricsDoc = parser.parseFromString(lyricsData, "text/html");
						return lyricsDoc.body.textContent?.trim() || "";
					}
				}
			} catch (e) {
				console.warn("Failed to parse __PRELOADED_STATE__:", e);
			}

			// Method 2: DOM selectors (current standard)
			let lyricsContainers = Array.from(doc.querySelectorAll('[data-lyrics-container="true"]'));

			// Fallback 1: Legacy class-based selector
			if (lyricsContainers.length === 0) {
				lyricsContainers = Array.from(doc.querySelectorAll('[class^="Lyrics__Container"]'));
			}

			// Fallback 2: Old layout with .lyrics class
			let backupLyrics = "";
			if (lyricsContainers.length === 0) {
				const oldContainer = doc.querySelector(".lyrics");
				if (oldContainer) {
					backupLyrics = oldContainer.textContent?.trim() || "";
				}
			}

			// Fallback 3: Search for any element with "lyrics" in ID or class as a last resort
			if (lyricsContainers.length === 0 && !backupLyrics) {
				const anyLyrics = doc.querySelector('[id*="lyrics"], [class*="lyrics"]');
				// Filter for elements that actually look like lyrics (long text)
				if (anyLyrics && anyLyrics.textContent && anyLyrics.textContent.length > 200) {
					backupLyrics = anyLyrics.textContent.trim();
				}
			}

			if (lyricsContainers.length === 0 && !backupLyrics) {
				// If we have HTML but no lyrics, the proxy might have returned a skeleton or error page.
				const title = doc.title || "Unknown Page";
				throw new Error(`Could not find lyrics container (Page Title: ${title}). Genius might have changed their layout.`);
			}

			let fullLyrics = backupLyrics;
			if (lyricsContainers.length > 0) {
				for (const container of lyricsContainers) {
					// Replace <br> tags with newlines before getting textContent
					const brs = container.querySelectorAll("br");
					for (const br of Array.from(brs)) {
						br.replaceWith("\n");
					}

					// Genius also puts annotations in <a> tags, which we want as plain text
					fullLyrics += `${container.textContent}\n`;
				}
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
