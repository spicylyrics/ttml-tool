/** Where a section goes: on the ribbon, in the More menu, or nowhere. */
export type SectionPlacement = "ribbon" | "more" | "hidden";

export const SECTION_PLACEMENTS: readonly SectionPlacement[] = [
	"ribbon",
	"more",
	"hidden",
];

/**
 * One ribbon's saved layout. `order` lists every catalog section; `pinned`
 * sections come first on the ribbon. A pinned section is always on the ribbon:
 * moving it to More or hiding it unpins it.
 */
export interface RibbonLayout {
	order: string[];
	pinned: string[];
	placement: Record<string, SectionPlacement>;
}

export const defaultLayout = (catalog: readonly string[]): RibbonLayout => ({
	order: [...catalog],
	pinned: [],
	placement: {},
});

const asStringArray = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];

/**
 * Turns whatever is stored (an old version, a hand-edited backup) into a valid
 * layout for the catalog. Unknown ids are dropped; sections the saved layout
 * doesn't know yet (added in a later update) go back next to the section that
 * comes before them by default.
 */
export function normalizeLayout(
	raw: unknown,
	catalog: readonly string[],
): RibbonLayout {
	if (!raw || typeof raw !== "object") return defaultLayout(catalog);
	const source = raw as Partial<Record<keyof RibbonLayout, unknown>>;
	const known = new Set(catalog);

	const order: string[] = [];
	for (const id of asStringArray(source.order)) {
		if (known.has(id) && !order.includes(id)) order.push(id);
	}
	catalog.forEach((id, index) => {
		if (order.includes(id)) return;
		let insertAt = 0;
		for (let before = index - 1; before >= 0; before--) {
			const at = order.indexOf(catalog[before]);
			if (at !== -1) {
				insertAt = at + 1;
				break;
			}
		}
		order.splice(insertAt, 0, id);
	});

	const placement: Record<string, SectionPlacement> = {};
	const rawPlacement =
		source.placement && typeof source.placement === "object"
			? (source.placement as Record<string, unknown>)
			: {};
	for (const [id, value] of Object.entries(rawPlacement)) {
		if (
			known.has(id) &&
			value !== "ribbon" &&
			SECTION_PLACEMENTS.includes(value as SectionPlacement)
		) {
			placement[id] = value as SectionPlacement;
		}
	}

	const pinned = order.filter(
		(id) => asStringArray(source.pinned).includes(id) && !placement[id],
	);

	return { order, pinned, placement };
}

export const placementOf = (
	layout: RibbonLayout,
	id: string,
): SectionPlacement => layout.placement[id] ?? "ribbon";

export const isPinned = (layout: RibbonLayout, id: string): boolean =>
	layout.pinned.includes(id);

/** The order sections show in: pinned ones first, each group in saved order. */
export function effectiveOrder(layout: RibbonLayout): string[] {
	return [
		...layout.order.filter((id) => isPinned(layout, id)),
		...layout.order.filter((id) => !isPinned(layout, id)),
	];
}

export function isDefaultLayout(
	layout: RibbonLayout,
	catalog: readonly string[],
): boolean {
	return (
		layout.pinned.length === 0 &&
		Object.keys(layout.placement).length === 0 &&
		layout.order.length === catalog.length &&
		layout.order.every((id, index) => id === catalog[index])
	);
}

export type MoveDirection = "up" | "down";

/** Whether a section can move: only within its group (pinned or not). */
export function canMove(
	layout: RibbonLayout,
	id: string,
	direction: MoveDirection,
): boolean {
	const order = effectiveOrder(layout);
	const index = order.indexOf(id);
	const target = direction === "up" ? index - 1 : index + 1;
	if (index === -1 || target < 0 || target >= order.length) return false;
	return isPinned(layout, order[target]) === isPinned(layout, id);
}

export function moveSection(
	layout: RibbonLayout,
	id: string,
	direction: MoveDirection,
): RibbonLayout {
	if (!canMove(layout, id, direction)) return layout;
	const order = effectiveOrder(layout);
	const index = order.indexOf(id);
	const target = direction === "up" ? index - 1 : index + 1;
	[order[index], order[target]] = [order[target], order[index]];
	return { ...layout, order };
}

export function setPlacement(
	layout: RibbonLayout,
	id: string,
	placement: SectionPlacement,
): RibbonLayout {
	const next = { ...layout.placement };
	if (placement === "ribbon") delete next[id];
	else next[id] = placement;
	return {
		// Keep the order the user sees, so unpinning doesn't make it jump.
		order: effectiveOrder(layout),
		pinned:
			placement === "ribbon"
				? layout.pinned
				: layout.pinned.filter((item) => item !== id),
		placement: next,
	};
}

/** Pinning also puts a section back on the ribbon. */
export function togglePin(layout: RibbonLayout, id: string): RibbonLayout {
	const order = effectiveOrder(layout);
	if (isPinned(layout, id)) {
		return {
			...layout,
			order,
			pinned: layout.pinned.filter((item) => item !== id),
		};
	}
	const placement = { ...layout.placement };
	delete placement[id];
	return { order, pinned: [...layout.pinned, id], placement };
}

/** A child of the ribbon: its position among the children, and its section id. */
export interface RibbonEntry {
	index: number;
	/** `null` for anything that isn't a catalog section; it keeps its place. */
	id: string | null;
}

export interface RibbonArrangement {
	/** Child indexes in render order on the ribbon. */
	inline: number[];
	/** Child indexes for the More menu, in order. */
	overflow: number[];
}

/**
 * Decides where each child of a ribbon renders. Pinned sections go first.
 * The other ribbon sections fill the places catalog sections had, in saved
 * order, so anything that isn't a catalog section (the Advanced switch, a
 * section added later) stays where it was. With the default layout the
 * result is the children in their original order.
 */
export function arrangeRibbon(
	entries: readonly RibbonEntry[],
	layout: RibbonLayout,
): RibbonArrangement {
	const rank = new Map(effectiveOrder(layout).map((id, index) => [id, index]));
	const seen = new Set<string>();
	const managed: RibbonEntry[] = [];
	const resolved = entries.map((entry) => {
		if (entry.id === null || !rank.has(entry.id) || seen.has(entry.id)) {
			return { index: entry.index, id: null };
		}
		seen.add(entry.id);
		managed.push(entry);
		return entry;
	});

	const byRank = (a: RibbonEntry, b: RibbonEntry) =>
		(rank.get(a.id as string) ?? 0) - (rank.get(b.id as string) ?? 0);
	const onRibbon = managed
		.filter((entry) => placementOf(layout, entry.id as string) === "ribbon")
		.sort(byRank);
	const pinned = onRibbon.filter((entry) =>
		isPinned(layout, entry.id as string),
	);
	const rest = onRibbon.filter(
		(entry) => !isPinned(layout, entry.id as string),
	);
	const overflow = managed
		.filter((entry) => placementOf(layout, entry.id as string) === "more")
		.sort(byRank)
		.map((entry) => entry.index);

	const inline = pinned.map((entry) => entry.index);
	let next = 0;
	for (const entry of resolved) {
		if (entry.id === null) {
			inline.push(entry.index);
		} else if (next < rest.length) {
			inline.push(rest[next].index);
			next++;
		}
	}
	return { inline, overflow };
}
