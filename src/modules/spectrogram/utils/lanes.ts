/**
 * Lane layout for the spectrogram overlay: main, duet and background lines
 * each get their own horizontal band, like tracks in a video editor.
 *
 * A line's lane depends only on its role flags, never on its timing, so a sync
 * press can't move a line to another lane or change any lane's height.
 */

export type SpectrogramLaneKind = "main" | "duet" | "bg";

/** Top to bottom. */
export const SPECTROGRAM_LANE_ORDER: readonly SpectrogramLaneKind[] = [
	"main",
	"duet",
	"bg",
];

/** i18n key and English fallback for each lane's name. */
export const LANE_LABELS: Record<
	SpectrogramLaneKind,
	{ key: string; fallback: string }
> = {
	main: { key: "spectrogramLanes.lane.main", fallback: "Main" },
	duet: { key: "spectrogramLanes.lane.duet", fallback: "Duet" },
	bg: { key: "spectrogramLanes.lane.bg", fallback: "Background" },
};

export interface LaneLine {
	id: string;
	isBG?: boolean;
	isDuet?: boolean;
	startTime: number;
	endTime: number;
}

export interface LaneLayoutOptions {
	/** Give duet (v2) main lines their own lane instead of sharing the main lane. */
	duetLanes: boolean;
}

export interface LaneLayout {
	/** Lanes that hold at least one line, top to bottom. */
	lanes: readonly SpectrogramLaneKind[];
	laneOf: ReadonlyMap<string, SpectrogramLaneKind>;
}

export interface LaneBand {
	kind: SpectrogramLaneKind;
	/** Percent of the overlay height. */
	top: number;
	height: number;
}

/**
 * Every background line goes to the background lane, whether it follows a
 * main line, follows another background line (consecutive), or has no main
 * line before it at all (standalone). Background lines share one lane on both
 * duet sides, because the exported agent belongs to the enclosing main line.
 */
export function laneKindOf(
	line: Pick<LaneLine, "isBG" | "isDuet">,
	options: LaneLayoutOptions,
): SpectrogramLaneKind {
	if (line.isBG) return "bg";
	if (options.duetLanes && line.isDuet) return "duet";
	return "main";
}

export function assignLanes(
	lines: readonly LaneLine[],
	options: LaneLayoutOptions,
): LaneLayout {
	const laneOf = new Map<string, SpectrogramLaneKind>();
	const used = new Set<SpectrogramLaneKind>();
	for (const line of lines) {
		const kind = laneKindOf(line, options);
		laneOf.set(line.id, kind);
		used.add(kind);
	}
	return {
		lanes: SPECTROGRAM_LANE_ORDER.filter((kind) => used.has(kind)),
		laneOf,
	};
}

/**
 * Returns the previous layout object while no line was added, removed,
 * reordered or given a new role, so a sync press (which only changes times)
 * keeps the same layout identity and nothing downstream re-renders for it.
 */
export function createLaneLayoutCache() {
	let lastLines: readonly LaneLine[] | null = null;
	let lastDuetLanes = false;
	let lastLayout: LaneLayout | null = null;

	const sameRoles = (
		lines: readonly LaneLine[],
		options: LaneLayoutOptions,
	) => {
		if (!lastLines || !lastLayout) return false;
		if (lastDuetLanes !== options.duetLanes) return false;
		if (lastLines.length !== lines.length) return false;
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index];
			const previous = lastLines[index];
			if (line === previous) continue;
			if (
				line.id !== previous.id ||
				Boolean(line.isBG) !== Boolean(previous.isBG) ||
				Boolean(line.isDuet) !== Boolean(previous.isDuet)
			) {
				return false;
			}
		}
		return true;
	};

	return (lines: readonly LaneLine[], options: LaneLayoutOptions) => {
		if (!sameRoles(lines, options) || !lastLayout) {
			lastLayout = assignLanes(lines, options);
		}
		lastLines = lines;
		lastDuetLanes = options.duetLanes;
		return lastLayout;
	};
}

/** Splits the overlay height evenly between the lanes that are not hidden. */
export function getLaneBands(
	layout: LaneLayout,
	hidden: ReadonlySet<SpectrogramLaneKind>,
): LaneBand[] {
	const visible = layout.lanes.filter((kind) => !hidden.has(kind));
	const height = visible.length > 0 ? 100 / visible.length : 0;
	return visible.map((kind, index) => ({ kind, top: index * height, height }));
}

export interface LaneBoundaries {
	starts: Map<number, number>;
	ends: Map<number, number>;
	byId: Map<string, LaneLine>;
}

/** Per-lane start and end counts, so lines only square corners with lines in their own lane. */
export function buildLaneBoundaries(
	lines: readonly LaneLine[],
	laneOf: ReadonlyMap<string, SpectrogramLaneKind>,
): Map<SpectrogramLaneKind, LaneBoundaries> {
	const result = new Map<SpectrogramLaneKind, LaneBoundaries>();
	for (const line of lines) {
		const kind = laneOf.get(line.id) ?? "main";
		let lane = result.get(kind);
		if (!lane) {
			lane = { starts: new Map(), ends: new Map(), byId: new Map() };
			result.set(kind, lane);
		}
		lane.starts.set(line.startTime, (lane.starts.get(line.startTime) ?? 0) + 1);
		lane.ends.set(line.endTime, (lane.ends.get(line.endTime) ?? 0) + 1);
		lane.byId.set(line.id, line);
	}
	return result;
}

/** Whether another line in the same lane ends where this one starts. */
export function isTouchingLaneStart(
	lane: LaneBoundaries | undefined,
	line: LaneLine,
	offset = 0,
): boolean {
	if (!lane) return false;
	const time = Math.max(0, line.startTime + offset);
	return (
		(lane.ends.get(time) ?? 0) >
		Number(lane.byId.get(line.id)?.endTime === time)
	);
}

/** Whether another line in the same lane starts where this one ends. */
export function isTouchingLaneEnd(
	lane: LaneBoundaries | undefined,
	line: LaneLine,
	offset = 0,
): boolean {
	if (!lane) return false;
	const time = Math.max(0, line.endTime + offset);
	return (
		(lane.starts.get(time) ?? 0) >
		Number(lane.byId.get(line.id)?.startTime === time)
	);
}
