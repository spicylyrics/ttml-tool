import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
	readFile: vi.fn(async (path: string) => {
		if (path.endsWith("folder")) throw new Error("is a directory");
		return new Uint8Array([1, 2, 3]);
	}),
}));

import { readDroppedPaths } from "./nativeFileDrop";

describe("readDroppedPaths", () => {
	it("reads files with their name and path, skipping folders", async () => {
		const files = await readDroppedPaths([
			"/home/me/song.flac",
			"/home/me/folder",
			"/home/me/lyrics.ttml",
		]);
		expect(files.map((file) => file.name)).toEqual([
			"song.flac",
			"lyrics.ttml",
		]);
		expect((files[0] as File & { path?: string }).path).toBe(
			"/home/me/song.flac",
		);
		expect(files[0].size).toBe(3);
	});
});
