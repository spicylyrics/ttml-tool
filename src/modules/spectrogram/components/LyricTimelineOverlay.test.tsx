// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import { lyricLinesAtom, showUnselectedLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay";

const { renderWord, renderDivider } = vi.hoisted(() => ({
	renderWord: vi.fn(),
	renderDivider: vi.fn(),
}));
vi.mock("./LyricWordSegment.tsx", () => ({
	LyricWordSegment: ({ segment }: { segment: { word: string } }) => {
		renderWord(segment.word);
		return <span>{segment.word}</span>;
	},
}));
vi.mock("./DividerSegment.tsx", () => ({
	DividerSegment: () => {
		renderDivider();
		return null;
	},
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("spectrogram overlay rendering", () => {
	it("skips parent hover renders and leaves other lines alone during timing edits", () => {
		vi.clearAllMocks();
		const store = createStore();
		const first = {
			...newLyricLine(),
			startTime: 1000,
			endTime: 2000,
			words: [
				{ ...newLyricWord(), word: "first", startTime: 1000, endTime: 2000 },
			],
		};
		const second = {
			...newLyricLine(),
			startTime: 3000,
			endTime: 4000,
			words: [
				{ ...newLyricWord(), word: "second", startTime: 3000, endTime: 4000 },
			],
		};
		store.set(lyricLinesAtom, { metadata: [], lyricLines: [first, second] });
		store.set(showUnselectedLinesAtom, true);
		store.set(spectrogramScrollLeftAtom, 0);
		const container = document.createElement("div");
		const root = createRoot(container);
		const render = () =>
			root.render(
				<Provider store={store}>
					<LyricTimelineOverlay clientWidth={1000} />
				</Provider>,
			);
		try {
			act(render);
			expect(renderWord).toHaveBeenCalledTimes(2);
			const dividerCount = renderDivider.mock.calls.length;
			act(render);
			expect(renderWord).toHaveBeenCalledTimes(2);
			expect(renderDivider).toHaveBeenCalledTimes(dividerCount);
			act(() =>
				store.set(lyricLinesAtom, {
					metadata: [],
					lyricLines: [
						first,
						{
							...second,
							endTime: 4500,
							words: [{ ...second.words[0], endTime: 4500 }],
						},
					],
				}),
			);
			expect(renderWord.mock.calls.map(([word]) => word)).toEqual([
				"first",
				"second",
				"second",
			]);
			expect(container.textContent).toBe("firstsecond");
			act(() => store.set(spectrogramScrollLeftAtom, 100));
			expect(renderWord).toHaveBeenCalledTimes(3);
			act(() => store.set(spectrogramScrollLeftAtom, 1600));
			expect(container.textContent).toBe("second");
			expect(renderWord).toHaveBeenCalledTimes(3);
		} finally {
			act(() => root.unmount());
		}
	});
});
