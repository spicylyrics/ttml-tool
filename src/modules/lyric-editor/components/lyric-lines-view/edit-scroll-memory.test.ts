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

/** Line ids `l0` to `l{count - 1}`. */
const ids = (count: number) =>
	Array.from({ length: count }, (_, index) => `l${index}`);

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
		rememberEditScroll("dir:a", { id: "l42", index: 42 }, storage);
		rememberEditScroll("dir:b", { id: "l7", index: 7 }, storage);
		expect(recallEditScroll("dir:a", ids(100), storage)).toBe(42);
		expect(recallEditScroll("dir:b", ids(100), storage)).toBe(7);
		expect(recallEditScroll("dir:c", ids(100), storage)).toBe(-1);
	});

	it("follows the line when lines are added above it", () => {
		const storage = memoryStorage();
		rememberEditScroll("dir:a", { id: "l5", index: 5 }, storage);
		const withNewLines = ["new1", "new2", ...ids(10)];
		expect(recallEditScroll("dir:a", withNewLines, storage)).toBe(7);
	});

	it("falls back to the index when the line's id is gone", () => {
		const storage = memoryStorage();
		rememberEditScroll("dir:a", { id: "gone", index: 42 }, storage);
		expect(recallEditScroll("dir:a", ids(100), storage)).toBe(42);
		expect(recallEditScroll("dir:a", ids(10), storage)).toBe(9);
		expect(recallEditScroll("dir:a", [], storage)).toBe(-1);
	});

	it("still restores a bare index saved by an earlier build", () => {
		const storage = memoryStorage();
		storage.setItem(EDIT_SCROLL_STORAGE_KEY, JSON.stringify({ "dir:a": 12 }));
		expect(recallEditScroll("dir:a", ids(100), storage)).toBe(12);
		rememberEditScroll("dir:a", { id: "l3", index: 3 }, storage);
		expect(
			JSON.parse(storage.data.get(EDIT_SCROLL_STORAGE_KEY) ?? "{}")["dir:a"],
		).toEqual({ id: "l3", index: 3 });
	});

	it("drops the least recently used project past the cap", () => {
		const storage = memoryStorage();
		for (let index = 0; index <= EDIT_SCROLL_MAX_PROJECTS; index++) {
			rememberEditScroll(`id:${index}`, { index }, storage);
		}
		// Touching the oldest keeps it; the next oldest goes instead.
		rememberEditScroll("id:1", { index: 99 }, storage);
		rememberEditScroll("id:new", { index: 1 }, storage);
		const saved = JSON.parse(storage.data.get(EDIT_SCROLL_STORAGE_KEY) ?? "{}");
		expect(Object.keys(saved)).toHaveLength(EDIT_SCROLL_MAX_PROJECTS);
		expect(saved["id:0"]).toBeUndefined();
		expect(saved["id:2"]).toBeUndefined();
		expect(saved["id:1"]).toEqual({ index: 99 });
		expect(saved["id:new"]).toEqual({ index: 1 });
	});

	it("ignores broken or foreign data instead of throwing", () => {
		const storage = memoryStorage();
		storage.setItem(EDIT_SCROLL_STORAGE_KEY, "not json");
		expect(recallEditScroll("dir:a", ids(10), storage)).toBe(-1);
		storage.setItem(
			EDIT_SCROLL_STORAGE_KEY,
			JSON.stringify({
				"dir:a": "5",
				"dir:b": -1,
				"dir:c": 3,
				"dir:d": { id: "l1" },
				"dir:e": { id: 4, index: 2 },
			}),
		);
		expect(recallEditScroll("dir:a", ids(10), storage)).toBe(-1);
		expect(recallEditScroll("dir:b", ids(10), storage)).toBe(-1);
		expect(recallEditScroll("dir:c", ids(10), storage)).toBe(3);
		expect(recallEditScroll("dir:d", ids(10), storage)).toBe(-1);
		expect(recallEditScroll("dir:e", ids(10), storage)).toBe(2);
		rememberEditScroll("dir:a", { id: "l2", index: 2 }, storage);
		expect(recallEditScroll("dir:a", ids(10), storage)).toBe(2);
	});

	it("skips an invalid index", () => {
		const storage = memoryStorage();
		rememberEditScroll("dir:a", { id: "l1", index: -1 }, storage);
		expect(storage.data.size).toBe(0);
	});

	it("works without storage", () => {
		expect(() => rememberEditScroll("dir:a", { index: 1 }, null)).not.toThrow();
		expect(recallEditScroll("dir:a", ids(10), null)).toBe(-1);
	});
});
