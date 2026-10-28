import { describe, expect, it } from "vitest";
import {
	EDIT_SCROLL_MAX_PROJECTS,
	EDIT_SCROLL_STORAGE_KEY,
	editScrollProjectKey,
	recallEditScroll,
	rememberEditScroll,
} from "./edit-scroll-memory";

const memoryStorage = () => {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => {
			data.set(key, value);
		},
	};
};

describe("editScrollProjectKey", () => {
	it("prefers the project folder, since folder opens get a new project id", () => {
		expect(editScrollProjectKey("C:/Songs/Song A", "abc")).toBe(
			"dir:C:/Songs/Song A",
		);
		expect(editScrollProjectKey(null, "abc")).toBe("id:abc");
	});
});

describe("edit scroll memory", () => {
	it("restores the remembered line for the same project", () => {
		const storage = memoryStorage();
		rememberEditScroll("dir:a", 42, storage);
		rememberEditScroll("dir:b", 7, storage);
		expect(recallEditScroll("dir:a", 100, storage)).toBe(42);
		expect(recallEditScroll("dir:b", 100, storage)).toBe(7);
		expect(recallEditScroll("dir:c", 100, storage)).toBe(-1);
	});

	it("keeps the line inside a document that got shorter", () => {
		const storage = memoryStorage();
		rememberEditScroll("dir:a", 42, storage);
		expect(recallEditScroll("dir:a", 10, storage)).toBe(9);
		expect(recallEditScroll("dir:a", 0, storage)).toBe(-1);
	});

	it("drops the least recently used project past the cap", () => {
		const storage = memoryStorage();
		for (let index = 0; index <= EDIT_SCROLL_MAX_PROJECTS; index++) {
			rememberEditScroll(`id:${index}`, index, storage);
		}
		// Touching the oldest keeps it; the next oldest goes instead.
		rememberEditScroll("id:1", 99, storage);
		rememberEditScroll("id:new", 1, storage);
		const saved = JSON.parse(storage.data.get(EDIT_SCROLL_STORAGE_KEY) ?? "{}");
		expect(Object.keys(saved)).toHaveLength(EDIT_SCROLL_MAX_PROJECTS);
		expect(saved["id:0"]).toBeUndefined();
		expect(saved["id:2"]).toBeUndefined();
		expect(saved["id:1"]).toBe(99);
		expect(saved["id:new"]).toBe(1);
	});

	it("ignores broken or foreign data instead of throwing", () => {
		const storage = memoryStorage();
		storage.setItem(EDIT_SCROLL_STORAGE_KEY, "not json");
		expect(recallEditScroll("dir:a", 10, storage)).toBe(-1);
		storage.setItem(
			EDIT_SCROLL_STORAGE_KEY,
			JSON.stringify({ "dir:a": "5", "dir:b": -1, "dir:c": 3 }),
		);
		expect(recallEditScroll("dir:a", 10, storage)).toBe(-1);
		expect(recallEditScroll("dir:b", 10, storage)).toBe(-1);
		expect(recallEditScroll("dir:c", 10, storage)).toBe(3);
		rememberEditScroll("dir:a", 2, storage);
		expect(recallEditScroll("dir:a", 10, storage)).toBe(2);
	});

	it("works without storage", () => {
		expect(() => rememberEditScroll("dir:a", 1, null)).not.toThrow();
		expect(recallEditScroll("dir:a", 10, null)).toBe(-1);
	});
});
