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

import {
	isDeniedKey,
	isExportDeniedKey,
} from "$/modules/settings/backup/denylist";
import {
	buildBackup,
	partitionLocalStorage,
} from "$/modules/settings/backup/export";
import { applyBackup } from "$/modules/settings/backup/import";
import type { BackupFile } from "$/modules/settings/backup/types";
import { LOGO_COLOR_STORAGE_KEYS } from "./states";

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

beforeEach(() => {
	vi.stubGlobal("localStorage", new MemoryStorage());
	localStorage.setItem("logoColorPreset", JSON.stringify("custom"));
	localStorage.setItem("logoColorCustom", JSON.stringify("#12ab9f"));
});

describe("logo color in settings backup", () => {
	it.each(
		LOGO_COLOR_STORAGE_KEYS,
	)("%s is neither import- nor export-denied", (key) => {
		expect(isDeniedKey(key)).toBe(false);
		expect(isExportDeniedKey(key)).toBe(false);
	});

	it("exports every logo color key in the settings category", () => {
		const { settings, keybindings, apiKeys } = partitionLocalStorage();

		expect(settings).toEqual({
			logoColorPreset: '"custom"',
			logoColorCustom: '"#12ab9f"',
		});
		expect(keybindings).toEqual({});
		expect(apiKeys).toEqual({});
	});

	it("restores the logo color from a backup", async () => {
		const backup = JSON.parse(
			JSON.stringify(await buildBackup(new Set(["settings"]))),
		) as BackupFile;
		localStorage.clear();

		await applyBackup(backup, new Set(["settings"]));

		expect(localStorage.getItem("logoColorPreset")).toBe('"custom"');
		expect(localStorage.getItem("logoColorCustom")).toBe('"#12ab9f"');
	});
});
