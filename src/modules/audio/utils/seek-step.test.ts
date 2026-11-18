import { describe, expect, it } from "vitest";
import {
	clampSeekStep,
	createRepeatThrottle,
	DEFAULT_SEEK_STEP,
	seekTarget,
} from "./seek-step";

describe("clampSeekStep", () => {
	it.each([
		[5, 5],
		[2.34, 2.3],
		[0, 0.1],
		[-3, 0.1],
		[600, 60],
		[Number.NaN, DEFAULT_SEEK_STEP],
	])("clamps %s to %s", (input, expected) => {
		expect(clampSeekStep(input)).toBe(expected);
	});
});

describe("seekTarget", () => {
	it("stays inside the song", () => {
		expect(seekTarget(10, 5, 1, 100)).toBe(15);
		expect(seekTarget(98, 5, 1, 100)).toBe(100);
		expect(seekTarget(2, 5, -1, 100)).toBe(0);
	});
});

describe("createRepeatThrottle", () => {
	it("lets presses through and spaces out repeats", () => {
		const accept = createRepeatThrottle(100);
		expect(accept({ triggerTime: 0 })).toBe(true);
		expect(accept({ triggerTime: 20 })).toBe(true);
		expect(accept({ repeat: true, triggerTime: 60 })).toBe(false);
		expect(accept({ repeat: true, triggerTime: 120 })).toBe(true);
		expect(accept({ repeat: true, triggerTime: 150 })).toBe(false);
		expect(accept({ repeat: true, triggerTime: 220 })).toBe(true);
	});
});
