import type {
	GeniusArtistResponse,
	GeniusSearchResponse,
	GeniusSongResponse,
} from "../types";

const BASE_URL = "https://api.genius.com";

/**
 * The Genius page itself is not CORS-enabled. Its public embed endpoint is,
 * and returns the lyrics as an escaped HTML string inside `document.write`.
 */
/** A first line naming the page: "[... Lyrics]" in any of Genius's languages. */
const GENIUS_TITLE =
	/^\s*\[[^\]\n]*(?:Lyrics|歌詞|歌词|가사|Paroles|Letra|Songtext|Testo|Tekst|Текст песни|Şarkı Sözleri|Lirik)\]\s*\n?/iu;

export const extractLyricsFromEmbed = (embedScript: string): string => {
	const match = embedScript.match(
		/document\.write\(JSON\.parse\('((?:\\.|[^'])*)'\)\)/s,
	);

	if (!match) {
		throw new Error("Lyrics were not present in the Genius embed response.");
	}

	try {
		// Decode the JavaScript single-quoted string enough to restore the JSON
		// string passed to JSON.parse. Do not evaluate the remote script.
		let jsonString = "";
		for (let i = 0; i < match[1].length; i++) {
			const character = match[1][i];
			if (character === "\\" && i + 1 < match[1].length) {
				const escaped = match[1][++i];
				jsonString +=
					escaped === "n"
						? "\n"
						: escaped === "r"
							? "\r"
							: escaped === "t"
								? "\t"
								: escaped;
			} else {
				jsonString += character;
			}
		}
		const html = JSON.parse(jsonString) as string;
		const bodyMatch = html.match(
			/<div\b[^>]*class=["'][^"']*\brg_embed_body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
		);
		if (!bodyMatch) {
			throw new Error("Lyrics were empty in the Genius embed response.");
		}

		let lyrics: string | undefined;
		if (typeof DOMParser !== "undefined") {
			const document = new DOMParser().parseFromString(
				bodyMatch[1],
				"text/html",
			);
			for (const breakElement of document.querySelectorAll("br")) {
				breakElement.replaceWith("\n");
			}
			lyrics = document.body.textContent?.trim();
		} else {
			lyrics = bodyMatch[1]
				.replace(/<br\s*\/?>/gi, "\n")
				.replace(/<[^>]+>/g, "")
				.trim();
		}

		if (!lyrics) {
			throw new Error("Lyrics were empty in the Genius embed response.");
		}

		// The embed markup commonly puts a source newline after every <br>.
		// `textContent` retains both, which otherwise creates a blank line after
		// each lyric line.
		// The embed can open with the page title in brackets ("[Artist「Song」
		// 歌詞]", "[Song Lyrics]"), which would read as a section header.
		return lyrics.replace(/\n[\t ]*\n/g, "\n").replace(GENIUS_TITLE, "");
	} catch (error) {
		if (error instanceof Error) throw error;
		throw new Error("Could not parse the Genius embed response.");
	}
};

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
	async getArtistById(
		id: number,
		apiKey: string,
	): Promise<GeniusArtistResponse> {
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
	 * Fetch plain lyrics from Genius's CORS-enabled public embed endpoint.
	 * @param songId The Genius song ID returned by search.
	 * @returns Plain-text lyrics string
	 */
	async getLyrics(songId: number): Promise<string> {
		try {
			const response = await fetch(
				`https://genius.com/songs/${songId}/embed.js`,
			);
			if (!response.ok) {
				throw new Error(
					`Genius lyrics request failed: ${response.status} ${response.statusText}`,
				);
			}

			return extractLyricsFromEmbed(await response.text());
		} catch (error) {
			console.error("Genius Scraper Error:", error);
			throw error;
		}
	},
};
