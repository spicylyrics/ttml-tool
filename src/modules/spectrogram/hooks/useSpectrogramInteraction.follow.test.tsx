// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	audioBufferAtom,
	audioPlayingAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import {
	spectrogramContainerWidthAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import {
	spectrogramFollowOnAtom,
	spectrogramFollowStyleAtom,
} from "../states/follow-playhead";
import { useFollowPlayhead } from "./useFollowPlayhead";
import { useSpectrogramInteraction } from "./useSpectrogramInteraction";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const VIEW_WIDTH = 1000;

describe("Ctrl+wheel zoom while following continuously", () => {
	let root: Root;
	let store: ReturnType<typeof createStore>;
	let container: HTMLDivElement;
	const playheadInView = () =>
		(store.get(currentTimeAtom) / 1000) * store.get(spectrogramZoomAtom) -
		store.get(spectrogramScrollLeftAtom);

	beforeEach(async () => {
		vi.useFakeTimers();
		store = createStore();
		const panel = document.createElement("div");
		container = document.createElement("div");
		panel.appendChild(container);
		const ref = { current: container };
		function Spectrogram() {
			useSpectrogramInteraction(ref, VIEW_WIDTH);
			useFollowPlayhead(ref);
			return null;
		}
		root = createRoot(document.createElement("div"));
		await act(async () => {
			root.render(
				<Provider store={store}>
					<Spectrogram />
				</Provider>,
			);
		});
		// Stored settings re-read storage when they mount, so set them after.
		act(() => {
			store.set(audioBufferAtom, { duration: 100 } as AudioBuffer);
			store.set(spectrogramZoomAtom, 400);
			store.set(spectrogramContainerWidthAtom, VIEW_WIDTH);
			store.set(spectrogramFollowOnAtom, true);
			store.set(spectrogramFollowStyleAtom, "continuous");
			store.set(currentTimeAtom, 20000);
			store.set(audioPlayingAtom, true);
		});
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
	});

	it("keeps the moving playhead centered on every frame of the zoom", () => {
		expect(playheadInView()).toBeCloseTo(VIEW_WIDTH / 2, 0);
		act(() => {
			container.dispatchEvent(
				new WheelEvent("wheel", { ctrlKey: true, deltaY: -100 }),
			);
		});
		for (let frame = 1; frame <= 40; frame++) {
			act(() => {
				store.set(currentTimeAtom, 20000 + frame * 16);
				vi.advanceTimersByTime(16);
			});
			expect(Math.abs(playheadInView() - VIEW_WIDTH / 2)).toBeLessThan(1);
		}
		expect(store.get(spectrogramZoomAtom)).toBeCloseTo(460, 0);
	});

	it("preserves scroll when the same audio is reopened and cancels a pending zoom", () => {
		act(() => {
			store.set(audioPlayingAtom, false);
			store.set(spectrogramFollowOnAtom, false);
			store.set(spectrogramScrollLeftAtom, 1234);
			container.dispatchEvent(
				new WheelEvent("wheel", { ctrlKey: true, deltaY: -100 }),
			);
			root.render(null);
		});
		const scroll = store.get(spectrogramScrollLeftAtom);
		act(() => vi.advanceTimersByTime(1000));
		expect(store.get(spectrogramScrollLeftAtom)).toBe(scroll);
		function Reopened() {
			useSpectrogramInteraction({ current: container }, VIEW_WIDTH);
			return null;
		}
		act(() =>
			root.render(
				<Provider store={store}>
					<Reopened />
				</Provider>,
			),
		);
		expect(store.get(spectrogramScrollLeftAtom)).toBe(scroll);
	});

	it("stays centered through a long run of wheel ticks", () => {
		for (let frame = 1; frame <= 90; frame++) {
			act(() => {
				if (frame <= 60 && frame % 3 === 0) {
					container.dispatchEvent(
						new WheelEvent("wheel", {
							ctrlKey: true,
							deltaY: frame <= 30 ? -100 : 100,
						}),
					);
				}
				store.set(currentTimeAtom, 20000 + frame * 16);
				vi.advanceTimersByTime(16);
			});
			expect(Math.abs(playheadInView() - VIEW_WIDTH / 2)).toBeLessThan(1);
		}
	});
});
