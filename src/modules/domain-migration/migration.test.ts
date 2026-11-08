import { describe, expect, it, vi } from "vitest";
import { shouldOfferStableData } from "$/components/BringDataFromStable";
import type { BackupFile } from "$/modules/settings/backup/types";
import {
	BETA_COPY_COMPLETED_KEY,
	BETA_TOOL_ORIGIN,
	classifyMigrationOrigin,
	createMigrationNonce,
	isMigrationPath,
	OFFICIAL_TOOL_ORIGIN,
	transferRouteFrom,
	transferRoutesTo,
} from "./config";
import {
	getMigrationConflicts,
	hasMigrationConflicts,
	type MigrationMergeChoices,
	mergeMigrationBackup,
} from "./merge";
import {
	decodeMigrationPayload,
	encodeMigrationPayload,
	isMigrationMessage,
} from "./protocol";

const backup = (
	overrides: Partial<BackupFile["categories"]> = {},
): BackupFile => ({
	app: "amll-ttml-tool",
	formatVersion: 1,
	exportedAt: "2026-10-25T00:00:00.000Z",
	build: { commit: "test", time: "2026-10-25T00:00:00.000Z" },
	categories: overrides,
});

const keepDestination: MigrationMergeChoices = {
	replaceSettings: false,
	replaceKeybindings: false,
	replaceApiKeys: false,
	replaceAppearance: false,
};

const counts = {
	settings: 0,
	keybindings: 0,
	apiKeys: 0,
	assets: { background: false, presets: 0, font: false },
	projects: 0,
};

const project = (name: string, lastModified: number) => ({
	id: "p",
	name,
	lastModified,
	latestState: {} as never,
});

describe("domain migration hosts", () => {
	it("copies from tool.spicylyrics.org to the beta site by default", () => {
		expect(OFFICIAL_TOOL_ORIGIN).toBe("https://tool.spicylyrics.org");
		expect(BETA_TOOL_ORIGIN).toBe("https://beta.tool.spicylyrics.org");
	});

	it("classifies only the official sites", () => {
		expect(classifyMigrationOrigin(OFFICIAL_TOOL_ORIGIN)).toBe("official");
		expect(classifyMigrationOrigin(BETA_TOOL_ORIGIN)).toBe("beta");
		expect(
			classifyMigrationOrigin("https://tool.community.spicylyrics.org"),
		).toBe("other");
		expect(classifyMigrationOrigin("https://preview.example.com")).toBe(
			"other",
		);
		expect(classifyMigrationOrigin(OFFICIAL_TOOL_ORIGIN, true)).toBe("other");
	});

	it("only allows the listed transfers, and never beta to stable", () => {
		expect(
			transferRouteFrom("https://tool.community.spicylyrics.org"),
		).toBeUndefined();
		expect(transferRouteFrom(OFFICIAL_TOOL_ORIGIN)?.destination).toBe(
			BETA_TOOL_ORIGIN,
		);
		expect(transferRouteFrom(BETA_TOOL_ORIGIN)).toBeUndefined();
		expect(transferRouteFrom("https://evil.example.com")).toBeUndefined();
		expect(transferRouteFrom(OFFICIAL_TOOL_ORIGIN, true)).toBeUndefined();

		expect(
			transferRoutesTo(BETA_TOOL_ORIGIN).map((route) => route.source),
		).toEqual([OFFICIAL_TOOL_ORIGIN]);
		expect(
			transferRoutesTo(OFFICIAL_TOOL_ORIGIN).map((route) => route.source),
		).toEqual([]);
		expect(transferRoutesTo("https://evil.example.com")).toEqual([]);
	});

	it("offers beta data once, only on the beta site", () => {
		const storage = (entries: Record<string, string>) => ({
			getItem: (key: string) => entries[key] ?? null,
		});
		expect(shouldOfferStableData(storage({}), true)).toBe(true);
		expect(shouldOfferStableData(storage({}), false)).toBe(false);
		expect(
			shouldOfferStableData(storage({ [BETA_COPY_COMPLETED_KEY]: "x" }), true),
		).toBe(false);
		expect(
			shouldOfferStableData(storage({ betaDataOfferDismissed: "true" }), true),
		).toBe(false);
	});

	it("only routes the two flat migration paths", () => {
		expect(isMigrationPath("/migration-send")).toBe(true);
		expect(isMigrationPath("/migration-receive")).toBe(true);
		expect(isMigrationPath("/migration/send")).toBe(false);
		expect(isMigrationPath("/")).toBe(false);
	});

	it("creates an unpredictable 128-bit nonce", () => {
		vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
			(array as Uint8Array).fill(0xab);
			return array;
		});
		expect(createMigrationNonce()).toBe("ab".repeat(16));
	});
});

describe("domain migration protocol", () => {
	it("round-trips payloads larger than one chunk", () => {
		const value = { text: "x".repeat(1_100_000) };
		const chunks = encodeMigrationPayload(value);
		expect(chunks.length).toBeGreaterThan(1);
		expect(decodeMigrationPayload(chunks)).toEqual(value);
	});

	it("accepts current-format metadata", () => {
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 2,
				nonce: "a".repeat(32),
				totalChunks: 1,
				counts,
			}),
		).toBe(true);
	});

	it("rejects malformed, wrong-version, and incomplete messages", () => {
		expect(isMigrationMessage(null)).toBe(false);
		// v1 senders (the August migration) are not compatible.
		expect(
			isMigrationMessage({
				type: "receiver-ready",
				protocol: 1,
				nonce: "a".repeat(32),
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 2,
				nonce: "a".repeat(32),
				totalChunks: 1,
			}),
		).toBe(false);
		// Old count shape (boolean assets, plugins) is rejected.
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 2,
				nonce: "a".repeat(32),
				totalChunks: 1,
				counts: {
					settings: 0,
					keybindings: 0,
					assets: false,
					projects: 0,
					plugins: 0,
				},
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "chunk",
				protocol: 2,
				nonce: "a".repeat(32),
				index: 0,
				data: "bad",
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "metadata",
				protocol: 2,
				nonce: "a".repeat(32),
				totalChunks: 2049,
				counts,
			}),
		).toBe(false);
		expect(
			isMigrationMessage({
				type: "receiver-ready",
				protocol: 2,
				nonce: "too-short",
			}),
		).toBe(false);
	});
});

describe("domain migration merge", () => {
	it("detects every supported conflict category", () => {
		const source = backup({
			settings: { localStorage: { theme: "dark" } },
			keybindings: { localStorage: { play: "space" } },
			apiKeys: { localStorage: { geniusApiKey: "old" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "old", updatedAt: 1 },
			},
			projects: { projects: [project("Old", 2)], versions: [] },
		});
		const destination = backup({
			settings: { localStorage: { theme: "light" } },
			keybindings: { localStorage: { play: "enter" } },
			apiKeys: { localStorage: { geniusApiKey: "new" } },
			assets: { backgroundImage: null, appearancePresets: [{ id: 1 }] },
			projects: { projects: [project("New", 3)], versions: [] },
		});
		const conflicts = getMigrationConflicts(source, destination);
		expect(hasMigrationConflicts(conflicts)).toBe(true);
		expect(conflicts).toEqual({
			settings: ["theme"],
			keybindings: ["play"],
			apiKeys: ["geniusApiKey"],
			projects: ["p"],
			appearance: true,
		});
	});

	it("preserves destination-only data and keeps the newest matching project", () => {
		const source = backup({
			settings: { localStorage: { old: "yes", shared: "old" } },
			projects: {
				projects: [project("Old", 2)],
				versions: [{ projectId: "p", timestamp: 2, data: {} as never }],
			},
		});
		const destination = backup({
			settings: { localStorage: { new: "yes", shared: "new" } },
			projects: {
				projects: [project("New", 3)],
				versions: [{ projectId: "p", timestamp: 3, data: {} as never }],
			},
		});
		const merged = mergeMigrationBackup(source, destination, keepDestination);
		expect(merged.categories.settings?.localStorage).toEqual({
			old: "yes",
			new: "yes",
			shared: "new",
		});
		expect(merged.categories.projects?.projects[0]?.name).toBe("New");
		expect(merged.categories.projects?.versions).toEqual([
			{ projectId: "p", timestamp: 3, data: {} },
		]);
	});

	describe("copy mode", () => {
		const copyChoices: MigrationMergeChoices = {
			...keepDestination,
			keepBothProjects: (name) => `${name} (copy)`,
		};
		const version = (projectId: string, timestamp: number) => ({
			projectId,
			timestamp,
			data: {} as never,
		});

		it("adds a newer incoming project beside the one here, with its history", () => {
			const source = backup({
				projects: {
					projects: [project("stable", 200)],
					versions: [version("p", 150)],
				},
			});
			const destination = backup({
				projects: {
					projects: [project("beta", 100)],
					versions: [version("p", 90)],
				},
			});
			const merged = mergeMigrationBackup(source, destination, copyChoices);
			const projects = merged.categories.projects;
			expect(projects?.projects.map((item) => [item.id, item.name])).toEqual([
				["p", "beta"],
				["p~copy-200", "stable (copy)"],
			]);
			expect(projects?.versions).toEqual([
				version("p", 90),
				version("p~copy-200", 150),
			]);
		});

		it("is safe to run again: nothing here changes and nothing doubles", () => {
			const source = backup({
				projects: {
					projects: [project("stable", 200)],
					versions: [version("p", 150)],
				},
			});
			const first = mergeMigrationBackup(
				source,
				backup({
					projects: { projects: [project("beta", 100)], versions: [] },
				}),
				copyChoices,
			);
			const second = mergeMigrationBackup(source, first, copyChoices);
			expect(second.categories.projects).toEqual(first.categories.projects);
		});

		it("keeps a project that's newer here without adding anything", () => {
			const merged = mergeMigrationBackup(
				backup({
					projects: {
						projects: [project("stable", 100)],
						versions: [version("p", 50)],
					},
				}),
				backup({
					projects: {
						projects: [project("beta", 200)],
						versions: [version("p", 190)],
					},
				}),
				copyChoices,
			);
			expect(merged.categories.projects?.projects).toEqual([
				project("beta", 200),
			]);
			expect(merged.categories.projects?.versions).toEqual([version("p", 190)]);
		});
	});

	it("honours replace choices for settings, the Genius token and appearance", () => {
		const source = backup({
			settings: { localStorage: { shared: "old" } },
			apiKeys: { localStorage: { geniusApiKey: "old" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "old", updatedAt: 1 },
				customFont: { name: "Old", data: "font" },
			},
		});
		const destination = backup({
			settings: { localStorage: { shared: "new" } },
			apiKeys: { localStorage: { geniusApiKey: "new" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "new", updatedAt: 2 },
				appearancePresets: [{ id: "keep" }],
			},
		});
		const merged = mergeMigrationBackup(source, destination, {
			replaceSettings: true,
			replaceKeybindings: false,
			replaceApiKeys: true,
			replaceAppearance: true,
		});
		expect(merged.categories.settings?.localStorage.shared).toBe("old");
		expect(merged.categories.apiKeys?.localStorage.geniusApiKey).toBe("old");
		expect(merged.categories.assets?.backgroundImage?.dataBase64).toBe("old");
		expect(merged.categories.assets?.customFont?.name).toBe("Old");
		// The source had no presets, so the destination's survive.
		expect(merged.categories.assets?.appearancePresets).toEqual([
			{ id: "keep" },
		]);
	});

	it("moves everything into an empty destination without conflicts", () => {
		const source = backup({
			settings: { localStorage: { theme: "dark" } },
			apiKeys: { localStorage: { geniusApiKey: "secret" } },
			assets: {
				backgroundImage: { mime: "image/png", dataBase64: "bg", updatedAt: 1 },
			},
			projects: { projects: [project("Moved", 1)], versions: [] },
		});
		const destination = backup();
		const conflicts = getMigrationConflicts(source, destination);
		expect(hasMigrationConflicts(conflicts)).toBe(false);
		const merged = mergeMigrationBackup(source, destination, keepDestination);
		expect(merged.categories.apiKeys?.localStorage.geniusApiKey).toBe("secret");
		expect(merged.categories.assets?.backgroundImage?.dataBase64).toBe("bg");
		expect(merged.categories.projects?.projects).toHaveLength(1);
	});

	it("leaves assets out when neither side has any", () => {
		const merged = mergeMigrationBackup(backup(), backup(), keepDestination);
		expect(merged.categories.assets).toBeUndefined();
	});
});
