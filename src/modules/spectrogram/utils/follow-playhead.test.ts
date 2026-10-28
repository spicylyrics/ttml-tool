import { describe, expect, it } from "vitest";
import {
	computeFollowScrollLeft,
	type FollowScrollInput,
} from "./follow-playhead";

// 100 s at 100 px/s in a 1000 px view: scrollable range is 0..9000.
const base: FollowScrollInput = {
	mode: "page",
	playheadSeconds: 0,
	zoom: 100,
	viewWidth: 1000,
	scrollLeft: 0,
	durationSeconds: 100,
};
const follow = (input: Partial<FollowScrollInput>) =>
	computeFollowScrollLeft({ ...base, ...input });

describe("computeFollowScrollLeft", () => {
	it("does nothing when off or the view isn't measured yet", () => {
		expect(follow({ mode: "off", playheadSeconds: 50 })).toBeNull();
		expect(follow({ viewWidth: 0, playheadSeconds: 50 })).toBeNull();
		expect(follow({ zoom: 0, playheadSeconds: 50 })).toBeNull();
	});

	describe("page", () => {
		it("stays put while the playhead is in view", () => {
			expect(follow({ playheadSeconds: 0 })).toBeNull();
			expect(follow({ playheadSeconds: 9.99 })).toBeNull();
			expect(follow({ scrollLeft: 2000, playheadSeconds: 25 })).toBeNull();
		});

		it("jumps when the playhead reaches the right edge, keeping a lead-in", () => {
			expect(follow({ playheadSeconds: 10 })).toBe(900);
			expect(follow({ playheadSeconds: 10.5 })).toBe(950);
		});

		it("jumps back when the playhead is left of the view", () => {
			expect(follow({ scrollLeft: 5000, playheadSeconds: 20 })).toBe(1900);
		});

		it("clamps to the start and end of the song", () => {
			expect(follow({ scrollLeft: 5000, playheadSeconds: 0.5 })).toBe(0);
			expect(follow({ playheadSeconds: 99 })).toBe(9000);
		});
	});

	describe("continuous", () => {
		it("centers the playhead", () => {
			expect(follow({ mode: "continuous", playheadSeconds: 20 })).toBe(1500);
			expect(
				follow({
					mode: "continuous",
					scrollLeft: 1500,
					playheadSeconds: 20.01,
				}),
			).toBe(1501);
		});

		it("skips sub-pixel moves", () => {
			expect(
				follow({
					mode: "continuous",
					scrollLeft: 1500,
					playheadSeconds: 20.002,
				}),
			).toBeNull();
		});

		it("clamps near the start and end", () => {
			expect(follow({ mode: "continuous", playheadSeconds: 3 })).toBeNull();
			expect(
				follow({ mode: "continuous", scrollLeft: 100, playheadSeconds: 3 }),
			).toBe(0);
			expect(follow({ mode: "continuous", playheadSeconds: 98 })).toBe(9000);
		});
	});

	it("never scrolls when the whole song fits", () => {
		expect(
			follow({ mode: "continuous", durationSeconds: 5, playheadSeconds: 4 }),
		).toBeNull();
		expect(follow({ durationSeconds: 5, playheadSeconds: 4 })).toBeNull();
	});
});
