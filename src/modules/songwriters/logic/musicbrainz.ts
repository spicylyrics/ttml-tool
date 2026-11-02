import type { SongMatch, SourceWriter } from "./types";

const BASE_URL = "https://musicbrainz.org/ws/2";

/** MusicBrainz allows one request per second per client. */
const MIN_GAP_MS = 1100;
/** Relationship types on a work that name a songwriter. */
const WRITER_TYPES = new Set(["writer", "composer", "lyricist", "librettist"]);
/** How many recordings to try before giving up on finding a linked work. */
const MAX_RECORDINGS_TRIED = 3;

let lastRequest = 0;
let queue: Promise<unknown> = Promise.resolve();

/** Runs MusicBrainz requests one at a time, spaced to the rate limit. */
function rateLimited<T>(run: () => Promise<T>): Promise<T> {
	const next = queue.then(async () => {
		const wait = lastRequest + MIN_GAP_MS - Date.now();
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
		lastRequest = Date.now();
		return run();
	});
	queue = next.catch(() => undefined);
	return next;
}

/** A 503 means "slow down"; wait this long and try once more. */
const RETRY_AFTER_MS = 2000;

async function getJson<T>(path: string): Promise<T> {
	const separator = path.includes("?") ? "&" : "?";
	const request = () =>
		rateLimited(() =>
			fetch(`${BASE_URL}${path}${separator}fmt=json`, {
				headers: { Accept: "application/json" },
			}),
		);
	let response = await request();
	if (response.status === 503) {
		await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
		response = await request();
	}
	if (!response.ok) {
		throw new Error(`MusicBrainz ${response.status} ${response.statusText}`);
	}
	return (await response.json()) as T;
}

interface ArtistCredit {
	name: string;
	joinphrase?: string;
	artist: { id: string; name: string };
}

interface MbRecording {
	id: string;
	title: string;
	score?: number;
	"artist-credit"?: ArtistCredit[];
	releases?: MbRelease[];
}

interface MbRelease {
	id: string;
	title: string;
	status?: string;
	"release-group"?: {
		"primary-type"?: string | null;
		"secondary-types"?: string[] | null;
	};
}

interface MbRelation {
	type: string;
	artist?: { id: string; name: string };
	work?: { id: string; title: string; relations?: MbRelation[] };
}

interface MbArtist {
	id: string;
	name: string;
	aliases?: { name: string; type?: string | null }[];
}

/** Lucene needs quotes and backslashes escaped inside a phrase. */
const phrase = (value: string) =>
	`"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;

export const creditToString = (credits: ArtistCredit[] | undefined) =>
	(credits ?? [])
		.map((credit) => `${credit.name}${credit.joinphrase ?? ""}`)
		.join("")
		.trim();

/**
 * How much a release looks like the song's home: an official studio album or
 * single beats a karaoke, live or bootleg release of the same recording.
 */
export function releaseRank(release: MbRelease | undefined): number {
	if (!release) return 0;
	const group = release["release-group"];
	let rank = release.status === "Official" ? 4 : 1;
	const type = group?.["primary-type"];
	if (type === "Album" || type === "Single" || type === "EP") rank += 2;
	if (!group?.["secondary-types"]?.length) rank += 1;
	return rank;
}

const bestRelease = (recording: MbRecording) =>
	[...(recording.releases ?? [])].sort(
		(a, b) => releaseRank(b) - releaseRank(a),
	)[0];

const COVER_ART_URL = "https://coverartarchive.org/release";

const toMatch = (recording: MbRecording, release?: MbRelease): SongMatch => ({
	source: "musicbrainz",
	id: recording.id,
	title: recording.title,
	artist: creditToString(recording["artist-credit"]),
	album: release?.title,
	coverUrl: release ? `${COVER_ART_URL}/${release.id}/front-250` : undefined,
});

/** Builds the search query from a title and artist, or one free-text box. */
export function buildRecordingQuery(title: string, artist: string): string {
	const parts: string[] = [];
	if (title.trim()) parts.push(`recording:${phrase(title.trim())}`);
	if (artist.trim()) parts.push(`artist:${phrase(artist.trim())}`);
	return parts.join(" AND ");
}

export async function searchRecordings(query: string): Promise<SongMatch[]> {
	if (!query.trim()) return [];
	const data = await getJson<{ recordings: MbRecording[] }>(
		`/recording?query=${encodeURIComponent(query)}&limit=15`,
	);
	// The same song comes back once per recording (studio, live, karaoke...).
	// List it once, shown through its best release, and keep the rest to fall
	// back on when the shown one has no credits.
	const groups = new Map<string, { recording: MbRecording; rank: number }[]>();
	for (const recording of data.recordings ?? []) {
		const key = `${recording.title.toLowerCase()}\u0000${creditToString(recording["artist-credit"]).toLowerCase()}`;
		const group = groups.get(key) ?? [];
		group.push({ recording, rank: releaseRank(bestRelease(recording)) });
		groups.set(key, group);
	}
	return [...groups.values()].map((group) => {
		const [best, ...rest] = [...group].sort((a, b) => b.rank - a.rank);
		const match = toMatch(best.recording, bestRelease(best.recording));
		if (rest.length)
			match.alternateIds = rest.map(({ recording }) => recording.id);
		return match;
	});
}

/** Writers linked to a recording's work, or null when no work is linked. */
async function writersOfRecording(
	recordingId: string,
): Promise<{ id: string; name: string }[] | null> {
	const data = await getJson<{ relations?: MbRelation[] }>(
		`/recording/${recordingId}?inc=work-rels+work-level-rels+artist-rels`,
	);
	const works = (data.relations ?? []).filter(
		(relation) => relation.type === "performance" && relation.work,
	);
	if (works.length === 0) return null;
	const writers = new Map<string, string>();
	for (const relation of works) {
		for (const workRelation of relation.work?.relations ?? []) {
			if (!WRITER_TYPES.has(workRelation.type) || !workRelation.artist)
				continue;
			writers.set(workRelation.artist.id, workRelation.artist.name);
		}
	}
	return [...writers].map(([id, name]) => ({ id, name }));
}

async function legalNames(ids: string[]): Promise<Map<string, string>> {
	const names = new Map<string, string>();
	if (ids.length === 0) return names;
	const query = ids.map((id) => `arid:${id}`).join(" OR ");
	const data = await getJson<{ artists?: MbArtist[] }>(
		`/artist?query=${encodeURIComponent(query)}&limit=${ids.length}`,
	);
	for (const artist of data.artists ?? []) {
		const legal = artist.aliases?.find((alias) => alias.type === "Legal name");
		if (legal && legal.name !== artist.name) names.set(artist.id, legal.name);
	}
	return names;
}

/**
 * The writers of a picked recording. Recordings of the same song often have
 * no work linked, so it also tries the other recordings found with it.
 */
export async function getRecordingWriters(
	match: SongMatch,
): Promise<SourceWriter[]> {
	const tries = [match.id, ...(match.alternateIds ?? [])].slice(
		0,
		MAX_RECORDINGS_TRIED,
	);
	for (const id of tries) {
		const writers = await writersOfRecording(id);
		if (!writers || writers.length === 0) continue;
		let legal = new Map<string, string>();
		try {
			legal = await legalNames(writers.map((writer) => writer.id));
		} catch (error) {
			// Credited names are still useful without the legal ones.
			console.warn("MusicBrainz legal name lookup failed", error);
		}
		return writers.map((writer) => ({
			credited: writer.name,
			legal: legal.get(writer.id),
		}));
	}
	return [];
}
