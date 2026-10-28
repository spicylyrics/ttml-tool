import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("virtual:buildmeta", () => ({
	BUILD_TIME: "2026-01-01T00:00:00.000Z",
	GIT_COMMIT: "test",
}));
vi.mock("$/utils/fileSystem", () => ({ saveFile: vi.fn() }));
vi.mock("$/modules/project/autosave/autosave", () => ({
	exportAllProjectsData: vi.fn(async () => ({ projects: [], versions: [] })),
	restoreProjectsData: vi.fn(),
}));
vi.mock("$/modules/settings/modals/customBackground", () => ({
	readCustomBackgroundBlob: vi.fn(async () => null),
	writeCustomBackgroundBlob: vi.fn(),
}));

import { isExportDeniedKey } from "$/modules/settings/backup/denylist";
import { partitionLocalStorage } from "$/modules/settings/backup/export";
import { RIBBON_CUSTOMIZE_FLAG_KEY, RIBBON_LAYOUTS_KEY } from "./states";

class MemoryStorage {
	private data = new Map<string, string>();
	get length() {
		return this.data.size;
	}
	key(index: number) {
		return [...this.data.keys()][index] ?? null;
	}
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, String(value));
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	clear() {
		this.data.clear();
	}
}

const LAYOUTS = {
	sync: {
		order: ["ribbonBar.syncMode.displayOptions"],
		pinned: ["ribbonBar.syncMode.displayOptions"],
		placement: { "ribbonBar.syncMode.assistSettings": "more" },
	},
};

beforeEach(() => {
	vi.stubGlobal("localStorage", new MemoryStorage());
	localStorage.setItem(RIBBON_CUSTOMIZE_FLAG_KEY, "true");
	localStorage.setItem(RIBBON_LAYOUTS_KEY, JSON.stringify(LAYOUTS));
});

describe("ribbon customizing in settings backups", () => {
	it("isn't on the backup denylist", () => {
		expect(isExportDeniedKey(RIBBON_CUSTOMIZE_FLAG_KEY)).toBe(false);
		expect(isExportDeniedKey(RIBBON_LAYOUTS_KEY)).toBe(false);
	});

	it("travels with the settings", () => {
		const { settings } = partitionLocalStorage();
		expect(settings[RIBBON_CUSTOMIZE_FLAG_KEY]).toBe("true");
		expect(JSON.parse(settings[RIBBON_LAYOUTS_KEY])).toEqual(LAYOUTS);
	});
});
