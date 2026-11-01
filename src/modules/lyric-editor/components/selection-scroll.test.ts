import { describe, expect, it } from "vitest";
import { ToolMode } from "$/states/main.ts";
import {
	AUTO_SCROLL_PAUSE_MS,
	calculateScrollDuration,
	createScrollGlide,
	findClosestLineToViewportCenter,
	resolveAnchorLineIndex,
	scrollGlideOffset,
	scrollGlideVelocity,
	shouldAutoCenterSelection,
} from "./selection-scroll";

describe("AUTO_SCROLL_PAUSE_MS", () => {
	it("pauses auto-scroll for 3.5 seconds on user interaction", () => {
		expect(AUTO_SCROLL_PAUSE_MS).toBe(3500);
	});
});

describe("shouldAutoCenterSelection", () => {
	it("keeps direct Edit-mode selections stationary", () => {
		expect(shouldAutoCenterSelection(ToolMode.Edit)).toBe(false);
	});

	it("preserves automatic centering in Sync mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Sync)).toBe(true);
	});

	it("does not auto-center selections in Preview mode", () => {
		expect(shouldAutoCenterSelection(ToolMode.Preview)).toBe(false);
	});
});

describe("findClosestLineToViewportCenter", () => {
	it("uses the rendered line nearest the viewport center as the mode anchor", () => {
		expect(
			findClosestLineToViewportCenter(500, [
				{ index: 7, top: 100, height: 100 },
				{ index: 8, top: 430, height: 100 },
				{ index: 9, top: 650, height: 100 },
			]),
		).toBe(8);
	});

	it("returns no anchor when no rendered lines are available", () => {
		expect(findClosestLineToViewportCenter(500, [])).toBe(-1);
	});
});

describe("calculateScrollDuration", () => {
	it("provides snappy duration for small distances", () => {
		expect(calculateScrollDuration(50)).toBe(297);
		expect(calculateScrollDuration(0)).toBe(280);
	});

	it("scales duration proportionally for medium distances", () => {
		expect(calculateScrollDuration(500)).toBe(419);
		expect(calculateScrollDuration(1000)).toBe(493);
	});

	it("caps duration at 750ms for large and extreme distances", () => {
		expect(calculateScrollDuration(3600)).toBe(720);
		expect(calculateScrollDuration(10000)).toBe(750);
		expect(calculateScrollDuration(-5000)).toBe(750);
	});

	it("honors explicit duration override when supplied", () => {
		expect(calculateScrollDuration(3600, 450)).toBe(450);
	});
});

describe("scroll glide", () => {
	it("eases in and out from rest, symmetric around the midpoint", () => {
		const glide = createScrollGlide(400, 0, 300);
		expect(scrollGlideOffset(glide, 0)).toBeCloseTo(0, 5);
		expect(scrollGlideOffset(glide, 0.5)).toBeCloseTo(200, 5);
		expect(scrollGlideOffset(glide, 1)).toBeCloseTo(400, 5);
		expect(
			scrollGlideOffset(glide, 0.25) + scrollGlideOffset(glide, 0.75),
		).toBeCloseTo(400, 5);
		expect(scrollGlideVelocity(glide, 0)).toBeCloseTo(0, 5);
		expect(scrollGlideVelocity(glide, 1)).toBeCloseTo(0, 5);
	});

	it("keeps the speed of a glide it retargets", () => {
		const first = createScrollGlide(400, 0, 300);
		const speed = scrollGlideVelocity(first, 0.5);
		const next = createScrollGlide(500, speed, 320);
		expect(scrollGlideVelocity(next, 0)).toBeCloseTo(speed, 5);
		expect(scrollGlideOffset(next, 1)).toBeCloseTo(500, 5);
		expect(scrollGlideVelocity(next, 1)).toBeCloseTo(0, 5);
	});

	it("never overshoots the target", () => {
		const glide = createScrollGlide(20, 5, 300);
		for (let t = 0; t <= 1; t += 0.01) {
			expect(scrollGlideOffset(glide, t)).toBeLessThanOrEqual(20 + 1e-9);
		}
	});

	it("drops speed that heads away from the target", () => {
		expect(createScrollGlide(-200, 2, 300).startVelocity).toBe(0);
	});
});

describe("resolveAnchorLineIndex", () => {
	const sampleLines = [
		{ id: "line-1", startTime: 1000, endTime: 2000, isBG: false, words: [] },
		{ id: "line-2", startTime: 3000, endTime: 4000, isBG: false, words: [] },
		{ id: "line-3", startTime: 5000, endTime: 6000, isBG: false, words: [] },
	] as any[];

	const mockFindCurrentLineIndex = (
		lines: any[],
		currentTime: number,
		_focusMainLine: boolean,
	) =>
		lines.findIndex(
			(l) => currentTime >= l.startTime && currentTime <= l.endTime,
		);

	it("returns modeAnchor when syncTabPosition is disabled", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: false,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: 2,
				sharedAnchor: 1,
				selectedLineIds: new Set(["line-1"]),
				currentTime: 3500,
				lines: sampleLines,
				previousMode: ToolMode.Edit,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(2);
	});

	it("resolves active playback line when transitioning from Preview with playback active", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: -1,
				sharedAnchor: -1,
				selectedLineIds: new Set(),
				currentTime: 3500,
				lines: sampleLines,
				previousMode: ToolMode.Preview,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(1);
	});

	it("resolves upcoming line when transitioning from Preview between lines", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: -1,
				sharedAnchor: -1,
				selectedLineIds: new Set(),
				currentTime: 2500,
				lines: sampleLines,
				previousMode: ToolMode.Preview,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(1);
	});

	it("prioritizes selected line when switching tabs with active selection", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: -1,
				sharedAnchor: 0,
				selectedLineIds: new Set(["line-3"]),
				currentTime: 1500,
				lines: sampleLines,
				previousMode: ToolMode.Edit,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(2);
	});

	it("falls back to shared anchor when no line is selected and audio is not playing", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: -1,
				sharedAnchor: 2,
				selectedLineIds: new Set(),
				currentTime: 0,
				lines: sampleLines,
				previousMode: ToolMode.Edit,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(2);
	});

	it("returns -1 when no valid anchors or active lines exist", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Sync,
				unchangedSinceLeft: false,
				modeAnchor: -1,
				sharedAnchor: -1,
				selectedLineIds: new Set(),
				currentTime: 0,
				lines: sampleLines,
				previousMode: ToolMode.Edit,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(-1);
	});

	it("returns to the tab's own position when nothing changed while away", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Edit,
				unchangedSinceLeft: true,
				modeAnchor: 97,
				sharedAnchor: 10,
				selectedLineIds: new Set(),
				currentTime: 3500,
				lines: sampleLines,
				previousMode: ToolMode.Sync,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(97);
	});

	it("follows the playhead when it moved while away", () => {
		expect(
			resolveAnchorLineIndex({
				syncTabPosition: true,
				toolMode: ToolMode.Edit,
				unchangedSinceLeft: false,
				modeAnchor: 97,
				sharedAnchor: 10,
				selectedLineIds: new Set(),
				currentTime: 3500,
				lines: sampleLines,
				previousMode: ToolMode.Sync,
				syncFocusMainLine: true,
				findCurrentLineIndex: mockFindCurrentLineIndex,
			}),
		).toBe(1);
	});
});
