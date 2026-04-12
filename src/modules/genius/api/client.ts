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
			// For Genius, we add a random cache-buster and try to mimic a browser better by reordering proxies
			const cacheBuster = `?cb=${Math.random().toString(36).substring(7)}`;
			const targetUrl = songUrl.includes("?") ? `${songUrl}&${cacheBuster.slice(1)}` : `${songUrl}${cacheBuster}`;

			const proxies = [
				(url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
				(url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
				(url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
				(url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
				(url: string) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
			];

			let resp: Response | null = null;
			let lastError: Error | null = null;

			for (let i = 0; i < proxies.length; i++) {
				try {
					const proxyUrl = proxies[i](targetUrl);
					resp = await fetch(proxyUrl);
					if (resp.ok) break;
					lastError = new Error(`Proxy ${i + 1} (${new URL(proxies[i]('')).hostname}) returned ${resp.status}`);
					
					if (i < proxies.length - 1) {
						await new Promise(resolve => setTimeout(resolve, i * 200 + 100));
					}
				} catch (e) {
					lastError = e as Error;
				}
			}

			if (!resp || !resp.ok) {
				throw new Error(`Failed to fetch Genius page (tried ${proxies.length} proxies). Last error: ${lastError?.message || "Unknown"}`);
			}
			const html = await resp.text();

			// Handle JSON-wrapped proxy responses (e.g. allorigins /get endpoint)
			let htmlContent = html;
			try {
				const possibleJson = JSON.parse(html);
				if (possibleJson.contents) {
					htmlContent = possibleJson.contents;
				}
			} catch (e) {
				// Not a JSON response, continue with raw HTML
			}

			const parser = new DOMParser();
			const doc = parser.parseFromString(htmlContent, "text/html");

			// Check for anti-bot pages
			if (htmlContent.includes("cf-browser-verification") || htmlContent.includes("Cloudflare") || htmlContent.includes("captcha")) {
				throw new Error("Genius request blocked (Cloudflare/Captcha). Try again later or use a different proxy.");
			}

			// Method 1: Extraction from window.__PRELOADED_STATE__ (Most robust)
			try {
				// Genius uses multiple ways to store state depending on the page version
				const stateRegexes = [
					/window\.__PRELOADED_STATE__\s*=\s*JSON\.parse\('(.*?)'\)/,
					/window\.__PRELOADED_STATE__\s*=\s*({.*?});/,
					/window\.__PRELOADED_STATE__\s*=\s*(.*?)<\/script>/s
				];

				let stateString: string | null = null;
				for (const reg of stateRegexes) {
					const match = htmlContent.match(reg);
					if (match) {
						stateString = match[1];
						break;
					}
				}

				if (stateString) {
					// Handle escaped characters if it was a JSON.parse('') match
					if (stateString.startsWith("'") || stateString.includes("\\'")) {
						stateString = stateString.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
						if (stateString.startsWith("'") && stateString.endsWith("'")) {
							stateString = stateString.slice(1, -1);
						}
					}
					
					const state = JSON.parse(stateString);
					
					// Search deep for lyrics data
					const lyricsData = state.songPage?.lyricsData?.body?.html || 
									 state.song?.lyricsData?.body?.html || 
									 state.lyricsData?.body?.html;

					if (lyricsData) {
						const lyricsDoc = parser.parseFromString(lyricsData, "text/html");
						return lyricsDoc.body.textContent?.trim() || "";
					}
				}
			} catch (e) {
				console.warn("Genius JSON parse failed, falling back to DOM:", e);
			}

			// Method 2: DOM selectors
			let lyricsContainers = Array.from(doc.querySelectorAll('[data-lyrics-container="true"]'));

			if (lyricsContainers.length === 0) {
				lyricsContainers = Array.from(doc.querySelectorAll('[class^="Lyrics__Container"]'));
			}

			let backupLyrics = "";
			if (lyricsContainers.length === 0) {
				const oldContainer = doc.querySelector(".lyrics");
				if (oldContainer) {
					backupLyrics = oldContainer.textContent?.trim() || "";
				}
			}

			if (lyricsContainers.length === 0 && !backupLyrics) {
				const anyLyrics = doc.querySelector('[id*="lyrics"], [class*="lyrics"]');
				if (anyLyrics && anyLyrics.textContent && anyLyrics.textContent.length > 250) {
					backupLyrics = anyLyrics.textContent.trim();
				}
			}

			if (lyricsContainers.length === 0 && !backupLyrics) {
				const title = doc.title || "No Title";
				console.log("Debug Genius HTML Content:", htmlContent.slice(0, 1000));
				throw new Error(`Lyrics not found (Page: "${title}"). Possible redirection or blocked content.`);
			}

			let fullLyrics = backupLyrics;
			if (lyricsContainers.length > 0) {
				for (const container of lyricsContainers) {
					const brs = container.querySelectorAll("br");
					for (const br of Array.from(brs)) {
						br.replaceWith("\n");
					}
					fullLyrics += `${container.textContent}\n`;
				}
			}

			// --- Cleanup "slop" ---
			let cleaned = fullLyrics.trim();
			cleaned = cleaned.replace(/^[0-9]+\sContributors.*Lyrics/i, "");
			cleaned = cleaned.replace(/\[.*?\]/g, "");
			
			return cleaned
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0)
				.join("\n");
		} catch (error) {
			console.error("Genius Scraper Error:", error);
			throw error;
		}
	},
};
