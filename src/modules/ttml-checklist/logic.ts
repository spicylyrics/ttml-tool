import { uid } from "uid";

export interface TTMLChecklistEntry {
	id: string;
	song: string;
	artist: string;
	notes: string;
	completed: boolean;
	createdAt: number;
	/** Autosave project id of the document started from this entry. */
	projectId?: string;
	/** Folder project the started document was saved as, if any. */
	projectDir?: string;
	/** When "Start project" was used on this entry. */
	startedAt?: number;
	/** Genius song id, when the entry was added from a Genius search. */
	geniusId?: number;
}

export type TTMLChecklistEntryInput = Pick<
	TTMLChecklistEntry,
	"song" | "artist" | "notes"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeChecklistEntries(
	value: unknown,
): TTMLChecklistEntry[] {
	if (!Array.isArray(value)) return [];

	return value
		.map((item, index): TTMLChecklistEntry | null => {
			if (!isRecord(item) || typeof item.song !== "string") return null;
			const song = item.song.trim();
			if (!song) return null;
			// Optional link fields only appear when set, so old entries keep their shape.
			const links: Partial<TTMLChecklistEntry> = {};
			if (typeof item.projectId === "string" && item.projectId)
				links.projectId = item.projectId;
			if (typeof item.projectDir === "string" && item.projectDir)
				links.projectDir = item.projectDir;
			if (typeof item.startedAt === "number" && Number.isFinite(item.startedAt))
				links.startedAt = item.startedAt;
			if (typeof item.geniusId === "number" && Number.isFinite(item.geniusId))
				links.geniusId = item.geniusId;
			return {
				...links,
				id:
					typeof item.id === "string" && item.id ? item.id : `legacy-${index}`,
				song,
				artist: typeof item.artist === "string" ? item.artist.trim() : "",
				notes: typeof item.notes === "string" ? item.notes.trim() : "",
				completed: item.completed === true,
				createdAt:
					typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
						? item.createdAt
						: 0,
			};
		})
		.filter((item): item is TTMLChecklistEntry => item !== null)
		.sort((a, b) => {
			if (a.completed !== b.completed)
				return Number(a.completed) - Number(b.completed);
			return b.createdAt - a.createdAt;
		});
}

export function createChecklistEntry(
	input: TTMLChecklistEntryInput,
	createdAt = Date.now(),
	id = uid(),
): TTMLChecklistEntry {
	return {
		id,
		song: input.song.trim(),
		artist: input.artist.trim(),
		notes: input.notes.trim(),
		completed: false,
		createdAt,
	};
}

export function addChecklistEntry(
	entries: TTMLChecklistEntry[],
	input: TTMLChecklistEntryInput,
	createdAt?: number,
	id?: string,
): TTMLChecklistEntry[] {
	const entry = createChecklistEntry(input, createdAt, id);
	if (!entry.song) return entries;
	return normalizeChecklistEntries([...entries, entry]);
}

export function updateChecklistEntry(
	entries: TTMLChecklistEntry[],
	id: string,
	input: TTMLChecklistEntryInput,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) =>
			entry.id === id
				? {
						...entry,
						song: input.song,
						artist: input.artist,
						notes: input.notes,
					}
				: entry,
		),
	);
}

export function setChecklistEntryCompleted(
	entries: TTMLChecklistEntry[],
	id: string,
	completed: boolean,
): TTMLChecklistEntry[] {
	return normalizeChecklistEntries(
		entries.map((entry) => (entry.id === id ? { ...entry, completed } : entry)),
	);
}

export function deleteChecklistEntry(
	entries: TTMLChecklistEntry[],
	id: string,
): TTMLChecklistEntry[] {
	return entries.filter((entry) => entry.id !== id);
}
