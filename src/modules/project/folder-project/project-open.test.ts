import { describe, expect, it, vi } from "vitest";

const recentProject = {
	dir: "C:/Projects/Song",
	name: "Song",
	audioFile: "",
	lyricFile: "",
	lastOpened: 1,
	updatedAt: 1,
};

const { upsertRecentProject, workspaceDirAtom } = vi.hoisted(() => ({
	upsertRecentProject: vi.fn(),
	workspaceDirAtom: {},
}));

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
	invoke,
	isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({
	exists: vi.fn(),
	readDir: vi.fn(),
	readTextFile: vi.fn(async () => JSON.stringify({})),
	stat: vi.fn(async () => ({ isFile: true, size: 1 })),
	writeTextFile: vi.fn(),
}));
vi.mock("react-toastify", () => ({
	toast: { error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("uid", () => ({ uid: () => "project-id" }));
vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: {
		pauseMusic: vi.fn(),
		loadMusic: vi.fn(),
		unloadMusic: vi.fn(),
	},
}));
vi.mock("$/modules/project/logic/metadata-filename", () => ({
	getSuggestedTtmlFileName: vi.fn(),
}));
vi.mock("$/states/dialogs", () => ({ confirmDialogAtom: {} }));
const { startFreshLyricDocumentAtom } = vi.hoisted(() => ({
	startFreshLyricDocumentAtom: {},
}));

vi.mock("$/states/main", () => ({
	isDirtyAtom: {},
	newLyricLinesAtom: {},
	projectIdAtom: {},
	saveFileNameAtom: {},
	startFreshLyricDocumentAtom,
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));
vi.mock("./audio-io", () => ({
	AUDIO_EXTS: new Set(),
	loadProjectAudioFile: vi.fn(),
}));
vi.mock("./linked-projects", () => ({
	isLinkedProjectDir: vi.fn(async () => true),
}));
vi.mock("./lyric-io", () => ({ readProjectLyricFile: vi.fn() }));
vi.mock("./manifest", () => ({
	assertSafePath: (dir: string, file: string) => `${dir}/${file}`,
	getFileExtension: vi.fn(),
	getFileNameFromPath: vi.fn(),
	isProjectManifest: () => true,
	isSafeProjectFileName: () => true,
}));
vi.mock("./project-folder-sync", () => ({
	resolveManifestFiles: vi.fn(async () => recentProject),
}));
vi.mock("./project-naming", () => ({ getSongInfo: vi.fn() }));
vi.mock("./recent-projects", () => ({
	removeRecentProject: vi.fn(),
	upsertRecentProject,
}));
vi.mock("./state", () => ({
	activeProjectDirAtom: {},
	activeProjectManifestAtom: {},
	projectAudioFileAtom: {},
	workspaceDirAtom,
	workspaceProjectsAtom: {},
	workspaceScanningAtom: {},
}));
vi.mock("./types", () => ({
	PROJECT_MANIFEST_APP_ID: "naenae-ttml-tool",
	PROJECT_MANIFEST_FILENAME: "project.json",
}));

import { readTextFile } from "@tauri-apps/plugin-fs";
import { beforeEach } from "vitest";
import { audioEngine } from "$/modules/audio/audio-engine";
import { loadProjectAudioFile } from "./audio-io";
import { isLinkedProjectDir } from "./linked-projects";
import { readProjectLyricFile } from "./lyric-io";
import { resolveManifestFiles } from "./project-folder-sync";
import { loadProjectFromDir } from "./project-open";

describe("loadProjectFromDir", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resolveManifestFiles).mockResolvedValue(recentProject as never);
		vi.mocked(loadProjectAudioFile).mockResolvedValue(null);
	});
	it("waits until the recent-project record is persisted", async () => {
		let release: (() => void) | undefined;
		upsertRecentProject.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		const store = { get: () => false, set: vi.fn() };
		let settled = false;
		const result = loadProjectFromDir(
			"C:/Projects/Song",
			store as never,
			(key) => key,
		).then(() => {
			settled = true;
		});

		await vi.waitFor(() => expect(upsertRecentProject).toHaveBeenCalledOnce());
		expect(settled).toBe(false);
		release?.();
		await result;
		// Opening by path (recents, workspace list) must never widen fs scope.
		expect(invoke).not.toHaveBeenCalled();
		expect(store.set).toHaveBeenCalledWith(workspaceDirAtom, "C:/Projects");
		expect(store.set).toHaveBeenCalledWith(startFreshLyricDocumentAtom);
	});

	it("unloads previous audio when the opened project has no audio", async () => {
		vi.mocked(resolveManifestFiles).mockResolvedValue({
			version: 1,
			name: "Song",
			audioFile: "",
			lyricFile: "",
		} as never);
		vi.mocked(loadProjectAudioFile).mockResolvedValue(null);
		const store = { get: () => false, set: vi.fn() };
		const ok = await loadProjectFromDir(
			"C:/Projects/Silent",
			store as never,
			(key) => key,
		);
		expect(ok).toBe(true);
		expect(audioEngine.unloadMusic).toHaveBeenCalledOnce();
		expect(audioEngine.loadMusic).not.toHaveBeenCalled();
	});

	it("loads new audio without unloading when the project has audio", async () => {
		const audio = new File(["data"], "audio.mp3", { type: "audio/mpeg" });
		vi.mocked(resolveManifestFiles).mockResolvedValue({
			version: 1,
			name: "Song",
			audioFile: "audio.mp3",
			lyricFile: "",
		} as never);
		vi.mocked(loadProjectAudioFile).mockResolvedValue(audio);
		const store = { get: () => false, set: vi.fn() };
		const ok = await loadProjectFromDir(
			"C:/Projects/Song",
			store as never,
			(key) => key,
		);
		expect(ok).toBe(true);
		expect(audioEngine.loadMusic).toHaveBeenCalledWith(audio);
		expect(audioEngine.unloadMusic).not.toHaveBeenCalled();
	});

	it("rejects a linked manifest outside the linked projects folder", async () => {
		vi.mocked(readTextFile).mockResolvedValueOnce(
			JSON.stringify({
				version: 1,
				name: "x",
				audioFile: "",
				lyricFile: "lyrics.ttml",
				linked: {
					lyricPath: "C:/Users/me/Music/Other/lyrics.ttml",
					audioPath: "C:/Users/me/Music/a.mp3",
				},
			}),
		);
		vi.mocked(isLinkedProjectDir).mockResolvedValueOnce(false);
		const store = { get: () => false, set: vi.fn() };
		const ok = await loadProjectFromDir(
			"C:/Users/me/Downloads/shared",
			store as never,
			(key) => key,
		);
		expect(ok).toBe(false);
		expect(readProjectLyricFile).not.toHaveBeenCalled();
		expect(store.set).not.toHaveBeenCalled();
	});
});
