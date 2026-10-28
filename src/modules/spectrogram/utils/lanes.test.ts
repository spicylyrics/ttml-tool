import { describe, expect, it } from "vitest";
import {
	assignLanes,
	buildLaneBoundaries,
	createLaneLayoutCache,
	getLaneBands,
	isTouchingLaneEnd,
	isTouchingLaneStart,
	type LaneLine,
	laneKindOf,
} from "./lanes";

const line = (
	id: string,
	startTime: number,
	endTime: number,
	flags: { isBG?: boolean; isDuet?: boolean } = {},
): LaneLine => ({ id, startTime, endTime, ...flags });

const off = { duetLanes: false };
const on = { duetLanes: true };

describe("laneKindOf", () => {
	it("sends background lines to the background lane on either duet side", () => {
		expect(laneKindOf({ isBG: true }, off)).toBe("bg");
		expect(laneKindOf({ isBG: true, isDuet: true }, on)).toBe("bg");
	});

	it("keeps duet lines in the main lane unless duet lanes are on", () => {
		expect(laneKindOf({ isDuet: true }, off)).toBe("main");
		expect(laneKindOf({ isDuet: true }, on)).toBe("duet");
		expect(laneKindOf({}, on)).toBe("main");
	});
});

describe("assignLanes", () => {
	it("returns no lanes for an empty song", () => {
		const layout = assignLanes([], off);
		expect(layout.lanes).toEqual([]);
		expect(layout.laneOf.size).toBe(0);
	});

	it("uses a single lane when there are no background lines", () => {
		const layout = assignLanes([line("a", 0, 1), line("b", 1, 2)], off);
		expect(layout.lanes).toEqual(["main"]);
	});

	it("puts a main line and its background line in separate lanes", () => {
		const layout = assignLanes(
			[line("a", 0, 1000), line("b", 200, 800, { isBG: true })],
			off,
		);
		expect(layout.lanes).toEqual(["main", "bg"]);
		expect(layout.laneOf.get("a")).toBe("main");
		expect(layout.laneOf.get("b")).toBe("bg");
	});

	it("keeps consecutive background lines together in the background lane", () => {
		const layout = assignLanes(
			[
				line("a", 0, 1000),
				line("b", 100, 400, { isBG: true }),
				line("c", 500, 900, { isBG: true }),
			],
			off,
		);
		expect(layout.laneOf.get("b")).toBe("bg");
		expect(layout.laneOf.get("c")).toBe("bg");
	});

	it("places a standalone background line with no main line before it", () => {
		const layout = assignLanes(
			[line("a", 0, 500, { isBG: true }), line("b", 600, 1000)],
			off,
		);
		expect(layout.lanes).toEqual(["main", "bg"]);
		expect(layout.laneOf.get("a")).toBe("bg");
	});

	it("orders lanes main, duet, background and only lists used lanes", () => {
		const lines = [
			line("bg", 0, 1, { isBG: true }),
			line("duet", 0, 1, { isDuet: true }),
			line("main", 0, 1),
		];
		expect(assignLanes(lines, on).lanes).toEqual(["main", "duet", "bg"]);
		expect(assignLanes(lines, off).lanes).toEqual(["main", "bg"]);
		expect(assignLanes([line("d", 0, 1, { isDuet: true })], on).lanes).toEqual([
			"duet",
		]);
	});
});

describe("createLaneLayoutCache", () => {
	it("keeps the layout identity while only times change", () => {
		const cache = createLaneLayoutCache();
		const first = cache(
			[line("a", 0, 1000), line("b", 0, 1000, { isBG: true })],
			off,
		);
		const synced = cache(
			[line("a", 10, 990), line("b", 50, 900, { isBG: true })],
			off,
		);
		expect(synced).toBe(first);
	});

	it("rebuilds when a role, the line order, the count or duet lanes change", () => {
		const cache = createLaneLayoutCache();
		const base = [line("a", 0, 1), line("b", 1, 2, { isDuet: true })];
		const first = cache(base, off);

		const roleChanged = cache(
			[line("a", 0, 1), line("b", 1, 2, { isBG: true })],
			off,
		);
		expect(roleChanged).not.toBe(first);
		expect(roleChanged.laneOf.get("b")).toBe("bg");

		const reordered = cache(
			[line("b", 1, 2, { isBG: true }), line("a", 0, 1)],
			off,
		);
		expect(reordered).not.toBe(roleChanged);

		const added = cache([...base, line("c", 2, 3)], off);
		expect(added.laneOf.get("c")).toBe("main");

		const duet = cache([...base, line("c", 2, 3)], on);
		expect(duet).not.toBe(added);
		expect(duet.laneOf.get("b")).toBe("duet");
	});
});

describe("getLaneBands", () => {
	const layout = assignLanes(
		[
			line("a", 0, 1),
			line("b", 0, 1, { isDuet: true }),
			line("c", 0, 1, { isBG: true }),
		],
		on,
	);

	it("splits the height evenly between lanes", () => {
		expect(getLaneBands(layout, new Set())).toEqual([
			{ kind: "main", top: 0, height: 100 / 3 },
			{ kind: "duet", top: 100 / 3, height: 100 / 3 },
			{ kind: "bg", top: 200 / 3, height: 100 / 3 },
		]);
	});

	it("gives hidden lanes' space to the remaining lanes", () => {
		expect(getLaneBands(layout, new Set(["duet"]))).toEqual([
			{ kind: "main", top: 0, height: 50 },
			{ kind: "bg", top: 50, height: 50 },
		]);
		expect(getLaneBands(layout, new Set(["main", "duet", "bg"]))).toEqual([]);
	});
});

describe("lane-aware touching", () => {
	const lines = [
		line("a", 0, 1000),
		line("bg", 1000, 2000, { isBG: true }),
		line("b", 2000, 3000),
	];
	const { laneOf } = assignLanes(lines, off);
	const boundaries = buildLaneBoundaries(lines, laneOf);

	it("ignores lines in other lanes", () => {
		expect(isTouchingLaneEnd(boundaries.get("main"), lines[0])).toBe(false);
		expect(isTouchingLaneStart(boundaries.get("bg"), lines[1])).toBe(false);
	});

	it("matches lines in the same lane", () => {
		const shifted = line("a", 0, 2000);
		expect(isTouchingLaneEnd(boundaries.get("main"), shifted)).toBe(true);
		expect(isTouchingLaneStart(boundaries.get("main"), lines[2])).toBe(false);
		expect(isTouchingLaneStart(boundaries.get("main"), lines[2], -1000)).toBe(
			true,
		);
	});

	it("does not count a zero-length line as touching itself", () => {
		const point = [line("p", 500, 500)];
		const own = buildLaneBoundaries(point, assignLanes(point, off).laneOf);
		expect(isTouchingLaneStart(own.get("main"), point[0])).toBe(false);
		expect(isTouchingLaneEnd(own.get("main"), point[0])).toBe(false);
	});
});
