import { beforeEach, describe, expect, it, vi } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";

const atoms = vi.hoisted(() => ({
	activeProjectDirAtom: { name: "dir" },
	activeProjectManifestAtom: { name: "manifest" },
	projectAudioFileAtom: { name: "audio" },
	lyricLinesAtom: { name: "lyric" },
	saveFileNameAtom: { name: "saveFileName" },
	markLyricsSavedAtom: { name: "markSaved" },
}));
const fs = vi.hoisted(() => ({
	exists: vi.fn(async (_path: string) => true),
	mkdir: vi.fn(),
	readDir: vi.fn(async () => [] as { name: string }[]),
	readTextFile: vi.fn(async () => "original-ttml"),
	remove: vi.fn(),
	rename: vi.fn(),
	writeTextFile: vi.fn(),
}));
const lyricIo = vi.hoisted(() => ({
	generateProjectTtmlText: vi.fn(() => "<tt/>"),
	writeProjectLyricFile: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-fs", () => fs);
vi.mock("react-toastify", () => ({
	toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));
vi.mock("uid", () => ({ uid: () => "id" }));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: {} }));
vi.mock("$/modules/project/logic/metadata-filename", () => ({
	getSuggestedTtmlFileName: () => ({ baseName: "Artist - Title" }),
}));
vi.mock("$/modules/settings/states", () => ({
	allowConsecutiveBackgroundLinesAtom: {},
	lyricTextNormalizationOptionsAtom: {},
}));
vi.mock("$/states/dialogs", () => ({ confirmDialogAtom: {} }));
vi.mock("$/states/main", () => ({
	isDirtyAtom: {},
	lyricLinesAtom: atoms.lyricLinesAtom,
	markLyricsSavedAtom: atoms.markLyricsSavedAtom,
	newLyricLinesAtom: {},
	projectIdAtom: {},
	saveFileNameAtom: atoms.saveFileNameAtom,
	startFreshLyricDocumentAtom: {},
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));
const audioIo = vi.hoisted(() => ({ writeProjectAudioFile: vi.fn() }));
vi.mock("./audio-io", () => audioIo);
const linkedProjects = vi.hoisted(() => ({
	isLinkedProjectDir: vi.fn(async (_dir: string) => true),
}));
vi.mock("./linked-projects", () => linkedProjects);
vi.mock("./lyric-io", () => lyricIo);
vi.mock("./project-folder-sync", () => ({
	splitDirPath: (path: string) => ({
		parent: path.slice(0, path.lastIndexOf("/")),
		base: path.slice(path.lastIndexOf("/") + 1),
	}),
	syncProjectFolderName: vi.fn(),
}));
vi.mock("./project-naming", () => ({ getSongInfo: () => ({}) }));
vi.mock("./project-open", () => ({ loadProjectFromDir: vi.fn() }));
vi.mock("./recent-projects", () => ({ upsertRecentProject: vi.fn() }));
vi.mock("./state", () => ({
	activeProjectDirAtom: atoms.activeProjectDirAtom,
	activeProjectManifestAtom: atoms.activeProjectManifestAtom,
	projectAudioFileAtom: atoms.projectAudioFileAtom,
}));
vi.mock("./workspace", () => ({
	pickProjectFolder: vi.fn(),
	rememberProjectWorkspace: vi.fn(),
}));

import { saveLyricsOnly, saveProject } from "./project-save";

const lyric = { lyricLines: [{ id: "l1" }], metadata: [] };

function makeStore(manifest: Record<string, unknown>) {
	const values = new Map<unknown, unknown>([
		[atoms.activeProjectDirAtom, "C:/Music/Song"],
		[atoms.activeProjectManifestAtom, manifest],
		[atoms.projectAudioFileAtom, null],
		[atoms.lyricLinesAtom, lyric],
		[atoms.saveFileNameAtom, "new.ttml"],
	]);
	return {
		get: (atom: unknown) => values.get(atom),
		set: vi.fn((atom: unknown, value?: unknown) => values.set(atom, value)),
	};
}

const baseManifest = {
	version: 1,
	name: "Custom Name",
	audioFile: "",
	lyricFile: "old.ttml",
};

describe("folder project saves", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not publish an old save into a newly opened project", async () => {
		const store = makeStore(baseManifest);
		fs.writeTextFile.mockImplementationOnce(async () => {
			store.set(atoms.activeProjectDirAtom, "C:/Music/Other");
		});
		await saveLyricsOnly(store as never, (key) => key, { silent: true });
		expect(store.set).not.toHaveBeenCalledWith(
			atoms.markLyricsSavedAtom,
			expect.anything(),
		);
		expect(store.set).not.toHaveBeenCalledWith(
			atoms.activeProjectManifestAtom,
			expect.anything(),
		);
	});

	it("keeps the original lyric file when writing the replacement fails", async () => {
		lyricIo.writeProjectLyricFile.mockRejectedValueOnce(new Error("disk full"));
		const store = makeStore(baseManifest);
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).not.toHaveBeenCalled();
		expect(store.set).not.toHaveBeenCalledWith(
			atoms.markLyricsSavedAtom,
			expect.anything(),
		);
	});

	it("removes the replaced lyric file only after the manifest is written", async () => {
		const store = makeStore(baseManifest);
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).toHaveBeenCalledWith("C:/Music/Song/old.ttml");
		const removeOrder = fs.remove.mock.invocationCallOrder[0];
		expect(
			lyricIo.writeProjectLyricFile.mock.invocationCallOrder[0],
		).toBeLessThan(removeOrder);
		expect(fs.writeTextFile.mock.invocationCallOrder[0]).toBeLessThan(
			removeOrder,
		);
		expect(store.set).toHaveBeenCalledWith(atoms.markLyricsSavedAtom, lyric);
	});

	it("keeps the file on a case-only rename when the filesystem is case-insensitive", async () => {
		fs.readDir.mockResolvedValueOnce([{ name: "old.ttml" }]);
		const store = makeStore(baseManifest);
		store.set(atoms.saveFileNameAtom, "OLD.ttml");
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).not.toHaveBeenCalled();
	});

	it("removes the stale file on a case-only rename when the filesystem is case-sensitive", async () => {
		fs.readDir.mockResolvedValueOnce([
			{ name: "old.ttml" },
			{ name: "OLD.ttml" },
		]);
		const store = makeStore(baseManifest);
		store.set(atoms.saveFileNameAtom, "OLD.ttml");
		await saveLyricsOnly(store as never, (k) => k);
		expect(fs.remove).toHaveBeenCalledWith("C:/Music/Song/old.ttml");
	});

	it("preserves a user-edited project name over metadata", async () => {
		const store = makeStore({ ...baseManifest, nameEdited: true });
		await saveProject(store as never, (k) => k);
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			name: "Custom Name",
		});
	});

	it("still derives the name from metadata until the user renames", async () => {
		const store = makeStore(baseManifest);
		await saveProject(store as never, (k) => k);
		expect(store.get(atoms.activeProjectManifestAtom)).toMatchObject({
			name: "Artist - Title",
		});
	});

	it("writes a linked project's lyrics back to the original file", async () => {
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		store.set(atoms.projectAudioFileAtom, new File(["a"], "song.flac"));
		expect(await saveProject(store as never, (k) => k)).toBe(true);
		expect(lyricIo.writeProjectLyricFile).toHaveBeenCalledWith(
			"D:/Lyrics",
			"song.ttml",
			"<tt/>",
		);
		expect(audioIo.writeProjectAudioFile).not.toHaveBeenCalled();
		expect(fs.remove).not.toHaveBeenCalled();
		expect(fs.writeTextFile).toHaveBeenCalledWith(
			"C:/Music/Song/project.json",
			expect.any(String),
		);
		expect(store.set).toHaveBeenCalledWith(atoms.markLyricsSavedAtom, lyric);
	});

	it("never writes a linked file on autosave", async () => {
		const store = makeStore({
			...baseManifest,
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(
			await saveLyricsOnly(store as never, (k) => k, { silent: true }),
		).toBe(false);
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();
		expect(fs.writeTextFile).not.toHaveBeenCalled();
	});

	it("backs up the original linked file into the project folder before the first explicit save", async () => {
		fs.exists.mockImplementation(
			async (p: string) => !String(p).endsWith(".bak"),
		);
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(await saveProject(store as never, (k) => k)).toBe(true);
		expect(fs.writeTextFile).toHaveBeenCalledWith(
			"C:/Music/Song/original.ttml.bak.tmp",
			"original-ttml",
		);
		expect(lyricIo.writeProjectLyricFile).toHaveBeenCalledWith(
			"D:/Lyrics",
			"song.ttml",
			"<tt/>",
		);
	});

	it("writes the linked backup to a temp file before renaming it to the final path", async () => {
		fs.exists.mockImplementation(
			async (p: string) => !String(p).endsWith(".bak"),
		);
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(await saveProject(store as never, (k) => k)).toBe(true);
		expect(fs.writeTextFile).toHaveBeenCalledWith(
			"C:/Music/Song/original.ttml.bak.tmp",
			"original-ttml",
		);
		expect(fs.writeTextFile).not.toHaveBeenCalledWith(
			"C:/Music/Song/original.ttml.bak",
			expect.anything(),
		);
		expect(fs.rename).toHaveBeenCalledWith(
			"C:/Music/Song/original.ttml.bak.tmp",
			"C:/Music/Song/original.ttml.bak",
		);
		const renameOrder = fs.rename.mock.invocationCallOrder[0];
		expect(fs.writeTextFile.mock.invocationCallOrder[0]).toBeLessThan(
			renameOrder,
		);
		expect(renameOrder).toBeLessThan(
			lyricIo.writeProjectLyricFile.mock.invocationCallOrder[0],
		);
	});

	it("preserves the original after a temp write fails and backs it up before a later save", async () => {
		const lyricPath = "D:/Lyrics/song.ttml";
		const backupPath = "C:/Music/Song/original.ttml.bak";
		const tempPath = `${backupPath}.tmp`;
		const files = new Map([[lyricPath, "original-ttml"]]);
		fs.exists.mockImplementation(async (p: string) => files.has(p));
		fs.writeTextFile.mockImplementationOnce(async (p: string) => {
			files.set(p, "");
			throw new Error("disk full");
		});
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: { lyricPath, audioPath: "E:/Audio/song.flac" },
		});
		expect(await saveProject(store as never, (k) => k)).toBe(false);
		expect(files.has(backupPath)).toBe(false);
		expect(files.get(tempPath)).toBe("");
		expect(files.get(lyricPath)).toBe("original-ttml");
		expect(fs.rename).not.toHaveBeenCalled();
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();

		fs.writeTextFile.mockImplementationOnce(async (p: string, text: string) => {
			files.set(p, text);
		});
		fs.rename.mockImplementationOnce(async (from: string, to: string) => {
			files.set(to, files.get(from) ?? "");
			files.delete(from);
		});
		lyricIo.writeProjectLyricFile.mockImplementationOnce(async () => {
			expect(files.get(backupPath)).toBe("original-ttml");
			files.set(lyricPath, "<tt/>");
		});
		expect(await saveProject(store as never, (k) => k)).toBe(true);
		expect(fs.writeTextFile).toHaveBeenNthCalledWith(
			2,
			tempPath,
			"original-ttml",
		);
		expect(fs.rename).toHaveBeenCalledWith(tempPath, backupPath);
		expect(files.get(backupPath)).toBe("original-ttml");
		expect(files.has(tempPath)).toBe(false);
		expect(files.get(lyricPath)).toBe("<tt/>");
	});

	it("does not overwrite the linked file when the backup fails", async () => {
		fs.exists.mockImplementation(
			async (p: string) => !String(p).endsWith(".bak"),
		);
		fs.readTextFile.mockRejectedValueOnce(new Error("forbidden path"));
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(await saveProject(store as never, (k) => k)).toBe(false);
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();
	});

	it("refuses a linked save from a folder outside the linked projects root", async () => {
		linkedProjects.isLinkedProjectDir.mockResolvedValueOnce(false);
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(await saveProject(store as never, (k) => k)).toBe(false);
		expect(lyricIo.writeProjectLyricFile).not.toHaveBeenCalled();
		expect(fs.writeTextFile).not.toHaveBeenCalled();
	});

	it("skips the backup when the linked file does not exist yet", async () => {
		fs.exists.mockResolvedValue(false);
		const store = makeStore({
			...baseManifest,
			audioFile: "song.flac",
			lyricFile: "song.ttml",
			linked: {
				lyricPath: "D:/Lyrics/song.ttml",
				audioPath: "E:/Audio/song.flac",
			},
		});
		expect(await saveProject(store as never, (k) => k)).toBe(true);
		expect(fs.writeTextFile).not.toHaveBeenCalledWith(
			"C:/Music/Song/original.ttml.bak",
			expect.anything(),
		);
		expect(lyricIo.writeProjectLyricFile).toHaveBeenCalledWith(
			"D:/Lyrics",
			"song.ttml",
			"<tt/>",
		);
	});
});

describe("prepared TTML project saves", () => {
	it("writes and marks the prepared snapshot instead of a newer store document", async () => {
		const store = makeStore(baseManifest);
		const snapshot = {
			lyricLines: [
				{ ...newLyricLine(), words: [{ ...newLyricWord(), word: "snapshot" }] },
			],
			metadata: [],
		};
		const onSaved = vi.fn();
		await saveLyricsOnly(store as never, (key) => key, {
			prepared: { lyric: snapshot, text: "prepared-ttml" },
			onSaved,
		});
		expect(lyricIo.writeProjectLyricFile).toHaveBeenLastCalledWith(
			"C:/Music/Song",
			"new.ttml",
			"prepared-ttml",
		);
		expect(store.set).toHaveBeenCalledWith(atoms.markLyricsSavedAtom, snapshot);
		expect(onSaved).toHaveBeenCalledOnce();
	});
	it("does not notify completion if manifest persistence fails", async () => {
		const store = makeStore(baseManifest);
		const onSaved = vi.fn();
		fs.writeTextFile.mockRejectedValueOnce(new Error("disk full"));
		await saveLyricsOnly(store as never, (key) => key, { onSaved });
		expect(onSaved).not.toHaveBeenCalled();
	});
});
