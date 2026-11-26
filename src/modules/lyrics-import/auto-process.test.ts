import { describe, expect, it } from "vitest";
import { initialAutoProcess } from "./states";

const memoryStorage = (entries: Record<string, string> = {}) => {
	const map = new Map(Object.entries(entries));
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
	};
};

describe("initialAutoProcess", () => {
	it("is on for a new install and remembers that", () => {
		const storage = memoryStorage();
		expect(initialAutoProcess(storage, true)).toBe(true);
		expect(initialAutoProcess(storage, false)).toBe(true);
	});

	it("is off for someone who already used the app", () => {
		const storage = memoryStorage();
		expect(initialAutoProcess(storage, false)).toBe(false);
		expect(storage.getItem("importLyrics.autoProcess")).toBe("false");
	});

	it("keeps what the user chose", () => {
		expect(
			initialAutoProcess(
				memoryStorage({ "importLyrics.autoProcess": "true" }),
				false,
			),
		).toBe(true);
	});
});
