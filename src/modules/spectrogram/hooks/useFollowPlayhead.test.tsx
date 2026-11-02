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
	spectrogramFollowEngagedAtom,
	spectrogramFollowOnAtom,
	spectrogramFollowStyleAtom,
} from "../states/follow-playhead";
import { FOLLOW_IDLE_RESUME_MS, useFollowPlayhead } from "./useFollowPlayhead";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("useFollowPlayhead", () => {
	let root: Root;
	let store: ReturnType<typeof createStore>;
	let panel: HTMLDivElement;
	const scrollLeft = () => store.get(spectrogramScrollLeftAtom);
	const seek = (ms: number) => act(() => store.set(currentTimeAtom, ms));

	beforeEach(async () => {
		vi.useFakeTimers();
		store = createStore();
		// 100 s at 100 px/s in a 1000 px view.
		store.set(audioBufferAtom, { duration: 100 } as AudioBuffer);
		store.set(spectrogramZoomAtom, 100);
		store.set(spectrogramContainerWidthAtom, 1000);
		store.set(spectrogramScrollLeftAtom, 0);
		store.set(currentTimeAtom, 0);
		store.set(audioPlayingAtom, false);

		panel = document.createElement("div");
		const container = document.createElement("div");
		panel.appendChild(container);
		const ref = { current: container };
		function Spectrogram() {
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
			store.set(spectrogramFollowOnAtom, true);
			store.set(spectrogramFollowStyleAtom, "page");
		});
	});

	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
	});

	it("pages when the playhead leaves the view", () => {
		seek(5000);
		expect(scrollLeft()).toBe(0);
		seek(10500);
		expect(scrollLeft()).toBe(950);
	});

	it("keeps the playhead centered in continuous mode", () => {
		act(() => store.set(spectrogramFollowStyleAtom, "continuous"));
		seek(20000);
		expect(scrollLeft()).toBe(1500);
		seek(20100);
		expect(scrollLeft()).toBe(1510);
	});

	it("does nothing with the toggle off", () => {
		act(() => store.set(spectrogramFollowOnAtom, false));
		seek(50000);
		expect(scrollLeft()).toBe(0);
	});

	it("brings the playhead into view when turned on", () => {
		act(() => store.set(spectrogramFollowOnAtom, false));
		seek(50000);
		act(() => store.set(spectrogramFollowOnAtom, true));
		expect(scrollLeft()).toBe(4900);
	});

	it("pauses after a manual scroll and re-arms after the idle delay", () => {
		act(() => store.set(spectrogramScrollLeftAtom, 3000));
		seek(15000);
		expect(scrollLeft()).toBe(3000);

		act(() => vi.advanceTimersByTime(FOLLOW_IDLE_RESUME_MS));
		// Re-arming alone leaves the view where the user put it.
		expect(scrollLeft()).toBe(3000);
		seek(15100);
		expect(scrollLeft()).toBe(1410);
	});

	it("pauses on wheel and resumes as soon as playback starts", () => {
		act(() => {
			panel.dispatchEvent(new Event("wheel"));
		});
		seek(15000);
		expect(scrollLeft()).toBe(0);
		act(() => store.set(audioPlayingAtom, true));
		expect(scrollLeft()).toBe(1400);
	});

	it("keeps following through Ctrl+wheel zoom in continuous mode", () => {
		act(() => store.set(spectrogramFollowStyleAtom, "continuous"));
		seek(20000);
		expect(store.get(spectrogramFollowEngagedAtom)).toBe(true);
		act(() => {
			panel.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true }));
			// The zoom animation's own scroll write.
			store.set(spectrogramScrollLeftAtom, 1600);
		});
		seek(20100);
		expect(scrollLeft()).toBe(1510);
		expect(store.get(spectrogramFollowEngagedAtom)).toBe(true);
	});

	it("still pauses on Ctrl+wheel zoom in page mode", () => {
		act(() => {
			panel.dispatchEvent(new WheelEvent("wheel", { ctrlKey: true }));
		});
		seek(15000);
		expect(scrollLeft()).toBe(0);
		expect(store.get(spectrogramFollowEngagedAtom)).toBe(false);
	});

	it("stays paused while the mouse is held on the spectrogram", () => {
		act(() => {
			panel.dispatchEvent(new Event("pointerdown"));
		});
		act(() => vi.advanceTimersByTime(FOLLOW_IDLE_RESUME_MS * 3));
		seek(15000);
		expect(scrollLeft()).toBe(0);

		act(() => {
			window.dispatchEvent(new Event("pointerup"));
		});
		act(() => vi.advanceTimersByTime(FOLLOW_IDLE_RESUME_MS));
		seek(15100);
		expect(scrollLeft()).toBe(1410);
	});
});
