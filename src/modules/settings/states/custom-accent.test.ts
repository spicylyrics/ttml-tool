import { describe, expect, it } from "vitest";
import { resolveStoredCustomAccent } from "./index";

const storage = (entries: [string, string][]) => {
	const values = new Map(entries);
	return { getItem: (key: string) => values.get(key) ?? null };
};

describe("resolveStoredCustomAccent", () => {
	it("starts new users on lavender", () => {
		expect(resolveStoredCustomAccent(storage([]))).toBe("#b19eef");
	});

	it("keeps red for people who turned it on without picking a color", () => {
		expect(
			resolveStoredCustomAccent(storage([["useCustomAccent", "true"]])),
		).toBe("#e5484d");
	});

	it("keeps a picked color", () => {
		expect(
			resolveStoredCustomAccent(
				storage([
					["useCustomAccent", "true"],
					["customAccentColor", '"#00ff88"'],
				]),
			),
		).toBe("#00ff88");
	});
});
