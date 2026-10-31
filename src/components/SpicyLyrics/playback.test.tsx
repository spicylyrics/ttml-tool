// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const testEngine = vi.hoisted(() =>
	Object.assign(new EventTarget(), {
		interpolatedCurrentTime: 0,
		musicPlaying: false,
		seekMusic: vi.fn(),
	}),
);
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: testEngine }));
vi.mock("$/modules/audio/states", async () => {
	const { atom } = await import("jotai");
	return { audioCoverArtAtom: atom(null), currentTimeAtom: atom(0) };
});
vi.mock("$/states/store", async () => {
	const { createStore } = await import("jotai");
	return { globalStore: createStore() };
});
vi.mock("$/components/PreviewModeSwitcher/states", async () => {
	const { lyricLinesAtom } = await import("$/states/main");
	return { timedPreviewLyricsAtom: lyricLinesAtom };
});
vi.mock("$/modules/settings/modals/customBackground", async () => {
	const { atom } = await import("jotai");
	return { customBackgroundImageAtom: atom(null) };
});
vi.mock("$/modules/settings/states", async () => {
	const { atom } = await import("jotai");
	return {
		allowConsecutiveBackgroundLinesAtom: atom(false),
		useCustomAccentAtom: atom(false),
		customAccentColorAtom: atom("#fff"),
		liteEffectsAtom: atom(false),
	};
});
vi.mock("$/modules/settings/states/preview", async () => {
	const { atom } = await import("jotai");
	return {
		showFpsCounterAtom: atom(false),
		showRomanLinesAtom: atom(false),
		showTranslationLinesAtom: atom(false),
		spicyBackgroundModeAtom: atom("static"),
		spicyForceLineSyncedAtom: atom(false),
		spicyJoinSplitWordsAtom: atom(false),
		spicySimpleLyricsModeAtom: atom(false),
	};
});

import { Provider } from "jotai";
import { currentTimeAtom } from "$/modules/audio/states";
import { playbackClock } from "$/modules/playback-clock";
import { spicySimpleLyricsModeAtom } from "$/modules/settings/states/preview";
import { lyricLinesAtom } from "$/states/main";
import { globalStore } from "$/states/store";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { SpicyLyrics } from ".";

const originalScrollTo = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"scrollTo",
);
const layoutProperties = [
	"clientHeight",
	"clientWidth",
	"offsetHeight",
	"scrollTop",
] as const;
const originalLayout = layoutProperties.map(
	(name) =>
		[
			name,
			Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
		] as const,
);

/**
 * jsdom has no layout. Give the preview a viewport and its rows a height, and
 * make scrolling move scrollTop, so the virtual list mounts a real window.
 */
function stubLayout(rowHeight = 0) {
	const scrollTops = new WeakMap<HTMLElement, number>();
	Object.defineProperties(HTMLElement.prototype, {
		clientHeight: { configurable: true, get: () => 600 },
		clientWidth: { configurable: true, get: () => 1000 },
		offsetHeight: {
			configurable: true,
			get(this: HTMLElement) {
				return this.dataset.index === undefined ? 0 : rowHeight;
			},
		},
		scrollTop: {
			configurable: true,
			get(this: HTMLElement) {
				return scrollTops.get(this) ?? 0;
			},
			set(this: HTMLElement, value: number) {
				scrollTops.set(this, value);
			},
		},
	});
	HTMLElement.prototype.scrollTo = vi.fn(function (
		this: HTMLElement,
		options?: ScrollToOptions | number,
	) {
		if (typeof options === "object" && options.top !== undefined) {
			scrollTops.set(this, options.top);
			this.dispatchEvent(new Event("scroll"));
		}
	}) as typeof HTMLElement.prototype.scrollTo;
}

afterEach(() => {
	for (const [name, descriptor] of originalLayout) {
		if (descriptor)
			Object.defineProperty(HTMLElement.prototype, name, descriptor);
		else Reflect.deleteProperty(HTMLElement.prototype, name);
	}
	testEngine.musicPlaying = false;
	testEngine.dispatchEvent(new Event("music-pause"));
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	if (originalScrollTo)
		Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
	else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});

describe("Spicy shared-clock rendering", () => {
	it.each([
		false,
		true,
	])("uses the editor position through pause, seek and rate changes (simple=%s)", async (simple) => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const frames = new Map<number, FrameRequestCallback>();
		let frameId = 0;
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.set(++frameId, callback);
			return frameId;
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
		vi.stubGlobal("scrollTo", vi.fn());
		stubLayout();
		const word = {
			...newLyricWord(),
			word: "Hi",
			startTime: 1000,
			endTime: 2000,
		};
		globalStore.set(lyricLinesAtom, {
			lyricLines: [
				{ ...newLyricLine(), startTime: 1000, endTime: 2000, words: [word] },
			],
			metadata: [],
		});
		globalStore.set(spicySimpleLyricsModeAtom, simple);
		testEngine.interpolatedCurrentTime = 0.95;
		testEngine.dispatchEvent(new Event("music-seeked"));
		const container = document.createElement("div");
		const root = createRoot(container);
		try {
			await act(async () =>
				root.render(
					<Provider store={globalStore}>
						<SpicyLyrics />
					</Provider>,
				),
			);
			const line = container.querySelector("[data-state]");
			expect(line?.getAttribute("data-state")).toBe("not-sung");
			// In Simple Lyrics mode the word's fill edge is written every frame
			// from its progress, -50% + 120% of it. (Normally this one-second
			// word is held and fills letter by letter.)
			const fill = () =>
				Number.parseFloat(
					line
						?.querySelector<HTMLElement>("span")
						?.style.getPropertyValue("--spicy-slm-gradient-position") ?? "",
				);
			// Spicy draws this mode 33.5ms behind the playhead.
			const fillAt = (ms: number) => -50 + 120 * ((ms - 33.5 - 1000) / 1000);
			// At 950ms, the former +100ms playing lead marked this line active.
			await act(async () => {
				testEngine.musicPlaying = true;
				testEngine.dispatchEvent(new Event("music-resume"));
			});
			expect(line?.getAttribute("data-state")).toBe("not-sung");
			expect(frames.size).toBe(1);
			await act(async () => {
				testEngine.interpolatedCurrentTime = 1.5;
				const callbacks = [...frames.values()];
				frames.clear();
				for (const callback of callbacks) callback(16);
			});
			expect(globalStore.get(currentTimeAtom)).toBe(1500);
			expect(playbackClock.getSnapshot()).toBe(1.5);
			expect(line?.getAttribute("data-state")).toBe("active");
			if (simple) expect(fill()).toBeCloseTo(fillAt(1500));
			await act(async () => {
				testEngine.musicPlaying = false;
				testEngine.dispatchEvent(new Event("music-pause"));
			});
			expect(frames.size).toBe(0);
			await act(async () => {
				testEngine.interpolatedCurrentTime = 1.75;
				testEngine.dispatchEvent(new Event("music-seeked"));
			});
			expect(globalStore.get(currentTimeAtom)).toBe(1750);
			if (simple) expect(fill()).toBeCloseTo(fillAt(1750));
			expect(frames.size).toBe(0);
			await act(async () => {
				testEngine.musicPlaying = true;
				testEngine.dispatchEvent(new Event("music-resume"));
				testEngine.dispatchEvent(new Event("music-playback-rate-change"));
				testEngine.interpolatedCurrentTime = 1.8;
				const callbacks = [...frames.values()];
				frames.clear();
				for (const callback of callbacks) callback(32);
			});
			expect(globalStore.get(currentTimeAtom)).toBe(1800);
			if (simple) expect(fill()).toBeCloseTo(fillAt(1800));
			await act(async () => {
				testEngine.musicPlaying = false;
				testEngine.interpolatedCurrentTime = 0;
				testEngine.dispatchEvent(new Event("music-seeked"));
			});
			expect(line?.getAttribute("data-state")).toBe("not-sung");
		} finally {
			await act(async () => root.unmount());
		}
	});

	it("mounts only rows near the viewport and draws rows that mount mid-song", async () => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const frames = new Map<number, FrameRequestCallback>();
		let frameId = 0;
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.set(++frameId, callback);
			return frameId;
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
		stubLayout(60);
		globalStore.set(lyricLinesAtom, {
			lyricLines: Array.from({ length: 200 }, (_, index) => ({
				...newLyricLine(),
				startTime: index * 2000,
				endTime: index * 2000 + 1800,
				words: [
					{
						...newLyricWord(),
						word: `Line ${index}`,
						startTime: index * 2000,
						endTime: index * 2000 + 1800,
					},
				],
			})),
			metadata: [],
		});
		globalStore.set(spicySimpleLyricsModeAtom, false);
		testEngine.interpolatedCurrentTime = 1;
		testEngine.dispatchEvent(new Event("music-seeked"));
		const container = document.createElement("div");
		const root = createRoot(container);
		const row = (index: number) =>
			container.querySelector<HTMLElement>(`[data-index="${index}"] > *`);
		try {
			await act(async () =>
				root.render(
					<Provider store={globalStore}>
						<SpicyLyrics />
					</Provider>,
				),
			);
			const mounted = container.querySelectorAll("[data-index]").length;
			// A 600px viewport of 60px rows, plus overscan on each side.
			expect(mounted).toBeGreaterThan(5);
			expect(mounted).toBeLessThanOrEqual(25);
			expect(row(0)?.dataset.state).toBe("active");
			expect(row(150)).toBeNull();
			const content =
				container.querySelector<HTMLElement>("[data-index]")?.parentElement;
			// The full song's height: measured rows plus estimates for the rest
			// (66px and a 1cqw gap at 1000px wide).
			const height = Number.parseFloat(content?.style.height ?? "");
			expect(height).toBeGreaterThan(200 * 60);
			expect(height).toBeLessThanOrEqual(200 * 76);

			// A paused seek far down jumps there and mounts that window.
			await act(async () => {
				testEngine.interpolatedCurrentTime = 300.5;
				testEngine.dispatchEvent(new Event("music-seeked"));
			});
			expect(row(0)).toBeNull();
			expect(container.querySelectorAll("[data-index]").length).toBeLessThan(
				30,
			);
			// Rows that just mounted get their state and blur on arrival.
			expect(row(150)?.dataset.state).toBe("active");
			expect(row(150)?.style.getPropertyValue("--blur")).toBe("0px");
			expect(row(149)?.dataset.state).toBe("sung");
			expect(row(149)?.style.getPropertyValue("--blur")).toBe("1.25px");
			expect(row(151)?.dataset.state).toBe("not-sung");
			// Paused, the list is idle again.
			expect(frames.size).toBe(0);
		} finally {
			await act(async () => root.unmount());
		}
	});

	it("leaves resting lines alone while playing and animates the active one", async () => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const frames = new Map<number, FrameRequestCallback>();
		let frameId = 0;
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.set(++frameId, callback);
			return frameId;
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
		stubLayout();
		const line = (startTime: number, endTime: number, text: string) => ({
			...newLyricLine(),
			startTime,
			endTime,
			words: [{ ...newLyricWord(), word: text, startTime, endTime }],
		});
		globalStore.set(lyricLinesAtom, {
			lyricLines: [line(1000, 1800, "Now"), line(2000, 2800, "Later")],
			metadata: [],
		});
		globalStore.set(spicySimpleLyricsModeAtom, false);
		testEngine.interpolatedCurrentTime = 1.2;
		testEngine.dispatchEvent(new Event("music-seeked"));
		const container = document.createElement("div");
		const root = createRoot(container);
		const tick = async (seconds: number, now: number) => {
			await act(async () => {
				testEngine.interpolatedCurrentTime = seconds;
				const callbacks = [...frames.values()];
				frames.clear();
				for (const callback of callbacks) callback(now);
			});
		};
		try {
			await act(async () =>
				root.render(
					<Provider store={globalStore}>
						<SpicyLyrics />
					</Provider>,
				),
			);
			await act(async () => {
				testEngine.musicPlaying = true;
				testEngine.dispatchEvent(new Event("music-resume"));
			});
			await tick(1.21, 16);
			const [active, resting] = container.querySelectorAll("[data-state]");
			expect(active.getAttribute("data-state")).toBe("active");
			expect(resting.getAttribute("data-state")).toBe("not-sung");
			const activeWord = active.querySelector("span") as HTMLElement;
			const restingWord = resting.querySelector("span") as HTMLElement;
			const activeWrites = vi.spyOn(activeWord.style, "setProperty");
			const restingWrites = vi.spyOn(restingWord.style, "setProperty");
			const restingLineWrites = vi.spyOn(
				(resting as HTMLElement).style,
				"setProperty",
			);
			await tick(1.3, 32);
			await tick(1.4, 48);
			expect(activeWrites).toHaveBeenCalled();
			expect(restingWrites).not.toHaveBeenCalled();
			expect(restingLineWrites).not.toHaveBeenCalled();
			// Once it turns active it gets its first word pass.
			await tick(2.1, 64);
			expect(resting.getAttribute("data-state")).toBe("active");
			expect(restingWrites).toHaveBeenCalled();
		} finally {
			await act(async () => root.unmount());
		}
	});
});
