import { describe, expect, it } from "vitest";
import {
	arrangeRibbon,
	canMove,
	defaultLayout,
	effectiveOrder,
	isDefaultLayout,
	moveSection,
	normalizeLayout,
	type RibbonEntry,
	setPlacement,
	togglePin,
} from "./layout";

const CATALOG = ["a", "b", "c", "d"] as const;
const base = () => defaultLayout(CATALOG);

/** Children a, b, c, d in order, then an unmanaged child (the Advanced switch). */
const ENTRIES: RibbonEntry[] = [
	{ index: 0, id: "a" },
	{ index: 1, id: "b" },
	{ index: 2, id: "c" },
	{ index: 3, id: "d" },
	{ index: 4, id: null },
];

describe("normalizeLayout", () => {
	it("falls back to the default for missing or broken data", () => {
		expect(normalizeLayout(undefined, CATALOG)).toEqual(base());
		expect(normalizeLayout("nope", CATALOG)).toEqual(base());
		expect(normalizeLayout({ order: 3, pinned: {} }, CATALOG)).toEqual(base());
	});

	it("drops unknown and duplicate ids", () => {
		const layout = normalizeLayout(
			{
				order: ["c", "gone", "a", "c", "b", "d"],
				pinned: ["gone", "a"],
				placement: { gone: "hidden", b: "more", d: "nonsense" },
			},
			CATALOG,
		);
		expect(layout).toEqual({
			order: ["c", "a", "b", "d"],
			pinned: ["a"],
			placement: { b: "more" },
		});
	});

	it("puts sections the saved layout doesn't know next to their default neighbour", () => {
		const layout = normalizeLayout({ order: ["c", "a"] }, CATALOG);
		// b came after a by default, d after c.
		expect(layout.order).toEqual(["c", "d", "a", "b"]);
		const first = normalizeLayout({ order: ["b"] }, ["a", "b"]);
		expect(first.order).toEqual(["a", "b"]);
	});

	it("never keeps a section pinned when it isn't on the ribbon", () => {
		const layout = normalizeLayout(
			{ order: CATALOG, pinned: ["a"], placement: { a: "hidden" } },
			CATALOG,
		);
		expect(layout.pinned).toEqual([]);
	});
});

describe("arrangeRibbon", () => {
	it("keeps today's order with the default layout", () => {
		expect(arrangeRibbon(ENTRIES, base())).toEqual({
			inline: [0, 1, 2, 3, 4],
			overflow: [],
		});
	});

	it("reorders sections and leaves unmanaged children in place", () => {
		const layout = { ...base(), order: ["d", "c", "b", "a"] };
		expect(arrangeRibbon(ENTRIES, layout).inline).toEqual([3, 2, 1, 0, 4]);
	});

	it("puts pinned sections in front of everything", () => {
		const entries: RibbonEntry[] = [
			{ index: 0, id: null },
			{ index: 1, id: "a" },
			{ index: 2, id: "b" },
			{ index: 3, id: "c" },
			{ index: 4, id: "d" },
		];
		const layout = togglePin(base(), "c");
		expect(arrangeRibbon(entries, layout).inline).toEqual([3, 0, 1, 2, 4]);
	});

	it("drops hidden sections and sends More sections to the overflow", () => {
		let layout = setPlacement(base(), "b", "hidden");
		layout = setPlacement(layout, "d", "more");
		layout = setPlacement(layout, "a", "more");
		expect(arrangeRibbon(ENTRIES, layout)).toEqual({
			inline: [2, 4],
			overflow: [0, 3],
		});
	});

	it("only arranges sections that are present", () => {
		const present = ENTRIES.filter((entry) => entry.id !== "b");
		const layout = { ...base(), order: ["c", "b", "a", "d"] };
		expect(arrangeRibbon(present, layout).inline).toEqual([2, 0, 3, 4]);
	});

	it("treats unknown and repeated ids as unmanaged", () => {
		const entries: RibbonEntry[] = [
			{ index: 0, id: "zzz" },
			{ index: 1, id: "b" },
			{ index: 2, id: "b" },
		];
		const layout = setPlacement(base(), "b", "hidden");
		expect(arrangeRibbon(entries, layout).inline).toEqual([0, 2]);
	});
});

describe("moving and pinning", () => {
	it("moves within the visible order and stops at the ends", () => {
		const layout = base();
		expect(canMove(layout, "a", "up")).toBe(false);
		expect(canMove(layout, "d", "down")).toBe(false);
		const moved = moveSection(layout, "c", "up");
		expect(moved.order).toEqual(["a", "c", "b", "d"]);
		expect(moveSection(layout, "a", "up")).toBe(layout);
	});

	it("keeps pinned and unpinned sections in their own groups", () => {
		const layout = togglePin(base(), "c");
		expect(effectiveOrder(layout)).toEqual(["c", "a", "b", "d"]);
		expect(canMove(layout, "c", "down")).toBe(false);
		expect(canMove(layout, "a", "up")).toBe(false);
		const two = togglePin(layout, "d");
		expect(effectiveOrder(moveSection(two, "d", "up"))).toEqual([
			"d",
			"c",
			"a",
			"b",
		]);
	});

	it("unpinning keeps the section where the user sees it", () => {
		const pinned = togglePin(base(), "c");
		const unpinned = togglePin(pinned, "c");
		expect(effectiveOrder(unpinned)).toEqual(["c", "a", "b", "d"]);
		expect(unpinned.pinned).toEqual([]);
	});

	it("pinning brings a section back to the ribbon, hiding unpins it", () => {
		const hidden = setPlacement(base(), "b", "hidden");
		const pinned = togglePin(hidden, "b");
		expect(pinned.placement).toEqual({});
		expect(pinned.pinned).toEqual(["b"]);
		const more = setPlacement(pinned, "b", "more");
		expect(more.pinned).toEqual([]);
		expect(more.placement).toEqual({ b: "more" });
		expect(setPlacement(more, "b", "ribbon").placement).toEqual({});
	});

	it("knows when a layout is the default", () => {
		expect(isDefaultLayout(base(), CATALOG)).toBe(true);
		expect(isDefaultLayout(moveSection(base(), "b", "up"), CATALOG)).toBe(
			false,
		);
		expect(isDefaultLayout(togglePin(base(), "a"), CATALOG)).toBe(false);
		expect(isDefaultLayout(setPlacement(base(), "a", "more"), CATALOG)).toBe(
			false,
		);
	});
});
