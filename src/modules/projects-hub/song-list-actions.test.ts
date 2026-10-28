// @vitest-environment jsdom
import { createStore } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-toastify", () => ({
	toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import { addChecklistEntry } from "$/modules/ttml-checklist/logic";
import { ttmlChecklistAtom } from "$/modules/ttml-checklist/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	undoableLyricLinesAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	markSongListExported,
	rememberSongListProjectDir,
	startSongListProject,
} from "./song-list-actions";
import { projectsHubEnabledAtom } from "./states";

const t = (key: string, fallback?: string) => fallback ?? key;

function setup() {
	globalThis.localStorage?.clear?.();
	const store = createStore();
	store.sub(undoableLyricLinesAtom, () => {});
	store.sub(isDirtyAtom, () => {});
	store.set(
		ttmlChecklistAtom,
		addChecklistEntry(
			[],
			{ song: "Song", artist: "Artist", notes: "" },
			1,
			"entry",
		),
	);
	return store;
}

const entry = (store: ReturnType<typeof setup>) =>
	store.get(ttmlChecklistAtom).find((item) => item.id === "entry");

beforeEach(() => vi.clearAllMocks());

describe("song list actions", () => {
	it("starts a fresh document with title and artist and links the entry", () => {
		const store = setup();
		store.set(activeProjectDirAtom, "C:/Old");
		const started = entry(store);
		if (!started) throw new Error("missing entry");
		startSongListProject(store, started, t);
		expect(store.get(lyricLinesAtom).metadata).toEqual([
			{ key: "musicName", value: ["Song"] },
			{ key: "artists", value: ["Artist"] },
		]);
		expect(store.get(activeProjectDirAtom)).toBeNull();
		expect(store.get(saveFileNameAtom)).toBe("Artist - Song.ttml");
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(entry(store)?.projectId).toBe(store.get(projectIdAtom));
	});

	it("asks before replacing unsaved lyrics", () => {
		const store = setup();
		store.set(lyricLinesAtom, {
			metadata: [],
			lyricLines: [
				{ ...newLyricLine(), words: [{ ...newLyricWord(), word: "x" }] },
			],
		});
		const started = entry(store);
		if (!started) throw new Error("missing entry");
		startSongListProject(store, started, t);
		expect(store.get(confirmDialogAtom).open).toBe(true);
		expect(entry(store)?.projectId).toBeUndefined();
	});

	it("marks the started entry done on export only with the flag on", () => {
		const store = setup();
		const started = entry(store);
		if (!started) throw new Error("missing entry");
		startSongListProject(store, started, t);
		markSongListExported(store, t);
		expect(entry(store)?.completed).toBe(false);
		store.set(projectsHubEnabledAtom, true);
		markSongListExported(store, t);
		expect(entry(store)?.completed).toBe(true);
	});

	it("remembers the folder project the started document became", () => {
		const store = setup();
		const started = entry(store);
		if (!started) throw new Error("missing entry");
		startSongListProject(store, started, t);
		store.set(activeProjectDirAtom, "C:/Projects/Song");
		rememberSongListProjectDir(store);
		expect(entry(store)?.projectDir).toBe("C:/Projects/Song");
	});
});
