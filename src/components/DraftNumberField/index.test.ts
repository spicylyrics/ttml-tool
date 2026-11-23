import { describe, expect, it } from "vitest";
import { parseDraftNumber } from ".";

describe("parseDraftNumber", () => {
	it("returns null for anything that isn't a number", () => {
		expect(parseDraftNumber("")).toBeNull();
		expect(parseDraftNumber("-")).toBeNull();
		expect(parseDraftNumber("abc")).toBeNull();
	});

	it("accepts a comma as the decimal mark", () => {
		expect(parseDraftNumber("12,5")).toBe(12.5);
	});

	it("keeps negatives and decimals", () => {
		expect(parseDraftNumber("-100")).toBe(-100);
		expect(parseDraftNumber("0.")).toBe(0);
	});

	it("clamps to the bounds", () => {
		expect(parseDraftNumber("0", { min: 1 })).toBe(1);
		expect(parseDraftNumber("9", { max: 5 })).toBe(5);
	});

	it("rounds when asked for whole numbers", () => {
		expect(parseDraftNumber("12.6", { integer: true })).toBe(13);
	});
});
