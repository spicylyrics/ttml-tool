// @vitest-environment jsdom
import { createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";

const KEY = "settings_spectrogramTopFrequency";

async function loadStates() {
	// Vite's Jotai refresh plugin caches atoms across vi.resetModules().
	vi.stubGlobal("jotaiAtomCache", undefined);
	vi.resetModules();
	const states = await import("./index");
	const audio = await import("$/modules/audio/states/index.ts");
	return { ...states, audioBufferAtom: audio.audioBufferAtom };
}

afterEach(() => {
	localStorage.clear();
	vi.unstubAllGlobals();
});

describe("spectrogramTopFrequencyAtom", () => {
	it("defaults to full", async () => {
		const { spectrogramTopFrequencyAtom } = await loadStates();
		expect(createStore().get(spectrogramTopFrequencyAtom)).toBe("full");
	});

	it("reads a saved voice setting back", async () => {
		localStorage.setItem(KEY, JSON.stringify("voice"));
		const { spectrogramTopFrequencyAtom } = await loadStates();
		expect(createStore().get(spectrogramTopFrequencyAtom)).toBe("voice");
	});

	it("reads an unknown saved value as full", async () => {
		localStorage.setItem(KEY, JSON.stringify("treble"));
		const { spectrogramTopFrequencyAtom } = await loadStates();
		expect(createStore().get(spectrogramTopFrequencyAtom)).toBe("full");
	});

	it("moves the ruler and hover top to about 8 kHz on voice", async () => {
		const {
			audioBufferAtom,
			spectrogramFftSizeAtom,
			spectrogramHeightAtom,
			spectrogramHoverFrequencyAtom,
			spectrogramHoverPyAtom,
			spectrogramTopFrequencyAtom,
			spectrogramTopHzAtom,
		} = await loadStates();
		const store = createStore();
		store.set(audioBufferAtom, { sampleRate: 48000 } as AudioBuffer);
		store.set(spectrogramFftSizeAtom, 1024);
		store.set(spectrogramHeightAtom, 256);
		store.set(spectrogramHoverPyAtom, 0);

		expect(store.get(spectrogramTopHzAtom)).toBeCloseTo(427 * 46.875, 6);
		store.set(spectrogramTopFrequencyAtom, "voice");
		expect(store.get(spectrogramTopHzAtom)).toBeCloseTo(171 * 46.875, 6);
		expect(store.get(spectrogramHoverFrequencyAtom)).toBeCloseTo(
			171 * 46.875,
			6,
		);
		expect(localStorage.getItem(KEY)).toBe(JSON.stringify("voice"));
	});
});
