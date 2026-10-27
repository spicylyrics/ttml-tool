// @vitest-environment jsdom
import { type Atom, createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";

vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: { seekMusic: vi.fn() },
}));
vi.mock("$/utils/fileSystem", () => ({ saveFile: vi.fn() }));
vi.mock("./folder-project/project-save", () => ({
	saveLyricsOnly: vi.fn(),
	saveProject: vi.fn(),
}));
vi.mock("react-toastify", () => ({
	toast: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));

import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { problemsDialogAtom } from "$/modules/linter/states";
import { lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	markLyricsSavedAtom,
	saveFileNameAtom,
	selectedWordsAtom,
	undoableLyricLinesAtom,
} from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import { saveLyricsOnly, saveProject } from "./folder-project/project-save";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
} from "./folder-project/state";
import { copyTTML, saveTTML } from "./ttml-save";

const document = (word = "hello"): TTMLLyric => ({
	metadata: [
		{ key: "artists", value: ["Artist"] },
		{ key: "musicName", value: ["Title"] },
	],
	lyricLines: [
		{
			...newLyricLine(),
			startTime: 100,
			endTime: 200,
			words: [{ ...newLyricWord(), word, startTime: 100, endTime: 200 }],
		},
	],
});
const t = (key: string, fallback?: string) => fallback ?? key;
function setup(lyric = document()) {
	const store = createStore();
	store.sub(undoableLyricLinesAtom, () => {});
	store.sub(isDirtyAtom, () => {});
	store.set(lyricLinesAtom, lyric);
	store.set(saveFileNameAtom, "Song.ttml");
	return store;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(saveFile).mockReset().mockResolvedValue("Saved.ttml");
	vi.mocked(saveLyricsOnly).mockReset().mockResolvedValue(false);
	vi.mocked(saveProject).mockReset().mockResolvedValue(true);
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
	});
});

describe("shared TTML save action", () => {
	it("marks only a successfully written file saved and calls guide completion", async () => {
		const store = setup();
		const onSaved = vi.fn();
		expect(await saveTTML(store, t, { onSaved })).toBe(true);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(store.get(saveFileNameAtom)).toBe("Saved.ttml");
		expect(onSaved).toHaveBeenCalledOnce();
	});
	it.each([
		"cancel",
		"failure",
	])("keeps dirty state and guide completion after %s", async (kind) => {
		const store = setup();
		const onSaved = vi.fn();
		if (kind === "cancel") vi.mocked(saveFile).mockResolvedValueOnce(null);
		else vi.mocked(saveFile).mockRejectedValueOnce(new Error("disk full"));
		expect(await saveTTML(store, t, { onSaved })).toBe(false);
		expect(store.get(isDirtyAtom)).toBe(true);
		expect(store.get(saveFileNameAtom)).toBe("Song.ttml");
		expect(onSaved).not.toHaveBeenCalled();
	});
	it("does not clear edits made while the picker is open", async () => {
		const store = setup();
		vi.mocked(saveFile).mockImplementationOnce(async () => {
			store.set(lyricLinesAtom, document("later edit"));
			return "Saved.ttml";
		});
		await saveTTML(store, t);
		expect(store.get(isDirtyAtom)).toBe(true);
	});
	it("copies identical text without changing file name or saved state", async () => {
		const store = setup();
		await copyTTML(store, t);
		expect(store.get(isDirtyAtom)).toBe(true);
		expect(store.get(saveFileNameAtom)).toBe("Song.ttml");
		await saveTTML(store, t);
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			vi.mocked(saveFile).mock.calls[0][0],
		);
	});
	it("uses metadata naming when the document has no name", async () => {
		const store = setup();
		store.set(saveFileNameAtom, "");
		await saveTTML(store, t);
		expect(saveFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ suggestedName: "Artist - Title.ttml" }),
		);
	});
	it("queues the same warning for interactive export and saves only on confirmation", async () => {
		const lyric = document();
		lyric.lyricLines[0].endTime = 0;
		const store = setup(lyric);
		const onSaved = vi.fn();
		expect(await saveTTML(store, t, { onSaved })).toBe(false);
		expect(saveFile).not.toHaveBeenCalled();
		const dialog = store.get(confirmDialogAtom);
		expect(dialog.open).toBe(true);
		dialog.onCancel?.();
		expect(
			store.get(selectedWordsAtom).has(lyric.lyricLines[0].words[0].id),
		).toBe(true);
		expect(audioEngine.seekMusic).toHaveBeenCalledWith(0.1);
		dialog.onConfirm?.();
		await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
		expect(store.get(isDirtyAtom)).toBe(false);
	});
	it("warns for untimed clipboard copy too, without marking saved", async () => {
		const lyric = document();
		lyric.lyricLines[0].words[0].endTime = 0;
		const store = setup(lyric);
		await copyTTML(store, t);
		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
		store.get(confirmDialogAtom).onConfirm?.();
		await vi.waitFor(() =>
			expect(navigator.clipboard.writeText).toHaveBeenCalledOnce(),
		);
		expect(store.get(isDirtyAtom)).toBe(true);
	});
	it("respects folder and linked projects even if the feature toggle is off", async () => {
		for (const linked of [
			undefined,
			{ lyricPath: "C:/linked.ttml", audioPath: "C:/audio.mp3" },
		]) {
			const store = setup();
			store.set(activeProjectDirAtom, "C:/project");
			store.set(activeProjectManifestAtom, {
				version: 1,
				name: "Project",
				lyricFile: "lyrics.ttml",
				audioFile: "",
				createdAt: 1,
				updatedAt: 1,
				linked,
			});
			vi.mocked(saveLyricsOnly).mockImplementationOnce(
				async (_store, _t, options) => {
					if (options?.prepared)
						store.set(markLyricsSavedAtom, options.prepared.lyric);
					options?.onSaved?.();
					return false;
				},
			);
			expect(await saveTTML(store, t)).toBe(true);
			expect(store.get(isDirtyAtom)).toBe(false);
		}
		expect(saveFile).not.toHaveBeenCalled();
	});
	it("recovers without React dialogs when optional settings are broken", async () => {
		const lyric = document();
		lyric.lyricLines[0].endTime = 0;
		const store = setup(lyric);
		const onWarning = vi.fn();
		const originalGet = store.get;
		store.get = function get<Value>(atom: Atom<Value>): Value {
			if (atom === lyricTextNormalizationOptionsAtom)
				throw new Error("broken setting");
			return originalGet(atom);
		};
		expect(await saveTTML(store, t, { recovery: true, onWarning })).toBe(true);
		expect(onWarning).toHaveBeenCalled();
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(saveFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ suggestedName: "Song.ttml" }),
		);
	});
	it("rescues a standalone copy after a project save failure only in recovery", async () => {
		const store = setup();
		store.set(activeProjectDirAtom, "C:/project");
		store.set(activeProjectManifestAtom, {
			version: 1,
			name: "Project",
			nameEdited: true,
			lyricFile: "lyrics.ttml",
			audioFile: "",
			createdAt: 1,
			updatedAt: 1,
		});
		expect(await saveTTML(store, t)).toBe(false);
		expect(saveFile).not.toHaveBeenCalled();
		expect(await saveTTML(store, t, { recovery: true })).toBe(true);
		expect(saveFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ suggestedName: "Project.ttml" }),
		);
	});
	it("routes full project save through the same reviewed snapshot", async () => {
		const store = setup();
		expect(await saveTTML(store, t, { project: true })).toBe(true);
		expect(saveProject).toHaveBeenCalledWith(
			store,
			t,
			expect.objectContaining({
				prepared: {
					lyric: store.get(lyricLinesAtom),
					text: expect.any(String),
				},
			}),
		);
		expect(saveFile).not.toHaveBeenCalled();
	});
	it("still rescues a standalone copy when the project layer throws", async () => {
		const store = setup();
		store.set(activeProjectDirAtom, "C:/project");
		store.set(activeProjectManifestAtom, {
			version: 1,
			name: "Project",
			lyricFile: "lyrics.ttml",
			audioFile: "",
			createdAt: 1,
			updatedAt: 1,
		});
		vi.mocked(saveLyricsOnly).mockRejectedValueOnce(
			new Error("broken project"),
		);
		expect(await saveTTML(store, t, { recovery: true })).toBe(true);
		expect(saveFile).toHaveBeenCalledOnce();
	});
	it("does not mark newer edits saved after confirming an older snapshot", async () => {
		const lyric = document();
		lyric.lyricLines[0].endTime = 0;
		const store = setup(lyric);
		const onSaved = vi.fn();
		await saveTTML(store, t, { onSaved });
		store.set(lyricLinesAtom, document("newer"));
		store.get(confirmDialogAtom).onConfirm?.();
		await vi.waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
		expect(store.get(isDirtyAtom)).toBe(true);
		expect(saveFile).toHaveBeenCalledWith(
			expect.stringContaining("hello"),
			expect.anything(),
		);
	});
	it("asks before exporting checker errors and opens Problems on Fix it", async () => {
		const store = setup(document("[Chorus]"));
		expect(await saveTTML(store, t)).toBe(false);
		expect(saveFile).not.toHaveBeenCalled();
		const dialog = store.get(confirmDialogAtom);
		expect(dialog.open).toBe(true);
		expect(dialog.title).toContain("error");
		dialog.onCancel?.();
		expect(store.get(problemsDialogAtom)).toBe(true);
		dialog.onConfirm?.();
		await vi.waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
	});
	it("shows one clickable warning toast after a save, without asking", async () => {
		const store = setup();
		expect(await saveTTML(store, t)).toBe(true);
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(toast.warn).toHaveBeenCalledOnce();
		const options = vi.mocked(toast.warn).mock.calls[0][1] as {
			onClick: () => void;
		};
		options.onClick();
		expect(store.get(problemsDialogAtom)).toBe(true);
	});
	it("never runs the checker gate in recovery", async () => {
		const store = setup(document("[Chorus]"));
		expect(await saveTTML(store, t, { recovery: true })).toBe(true);
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(toast.warn).not.toHaveBeenCalled();
	});
});
