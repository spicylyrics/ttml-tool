/**
 * Where Edit mode was last parked in each project, kept across app restarts.
 * Stored as one small map of project key to the line at the view's center.
 */

export const EDIT_SCROLL_STORAGE_KEY = "lyricEditor.editScrollPositions";
/** Enough for a working set of songs; the least recently used drop off. */
export const EDIT_SCROLL_MAX_PROJECTS = 50;

/**
 * The line's id finds it again after lines are added or removed above it.
 * Ids are made fresh whenever a TTML file is read, so a reopened folder
 * project falls back to the index.
 */
export interface EditScrollAnchor {
	id?: string;
	index: number;
}

type Positions = Record<string, EditScrollAnchor>;
type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const defaultStorage = (): KeyValueStorage | null => {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
};

/**
 * A folder project is the same project every time its folder opens, while its
 * project id is regenerated. Other documents keep the id the autosave history
 * matched them to, so that's the best handle they have.
 */
export function editScrollProjectKey(
	projectDir: string | null,
	projectId: string,
): string {
	return projectDir ? `dir:${projectDir}` : `id:${projectId}`;
}

function readPositions(storage: KeyValueStorage | null): Positions {
	try {
		const raw = storage?.getItem(EDIT_SCROLL_STORAGE_KEY);
		const parsed: unknown = raw ? JSON.parse(raw) : null;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const positions: Positions = {};
		for (const [key, value] of Object.entries(parsed)) {
			const anchor = toAnchor(value);
			if (anchor) positions[key] = anchor;
		}
		return positions;
	} catch {
		return {};
	}
}

const isIndex = (value: unknown): value is number =>
	Number.isInteger(value) && (value as number) >= 0;

/** Accepts the current shape and the bare index earlier builds stored. */
function toAnchor(value: unknown): EditScrollAnchor | null {
	if (isIndex(value)) return { index: value };
	if (!value || typeof value !== "object") return null;
	const { id, index } = value as Record<string, unknown>;
	if (!isIndex(index)) return null;
	return typeof id === "string" && id ? { id, index } : { index };
}

/** Remember `anchor` for `key`, moving it to the most recent slot. */
export function rememberEditScroll(
	key: string,
	anchor: EditScrollAnchor,
	storage: KeyValueStorage | null = defaultStorage(),
) {
	const next = toAnchor(anchor);
	if (!next) return;
	const positions = readPositions(storage);
	const current = positions[key];
	if (current && current.id === next.id && current.index === next.index) {
		return;
	}
	delete positions[key];
	positions[key] = next;
	const keys = Object.keys(positions);
	const excess = Math.max(0, keys.length - EDIT_SCROLL_MAX_PROJECTS);
	for (const old of keys.slice(0, excess)) delete positions[old];
	try {
		storage?.setItem(EDIT_SCROLL_STORAGE_KEY, JSON.stringify(positions));
	} catch {
		// Storage full or blocked: losing a scroll position is fine.
	}
}

/**
 * The index of the remembered line for `key` in a document whose lines have
 * `lineIds`: wherever that line is now, or else the saved index, kept inside
 * the document. -1 when nothing is remembered.
 */
export function recallEditScroll(
	key: string,
	lineIds: readonly string[],
	storage: KeyValueStorage | null = defaultStorage(),
): number {
	if (lineIds.length === 0) return -1;
	const anchor = readPositions(storage)[key];
	if (!anchor) return -1;
	const byId = anchor.id ? lineIds.indexOf(anchor.id) : -1;
	return byId !== -1 ? byId : Math.min(anchor.index, lineIds.length - 1);
}
