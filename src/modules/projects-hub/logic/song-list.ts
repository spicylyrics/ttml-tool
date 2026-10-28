import {
	addChecklistEntry,
	normalizeChecklistEntries,
	type TTMLChecklistEntry,
} from "$/modules/ttml-checklist/logic";
import type { TTMLMetadata } from "$/types/ttml";

/** Case, spacing and quote style don't make two songs different. */
export const normalizeSongKey = (value: string) =>
	value
		.normalize("NFKC")
		.toLowerCase()
		.replace(/[‘’ʼ]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/\s+/g, " ")
		.trim();

const sameSong = (
	entry: Pick<TTMLChecklistEntry, "song" | "artist">,
	song: string,
	artist: string,
) =>
	normalizeSongKey(entry.song) === normalizeSongKey(song) &&
	(!entry.artist.trim() ||
		!artist.trim() ||
		normalizeSongKey(entry.artist) === normalizeSongKey(artist));

/** The open (not done) entry for this song, if the list already has one. */
export function findOpenEntry(
	entries: readonly TTMLChecklistEntry[],
	song: string,
	artist: string,
): TTMLChecklistEntry | undefined {
	return entries.find(
		(entry) => !entry.completed && sameSong(entry, song, artist),
	);
}

/** Adds a song found on Genius. A song that is already open on the list isn't added twice. */
export function addGeniusSong(
	entries: TTMLChecklistEntry[],
	track: { song: string; artist: string; geniusId?: number },
	createdAt?: number,
	id?: string,
): { entries: TTMLChecklistEntry[]; added: boolean } {
	if (findOpenEntry(entries, track.song, track.artist))
		return { entries, added: false };
	const next = addChecklistEntry(
		entries,
		{ song: track.song, artist: track.artist, notes: "" },
		createdAt,
		id,
	);
	if (next === entries) return { entries, added: false };
	if (track.geniusId === undefined) return { entries: next, added: true };
	const newest = next.find(
		(entry) => !entries.some((old) => old.id === entry.id),
	);
	return {
		entries: next.map((entry) =>
			entry === newest ? { ...entry, geniusId: track.geniusId } : entry,
		),
		added: true,
	};
}

/** Song title and artist as editor metadata for a project started from an entry. */
export function songListMetadata(
	entry: Pick<TTMLChecklistEntry, "song" | "artist">,
): TTMLMetadata[] {
	const metadata: TTMLMetadata[] = [{ key: "musicName", value: [entry.song] }];
	if (entry.artist.trim())
		metadata.push({ key: "artists", value: [entry.artist.trim()] });
	return metadata;
}

/** Records which document an entry was started as, so its export can mark it done. */
export function linkEntryToProject(
	entries: TTMLChecklistEntry[],
	id: string,
	projectId: string,
	startedAt = Date.now(),
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) => {
			if (entry.id !== id) return entry;
			const { projectDir: _dropped, ...rest } = entry;
			return { ...rest, projectId, startedAt };
		}),
	);
}

/** Remembers the folder project a started entry was saved to. */
export function linkEntryToProjectDir(
	entries: TTMLChecklistEntry[],
	projectId: string,
	projectDir: string,
): TTMLChecklistEntry[] {
	let changed = false;
	const next = entries.map((entry) => {
		if (entry.projectId !== projectId || entry.projectDir === projectDir)
			return entry;
		changed = true;
		return { ...entry, projectDir };
	});
	return changed ? next : entries;
}

export interface ExportedDocument {
	projectId: string;
	projectDir?: string | null;
	metadata: readonly TTMLMetadata[];
}

const firstValue = (metadata: readonly TTMLMetadata[], key: string) =>
	metadata
		.find((item) => item.key === key)
		?.value.find((value) => value.trim()) ?? "";

/**
 * The started entry an export belongs to: the same autosave project, the same
 * folder project, or (after a reopen gave the document a new id) a started
 * entry whose title and artist match the exported metadata.
 */
export function findExportedEntry(
	entries: readonly TTMLChecklistEntry[],
	doc: ExportedDocument,
): TTMLChecklistEntry | undefined {
	const open = entries.filter((entry) => !entry.completed && entry.startedAt);
	const byId = open.find((entry) => entry.projectId === doc.projectId);
	if (byId) return byId;
	if (doc.projectDir) {
		const byDir = open.find((entry) => entry.projectDir === doc.projectDir);
		if (byDir) return byDir;
	}
	const title = firstValue(doc.metadata, "musicName");
	if (!title) return undefined;
	return open.find((entry) =>
		sameSong(entry, title, firstValue(doc.metadata, "artists")),
	);
}

/** Marks the entry an export belongs to as done. Returns the same array when nothing matches. */
export function markExportedEntryDone(
	entries: TTMLChecklistEntry[],
	doc: ExportedDocument,
): { entries: TTMLChecklistEntry[]; entry?: TTMLChecklistEntry } {
	const entry = findExportedEntry(entries, doc);
	if (!entry) return { entries };
	return {
		entries: normalizeChecklistEntries(
			entries.map((item) =>
				item.id === entry.id ? { ...item, completed: true } : item,
			),
		),
		entry,
	};
}
