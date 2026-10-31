import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getLinkedBackupInfo,
	getLinkedBackupPath,
	linkedBackupExists,
	restoreLinkedBackup,
} from "./linked-backup";
import type { ProjectManifest } from "./types";

const core = vi.hoisted(() => ({
	isTauri: vi.fn(() => true),
}));

const fs = vi.hoisted(() => ({
	exists: vi.fn(async () => true),
	readTextFile: vi.fn(async () => "original-ttml"),
	remove: vi.fn(async () => {}),
	stat: vi.fn(async () => ({ mtime: "2026-10-06T12:00:00Z" })),
}));

const lyricIo = vi.hoisted(() => ({
	writeProjectLyricFile: vi.fn(async () => {}),
}));

const projectOpen = vi.hoisted(() => ({
	loadProjectFromDir: vi.fn(async () => true),
}));

const linkedProjects = vi.hoisted(() => ({
	isLinkedProjectDir: vi.fn(async () => true),
}));

vi.mock("@tauri-apps/api/core", () => core);
vi.mock("@tauri-apps/plugin-fs", () => fs);
vi.mock("./linked-projects", () => linkedProjects);
vi.mock("./lyric-io", () => lyricIo);
vi.mock("./project-open", () => projectOpen);

const manifest: ProjectManifest & {
	linked: { lyricPath: string; audioPath: string };
} = {
	version: 1,
	app: "naenae-ttml-tool",
	projectId: "proj-1",
	name: "Song",
	lyricFile: "song.ttml",
	audioFile: "song.flac",
	createdAt: 1,
	updatedAt: 2,
	linked: {
		lyricPath: "D:/Music/song.ttml",
		audioPath: "D:/Music/song.flac",
	},
};

const t = (k: string, fallback?: string) => fallback ?? k;

describe("linked backup helpers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		core.isTauri.mockReturnValue(true);
		fs.exists.mockResolvedValue(true);
		fs.readTextFile.mockResolvedValue("original-ttml");
		fs.stat.mockResolvedValue({ mtime: "2026-10-06T12:00:00Z" } as never);
		fs.remove.mockResolvedValue(undefined);
		projectOpen.loadProjectFromDir.mockResolvedValue(true);
		linkedProjects.isLinkedProjectDir.mockResolvedValue(true);
	});

	it("returns safe backup path", () => {
		expect(getLinkedBackupPath("C:/AppData/projects/p1")).toBe(
			"C:/AppData/projects/p1/original.ttml.bak",
		);
	});

	it("checks whether backup exists", async () => {
		expect(await linkedBackupExists("C:/AppData/projects/p1")).toBe(true);
		fs.exists.mockResolvedValueOnce(false);
		expect(await linkedBackupExists("C:/AppData/projects/p1")).toBe(false);
	});

	it("gets backup info with timestamp", async () => {
		const info = await getLinkedBackupInfo("C:/AppData/projects/p1");
		expect(info.exists).toBe(true);
		expect(info.mtimeMs).toBe(new Date("2026-10-06T12:00:00Z").getTime());
	});

	it("restores linked backup to original file location", async () => {
		const ok = await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/AppData/projects/p1",
			manifest,
		);
		expect(ok).toBe(true);
		expect(lyricIo.writeProjectLyricFile).toHaveBeenCalledWith(
			"D:/Music",
			"song.ttml",
			"original-ttml",
		);
		expect(projectOpen.loadProjectFromDir).toHaveBeenCalled();
	});

	it("removes the backup once the original is restored", async () => {
		await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/AppData/projects/p1",
			manifest,
		);
		expect(fs.remove).toHaveBeenCalledWith(
			"C:/AppData/projects/p1/original.ttml.bak",
		);
	});

	it("still succeeds when the backup cannot be removed", async () => {
		fs.remove.mockRejectedValueOnce(new Error("locked"));
		const ok = await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/AppData/projects/p1",
			manifest,
		);
		expect(ok).toBe(true);
	});

	it("keeps the backup when the project fails to reload", async () => {
		projectOpen.loadProjectFromDir.mockResolvedValueOnce(false);
		const ok = await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/AppData/projects/p1",
			manifest,
		);
		expect(ok).toBe(false);
		expect(fs.remove).not.toHaveBeenCalled();
	});

	it("fails gracefully if backup does not exist", async () => {
		fs.exists.mockResolvedValueOnce(false);
		const ok = await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/AppData/projects/p1",
			manifest,
		);
		expect(ok).toBe(false);
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();
	});

	it("refuses to restore from a folder outside the linked projects root", async () => {
		linkedProjects.isLinkedProjectDir.mockResolvedValueOnce(false);
		const ok = await restoreLinkedBackup(
			{} as never,
			t as never,
			"C:/Users/me/Downloads/shared-project",
			manifest,
		);
		expect(ok).toBe(false);
		expect(fs.readTextFile).not.toHaveBeenCalled();
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();
	});
});
