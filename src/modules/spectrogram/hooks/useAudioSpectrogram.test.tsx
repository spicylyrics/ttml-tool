// @vitest-environment jsdom
import { createStore, Provider, useAtomValue } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { audioBufferAtom } from "$/modules/audio/states";
import {
	spectrogramFftSizeAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverPyAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import { useAudioSpectrogram } from "./useAudioSpectrogram";

const mocks = vi.hoisted(() => ({
	updateTiles: vi.fn(),
	draw: vi.fn(),
	tileTimestamp: 1,
}));
vi.mock("../utils/visible-tiles", () => ({
	updateVisibleSpectrogramTiles: mocks.updateTiles,
}));
vi.mock("$/modules/audio/audio-engine.ts", () => ({ audioEngine: {} }));
vi.mock("$/hooks/useLoadAudio.ts", () => ({
	useLoadAudio: () => ({ loadAudio: vi.fn() }),
}));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
vi.mock("./useSpectrogramTransfers", () => ({
	useSpectrogramTransfers: () => ({}),
}));
vi.mock("./useSpectrogramWorker.ts", () => ({
	useSpectrogramWorker: () => ({
		tileCache: null,
		requestTileIfNeeded: mocks.updateTiles,
		lastTileTimestamp: mocks.tileTimestamp,
	}),
}));
vi.mock("./useSpectrogramResize.ts", () => ({
	useSpectrogramResize: () => ({
		height: 300,
		maxHeight: 500,
		resizeHandleProps: {},
	}),
}));
vi.mock("./useTimelineEditing.ts", () => ({ useTimelineEditing: () => ({}) }));
vi.mock("./useSpectrogramSelection.ts", () => ({
	useSpectrogramSelection: () => ({}),
}));
vi.mock("./useSpectrogramInteraction.ts", () => ({
	useSpectrogramInteraction: () => ({
		zoom: useAtomValue(spectrogramZoomAtom),
		scrollLeft: useAtomValue(spectrogramScrollLeftAtom),
		isZooming: false,
	}),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("spectrogram refresh scheduling", () => {
	it("refreshes tiles and ruler once per view change and new tile notification", () => {
		vi.clearAllMocks();
		mocks.tileTimestamp = 1;
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		);
		const store = createStore();
		store.set(audioBufferAtom, { duration: 20 } as AudioBuffer);
		store.set(spectrogramScrollLeftAtom, 0);
		store.set(spectrogramZoomAtom, 200);
		store.set(spectrogramFftSizeAtom, 1024);
		const root = createRoot(document.createElement("div"));
		function Harness() {
			const view = useAudioSpectrogram();
			view.rulerRef.current = { draw: mocks.draw };
			return <div ref={view.scrollContainerRef} />;
		}
		const render = () =>
			root.render(
				<Provider store={store}>
					<Harness />
				</Provider>,
			);
		try {
			act(render);
			expect(mocks.updateTiles).toHaveBeenCalledTimes(1);
			expect(mocks.draw).toHaveBeenCalledTimes(1);
			act(() => store.set(spectrogramScrollLeftAtom, 100));
			expect(mocks.updateTiles).toHaveBeenCalledTimes(2);
			expect(mocks.draw).toHaveBeenCalledTimes(2);
			act(() => store.set(spectrogramZoomAtom, 250));
			expect(mocks.updateTiles).toHaveBeenCalledTimes(3);
			expect(mocks.draw).toHaveBeenCalledTimes(3);
			act(() => store.set(spectrogramFftSizeAtom, 2048));
			expect(mocks.updateTiles).toHaveBeenCalledTimes(4);
			mocks.tileTimestamp = 2;
			act(render);
			expect(mocks.updateTiles).toHaveBeenCalledTimes(5);
			expect(mocks.draw).toHaveBeenCalledTimes(5);
		} finally {
			act(() => root.unmount());
			vi.unstubAllGlobals();
		}
	});

	it("does not re-render the panel when only the pointer moves", () => {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		);
		const store = createStore();
		store.set(audioBufferAtom, { duration: 20 } as AudioBuffer);
		const root = createRoot(document.createElement("div"));
		let renders = 0;
		function Harness() {
			const view = useAudioSpectrogram();
			renders++;
			return <div ref={view.scrollContainerRef} />;
		}
		try {
			act(() =>
				root.render(
					<Provider store={store}>
						<Harness />
					</Provider>,
				),
			);
			const before = renders;
			act(() => {
				for (let x = 1; x <= 30; x++) {
					store.set(spectrogramHoverPxAtom, x * 10);
					store.set(spectrogramHoverPyAtom, x);
				}
			});
			expect(renders).toBe(before);
		} finally {
			act(() => root.unmount());
			vi.unstubAllGlobals();
		}
	});
});
