/** Tabs the reference sidebar can show. "problems" stays hidden until the linter exists. */
export type ReferenceSidebarTab = "preview" | "genius" | "problems";

export const REFERENCE_SIDEBAR_TABS: readonly ReferenceSidebarTab[] = [
	"preview",
	"genius",
	"problems",
];

/** The Genius song picked for a project, so its lyrics come back when the project reopens. */
export interface ReferenceGeniusSong {
	id: number;
	name: string;
	artist: string;
}

export interface ReferenceSidebarProjectState {
	open: boolean;
	tab: ReferenceSidebarTab;
	width?: number;
	genius?: ReferenceGeniusSong;
	updatedAt: number;
}

export type ReferenceSidebarMemory = Record<
	string,
	ReferenceSidebarProjectState
>;

export type ReferenceSidebarPatch = Partial<
	Omit<ReferenceSidebarProjectState, "updatedAt" | "genius">
> & { genius?: ReferenceGeniusSong | null };

/** How many projects keep their own sidebar state before the oldest is dropped. */
export const REFERENCE_SIDEBAR_MEMORY_LIMIT = 30;
export const REFERENCE_SIDEBAR_MIN_WIDTH = 300;
export const REFERENCE_SIDEBAR_MAX_WIDTH = 600;

const DEFAULT_STATE: ReferenceSidebarProjectState = {
	open: false,
	tab: "preview",
	updatedAt: 0,
};

const isTab = (value: unknown): value is ReferenceSidebarTab =>
	typeof value === "string" &&
	(REFERENCE_SIDEBAR_TABS as readonly string[]).includes(value);

const clampWidth = (value: number) =>
	Math.min(
		REFERENCE_SIDEBAR_MAX_WIDTH,
		Math.max(REFERENCE_SIDEBAR_MIN_WIDTH, Math.round(value)),
	);

const normalizeGenius = (value: unknown): ReferenceGeniusSong | undefined => {
	if (!value || typeof value !== "object") return undefined;
	const { id, name, artist } = value as Record<string, unknown>;
	if (typeof id !== "number" || !Number.isFinite(id)) return undefined;
	return {
		id,
		name: typeof name === "string" ? name : "",
		artist: typeof artist === "string" ? artist : "",
	};
};

const normalizeEntry = (
	value: unknown,
): ReferenceSidebarProjectState | null => {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const raw = value as Record<string, unknown>;
	const entry: ReferenceSidebarProjectState = {
		open: raw.open === true,
		tab: isTab(raw.tab) ? raw.tab : DEFAULT_STATE.tab,
		updatedAt:
			typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
				? raw.updatedAt
				: 0,
	};
	if (typeof raw.width === "number" && Number.isFinite(raw.width))
		entry.width = clampWidth(raw.width);
	const genius = normalizeGenius(raw.genius);
	if (genius) entry.genius = genius;
	return entry;
};

/** Drops anything malformed, so a hand-edited or old value can't break the layout. */
export function normalizeMemory(value: unknown): ReferenceSidebarMemory {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	const memory: ReferenceSidebarMemory = {};
	for (const [key, raw] of Object.entries(value)) {
		const entry = normalizeEntry(raw);
		if (entry) memory[key] = entry;
	}
	return memory;
}

const mostRecent = (
	memory: ReferenceSidebarMemory,
): ReferenceSidebarProjectState | undefined => {
	let latest: ReferenceSidebarProjectState | undefined;
	for (const entry of Object.values(memory)) {
		if (!latest || entry.updatedAt > latest.updatedAt) latest = entry;
	}
	return latest;
};

/**
 * The sidebar state for one project. A project seen for the first time starts
 * like the last one used (open, tab and width), without its Genius song.
 */
export function readProjectState(
	memory: ReferenceSidebarMemory,
	key: string,
): ReferenceSidebarProjectState {
	const own = memory[key];
	if (own) return own;
	const latest = mostRecent(memory);
	if (!latest) return DEFAULT_STATE;
	const { genius: _genius, ...rest } = latest;
	return { ...rest, updatedAt: 0 };
}

/** Writes one project's state and keeps only the most recently used projects. */
export function writeProjectState(
	memory: ReferenceSidebarMemory,
	key: string,
	patch: ReferenceSidebarPatch,
	now: number,
	limit = REFERENCE_SIDEBAR_MEMORY_LIMIT,
): ReferenceSidebarMemory {
	const current = readProjectState(memory, key);
	const { genius, width, ...rest } = patch;
	const next: ReferenceSidebarProjectState = {
		...current,
		...rest,
		updatedAt: now,
	};
	if (width !== undefined) next.width = clampWidth(width);
	if (genius === null) delete next.genius;
	else if (genius) next.genius = genius;

	const entries = Object.entries({ ...memory, [key]: next })
		.sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
		.slice(0, Math.max(1, limit));
	return Object.fromEntries(entries);
}

/** Which tab to show, falling back to Preview when the saved tab isn't available. */
export function resolveVisibleTab(
	tab: ReferenceSidebarTab,
	available: readonly ReferenceSidebarTab[],
): ReferenceSidebarTab {
	return available.includes(tab) ? tab : "preview";
}
