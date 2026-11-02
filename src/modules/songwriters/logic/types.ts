export type SongwriterSource = "genius" | "musicbrainz";

/** A song a source found for the search, before its credits are fetched. */
export interface SongMatch {
	source: SongwriterSource;
	id: string;
	title: string;
	artist: string;
	album?: string;
	coverUrl?: string;
	/** Other MusicBrainz recordings of the same song, tried when this one has no credits. */
	alternateIds?: string[];
}

/** One writer as a source credits them. */
export interface SourceWriter {
	/** The name the source credits, often a stage name. */
	credited: string;
	/** The legal name, when the source knows it and it differs. */
	legal?: string;
}

export interface SourceResult {
	source: SongwriterSource;
	/** The song this source took the credits from; null when it found none. */
	match: SongMatch | null;
	writers: SourceWriter[];
	/** Set when the source failed, as opposed to having no credits. */
	error?: string;
}
