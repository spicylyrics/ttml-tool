// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("react-toastify", () => ({ toast: { error: toastError } }));

import { importWithReload, isChunkLoadError } from "./import-with-reload";

const reload = vi.fn();
const storage = new Map<string, string>();

beforeEach(() => {
	storage.clear();
	reload.mockReset();
	toastError.mockReset();
	vi.stubGlobal("sessionStorage", {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, value: string) => storage.set(key, value),
	});
	vi.stubGlobal("location", { ...window.location, reload });
	vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const staleChunk = () =>
	Promise.reject(
		new TypeError("Failed to fetch dynamically imported module: x.js"),
	);

describe("importWithReload", () => {
	it("returns the module when the import works", async () => {
		await expect(importWithReload(async () => 42)).resolves.toBe(42);
		expect(reload).not.toHaveBeenCalled();
	});

	it("reloads once when a chunk fails to load", async () => {
		await expect(importWithReload(staleChunk)).rejects.toThrow(TypeError);
		expect(reload).toHaveBeenCalledOnce();
		expect(toastError).not.toHaveBeenCalled();
	});

	it("shows the error toast instead of looping on a second failure", async () => {
		await expect(importWithReload(staleChunk)).rejects.toThrow();
		await expect(importWithReload(staleChunk)).rejects.toThrow();
		expect(reload).toHaveBeenCalledOnce();
		expect(toastError).toHaveBeenCalledOnce();
	});

	it("leaves other errors alone", async () => {
		const failing = () => Promise.reject(new Error("boom"));
		await expect(importWithReload(failing)).rejects.toThrow("boom");
		expect(reload).not.toHaveBeenCalled();
		expect(toastError).not.toHaveBeenCalled();
	});

	it("recognises chunk load errors", () => {
		expect(isChunkLoadError(new TypeError("x"))).toBe(true);
		expect(isChunkLoadError(new Error("Loading chunk 3 failed"))).toBe(true);
		expect(isChunkLoadError(new Error("boom"))).toBe(false);
		expect(isChunkLoadError("nope")).toBe(false);
	});
});
