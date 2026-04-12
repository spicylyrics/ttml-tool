export interface LyricallySearchResponse {
	error: boolean;
	data: LyricallyTrack[];
}

export interface LyricallyTrack {
	name: string;
	artist: string;
	album?: string;
	cover?: string;
	lyrics?: string;
	source?: string;
}
