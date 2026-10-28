// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import {
	spectrogramHiddenLanesAtom,
	spectrogramLanesEnabledAtom,
} from "$/modules/spectrogram/states/lanes";
import { lyricLinesAtom, showUnselectedLinesAtom } from "$/states/main";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay";

const { renderWord } = vi.hoisted(() => ({ renderWord: vi.fn() }));
vi.mock("./LyricWordSegment.tsx", () => ({
	LyricWordSegment: ({ segment }: { segment: { word: string } }) => {
		renderWord(segment.word);
		return <span>{segment.word}</span>;
	},
}));
vi.mock("./DividerSegment.tsx", () => ({ DividerSegment: () => null }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const makeLine = (
	word: string,
	startTime: number,
	endTime: number,
	isBG = false,
): LyricLine => ({
	...newLyricLine(),
	isBG,
	startTime,
	endTime,
	words: [{ ...newLyricWord(), word, startTime, endTime }],
});

function setup(lanes: boolean) {
	vi.clearAllMocks();
	// The flag persists through atomWithStorage, which re-reads storage on mount.
	const values = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
	});
	const store = createStore();
	const main = makeLine("main", 1000, 3000);
	const bg = makeLine("echo", 1500, 2500, true);
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [main, bg] });
	store.set(showUnselectedLinesAtom, true);
	store.set(spectrogramScrollLeftAtom, 0);
	store.set(spectrogramLanesEnabledAtom, lanes);
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<LyricTimelineOverlay clientWidth={1000} />
			</Provider>,
		),
	);
	return { store, container, root, main, bg };
}

const laneText = (container: HTMLElement, lane: string) =>
	container.querySelector(`[data-lane="${lane}"]`)?.textContent;

describe("spectrogram overlay lanes", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("renders no lanes while the flag is off", () => {
		const { container, root } = setup(false);
		try {
			expect(container.querySelector("[data-lane]")).toBeNull();
			expect(container.textContent).toBe("mainecho");
		} finally {
			act(() => root.unmount());
		}
	});

	it("draws main and background lines in their own lanes", () => {
		const { container, root } = setup(true);
		try {
			expect(laneText(container, "main")).toBe("main");
			expect(laneText(container, "bg")).toBe("echo");
			const lanes = container.querySelectorAll<HTMLElement>("[data-lane]");
			expect([...lanes].map((lane) => lane.style.top)).toEqual(["0%", "50%"]);
			expect(lanes[0].style.height).toBe("50%");
		} finally {
			act(() => root.unmount());
		}
	});

	it("hides a lane and gives its space to the rest", () => {
		const { store, container, root } = setup(true);
		try {
			act(() => store.set(spectrogramHiddenLanesAtom, new Set(["bg"])));
			expect(laneText(container, "bg")).toBeUndefined();
			expect(container.textContent).toBe("main");
			const lane = container.querySelector<HTMLElement>('[data-lane="main"]');
			expect(lane?.style.height).toBe("100%");
		} finally {
			act(() => root.unmount());
		}
	});

	it("re-renders only the edited line on a timing change", () => {
		const { store, container, root, main, bg } = setup(true);
		try {
			expect(renderWord).toHaveBeenCalledTimes(2);
			act(() =>
				store.set(lyricLinesAtom, {
					metadata: [],
					lyricLines: [
						main,
						{
							...bg,
							endTime: 2600,
							words: [{ ...bg.words[0], endTime: 2600 }],
						},
					],
				}),
			);
			expect(renderWord.mock.calls.map(([word]) => word)).toEqual([
				"main",
				"echo",
				"echo",
			]);
			expect(laneText(container, "bg")).toBe("echo");
		} finally {
			act(() => root.unmount());
		}
	});
});
