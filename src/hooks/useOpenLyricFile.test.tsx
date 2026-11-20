// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$/modules/project/autosave/autosave", () => ({
	getProjectList: vi.fn(async () => []),
}));
vi.mock("$/modules/project/folder-project/project-create", () => ({
	maybePromptCreateProject: vi.fn(),
}));
vi.mock("$/utils/logging", () => ({ log: vi.fn(), error: vi.fn() }));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("react-toastify", () => ({ toast: { error: vi.fn() } }));
// The QRC, YRC and LYS parsers are WASM that is not initialized in tests.
vi.mock("@applemusic-like-lyrics/lyric", () => ({
	parseEslrc: () => [],
	parseLys: () => [],
	parseQrc: () => [],
	parseYrc: () => [],
}));

import { toast } from "react-toastify";
import { confirmDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, savedLyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { useOpenLyricFile } from "./useOpenLyricFile";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const file = (name: string, text: string) =>
	Object.assign(new File([text], name), { text: async () => text });

const doc = (word: string): TTMLLyric => ({
	lyricLines: [{ ...newLyricLine(), words: [{ ...newLyricWord(), word }] }],
	metadata: [],
});

describe("opening a lyric file", () => {
	let root: Root;
	let store: ReturnType<typeof createStore>;
	let open: ReturnType<typeof useOpenLyricFile>["openLyricFile"];

	beforeEach(async () => {
		vi.clearAllMocks();
		store = createStore();
		root = createRoot(document.createElement("div"));
		function Harness() {
			open = useOpenLyricFile().openLyricFile;
			return null;
		}
		await act(async () => {
			root.render(
				<Provider store={store}>
					<Harness />
				</Provider>,
			);
		});
	});
	afterEach(async () => {
		await act(async () => root.unmount());
	});

	const makeDirty = () => {
		const saved = doc("saved");
		store.set(lyricLinesAtom, saved);
		store.set(savedLyricLinesAtom, saved);
		store.set(lyricLinesAtom, doc("edited"));
		return store.get(lyricLinesAtom);
	};

	it("refuses a broken .ttml before asking or replacing anything", async () => {
		const mine = makeDirty();
		const afterOpen = vi.fn();
		await act(async () =>
			open(file("bad.ttml", "<tt><body"), undefined, afterOpen),
		);
		expect(store.get(lyricLinesAtom)).toBe(mine);
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(toast.error).toHaveBeenCalledWith("error.noLyricsInFile");
		// The audio half of a dropped pair still loads.
		expect(afterOpen).toHaveBeenCalledOnce();
	});

	it("refuses an unsupported file the same way", async () => {
		const mine = makeDirty();
		await act(async () => open(file("package.json", "{}")));
		expect(store.get(lyricLinesAtom)).toBe(mine);
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(toast.error).toHaveBeenCalledWith("error.unsupportedFileFormat");
	});

	it("asks before replacing unsaved changes with a good file", async () => {
		const mine = makeDirty();
		const afterOpen = vi.fn();
		await act(async () =>
			open(file("song.lrc", "[00:01.00]hello"), undefined, afterOpen),
		);
		expect(store.get(confirmDialogAtom).open).toBe(true);
		expect(store.get(lyricLinesAtom)).toBe(mine);
		expect(afterOpen).not.toHaveBeenCalled();
		await act(async () => store.get(confirmDialogAtom).onConfirm?.());
		expect(store.get(lyricLinesAtom)).not.toBe(mine);
		expect(store.get(lyricLinesAtom).lyricLines[0].words[0].word).toContain(
			"hello",
		);
		expect(afterOpen).toHaveBeenCalledOnce();
	});

	it("opens a good file straight away when nothing is unsaved", async () => {
		await act(async () => open(file("song.lrc", "[00:01.00]hello")));
		expect(store.get(confirmDialogAtom).open).toBe(false);
		expect(store.get(lyricLinesAtom).lyricLines).toHaveLength(1);
	});
});
