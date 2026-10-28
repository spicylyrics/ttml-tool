import { describe, expect, it } from "vitest";
import { displayBpm, MIN_BPM_CONFIDENCE } from "./analyze";

describe("displayBpm", () => {
	it("rounds a confident estimate", () => {
		expect(displayBpm({ bpm: 119.6, confidence: 0.8 })).toBe(120);
	});

	it("hides low-confidence and missing estimates", () => {
		expect(
			displayBpm({ bpm: 120, confidence: MIN_BPM_CONFIDENCE - 0.01 }),
		).toBeNull();
		expect(displayBpm(null)).toBeNull();
	});
});
