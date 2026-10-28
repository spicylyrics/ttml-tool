/**
 * Where Edit mode was last parked in each project, kept across app restarts.
 * Stored as one small map of project key to the line at the view's center.
 */

export const EDIT_SCROLL_STORAGE_KEY = "lyricEditor.editScrollPositions";
/** Enough for a working set of songs; the least recently used drop off. */
export const EDIT_SCROLL_MAX_PROJECTS = 50;

type Positions = Record<string, number>;
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
			if (Number.isInteger(value) && (value as number) >= 0) {
				positions[key] = value as number;
			}
		}
		return positions;
	} catch {
		return {};
	}
}

/** Remember `lineIndex` for `key`, moving it to the most recent slot. */
export function rememberEditScroll(
	key: string,
	lineIndex: number,
	storage: KeyValueStorage | null = defaultStorage(),
) {
	if (!Number.isInteger(lineIndex) || lineIndex < 0) return;
	const positions = readPositions(storage);
	if (positions[key] === lineIndex) return;
	delete positions[key];
	positions[key] = lineIndex;
	const keys = Object.keys(positions);
	const excess = Math.max(0, keys.length - EDIT_SCROLL_MAX_PROJECTS);
	for (const old of keys.slice(0, excess)) delete positions[old];
	try {
		storage?.setItem(EDIT_SCROLL_STORAGE_KEY, JSON.stringify(positions));
	} catch {
		// Storage full or blocked: losing a scroll position is fine.
	}
}

/** The remembered line for `key`, kept inside a document of `lineCount` lines. */
export function recallEditScroll(
	key: string,
	lineCount: number,
	storage: KeyValueStorage | null = defaultStorage(),
): number {
	if (lineCount <= 0) return -1;
	const line = readPositions(storage)[key];
	return line === undefined ? -1 : Math.min(line, lineCount - 1);
}
