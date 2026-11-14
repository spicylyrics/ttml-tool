// @vitest-environment jsdom
import { Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import { timelineDragAtom } from "$/modules/spectrogram/states/dnd";
import { lyricLinesAtom, showUnselectedLinesAtom } from "$/states/main";
import { globalStore } from "$/states/store";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay";
import { SpectrogramContext } from "./SpectrogramContext";

vi.mock("./LyricWordSegment.tsx", () => ({ LyricWordSegment: () => null }));
vi.mock("./DividerSegment.tsx", () => ({ DividerSegment: () => null }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const word = {
	...newLyricWord(),
	word: "hello",
	startTime: 1000,
	endTime: 2000,
};
// Room on both sides of the word, so it can move.
const line = {
	...newLyricLine(),
	startTime: 500,
	endTime: 3000,
	words: [word],
};

describe("dragging on the spectrogram", () => {
	let root: ReturnType<typeof createRoot>;

	beforeEach(() => {
		const container = document.createElement("div");
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			left: 0,
		} as DOMRect);
		globalStore.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
		globalStore.set(showUnselectedLinesAtom, true);
		globalStore.set(spectrogramZoomAtom, 200);
		globalStore.set(spectrogramScrollLeftAtom, 0);
		root = createRoot(document.createElement("div"));
		act(() =>
			root.render(
				<Provider store={globalStore}>
					<SpectrogramContext.Provider
						value={{ zoom: 200, scrollContainerRef: { current: container } }}
					>
						<LyricTimelineOverlay clientWidth={1000} />
					</SpectrogramContext.Provider>
				</Provider>,
			),
		);
	});
	afterEach(() => {
		act(() => globalStore.set(timelineDragAtom, null));
		act(() => root.unmount());
		vi.restoreAllMocks();
	});

	// 1500ms at zoom 200 is x = 300.
	const grabWord = () =>
		act(() =>
			globalStore.set(timelineDragAtom, {
				type: "word-pan",
				lineId: line.id,
				wordId: word.id,
				initialMouseTimeMS: 1500,
				initialWordStartMS: 1000,
			}),
		);
	const move = (clientX: number) =>
		act(() => {
			window.dispatchEvent(new MouseEvent("mousemove", { clientX }));
		});
	const release = () =>
		act(() => {
			window.dispatchEvent(new MouseEvent("mouseup"));
		});

	it("ignores a shaky click: a 1px wobble edits nothing", () => {
		const before = globalStore.get(lyricLinesAtom);
		grabWord();
		move(301);
		release();
		expect(globalStore.get(lyricLinesAtom)).toBe(before);
	});

	it("moves the word once the pointer travels past the threshold", () => {
		grabWord();
		move(320);
		release();
		expect(
			globalStore.get(lyricLinesAtom).lyricLines[0].words[0],
		).toMatchObject({ startTime: 1100 });
	});

	it("drops the drag when it is cancelled mid-move, as Escape does", () => {
		const before = globalStore.get(lyricLinesAtom);
		grabWord();
		move(340);
		act(() => globalStore.set(timelineDragAtom, null));
		release();
		expect(globalStore.get(lyricLinesAtom)).toBe(before);
	});

	it("adds no undo step when a drag ends where it started", () => {
		const before = globalStore.get(lyricLinesAtom);
		grabWord();
		move(330);
		move(300);
		release();
		expect(globalStore.get(lyricLinesAtom)).toBe(before);
	});
});
