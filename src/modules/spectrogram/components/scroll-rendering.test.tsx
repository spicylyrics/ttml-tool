// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act, Profiler } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { processSingleLine } from "$/modules/segmentation/utils/segment-processing";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import { timelineDragAtom } from "$/modules/spectrogram/states/dnd";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { LyricLineSegment } from "./LyricLineSegment";
import { LyricWordSegment } from "./LyricWordSegment";
import { SpectrogramContext } from "./SpectrogramContext";

vi.mock("$/modules/audio/audio-engine.ts", () => ({
	audioEngine: { auditionRange: vi.fn() },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("spectrogram scroll isolation", () => {
	it.each([
		"line",
		"word",
	] as const)("does not redraw a %s on scroll, and starts dragging at the latest scroll offset", (kind) => {
		const store = createStore();
		const word = {
			...newLyricWord(),
			word: "test",
			startTime: 1000,
			endTime: 2000,
		};
		const line = processSingleLine({
			...newLyricLine(),
			startTime: 1000,
			endTime: 2000,
			words: [word],
		});
		const container = document.createElement("div");
		const root = createRoot(container);
		const onRender = vi.fn();
		const context = { zoom: 200, scrollContainerRef: { current: container } };
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			left: 100,
		} as DOMRect);
		try {
			act(() =>
				root.render(
					<Provider store={store}>
						<SpectrogramContext.Provider value={context}>
							<Profiler id="segment" onRender={onRender}>
								{kind === "line" ? (
									<LyricLineSegment
										line={line}
										isTouchingStart={false}
										isTouchingEnd={false}
									/>
								) : (
									<LyricWordSegment
										lineId={line.id}
										segment={{ ...word, type: "word" }}
										lineStartTime={1000}
									/>
								)}
							</Profiler>
						</SpectrogramContext.Provider>
					</Provider>,
				),
			);
			const commits = onRender.mock.calls.length;
			act(() => store.set(spectrogramScrollLeftAtom, 500));
			act(() => store.set(spectrogramScrollLeftAtom, 700));
			expect(onRender).toHaveBeenCalledTimes(commits);
			const target = container.querySelector(
				kind === "line" ? '[aria-label="Lyric Line"]' : '[role="button"]',
			);
			if (!target) throw new Error("Segment missing");
			act(() =>
				target.dispatchEvent(
					new MouseEvent("mousedown", {
						bubbles: true,
						button: 0,
						clientX: 150,
					}),
				),
			);
			expect(store.get(timelineDragAtom)).toMatchObject({
				type: `${kind}-pan`,
				lineId: line.id,
				initialMouseTimeMS: 3750,
			});
		} finally {
			act(() => root.unmount());
			vi.restoreAllMocks();
		}
	});
});
