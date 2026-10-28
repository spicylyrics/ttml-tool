// @vitest-environment jsdom
import { createStore } from "jotai";
import { RESET } from "jotai/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { customEqualizerPresetsAtom } from "$/modules/audio/states";
import { customPaletteStopsAtom } from "$/modules/spectrogram/states";
import { keyBindingTriggerModeAtom } from "$/utils/keybindings";
import { geniusApiKeyAtom } from "../states";
import { EXPERIMENTAL_FLAGS } from "./experimental";
import {
	GROUP_RESETS,
	type ResettableAtom,
	resetSettings,
} from "./group-reset";
import { preferencesShellEnabledAtom } from "./states";

const groups = Object.values(GROUP_RESETS);
const allAtoms = groups.flatMap((settings) =>
	(settings ?? []).flatMap((setting) => setting.atoms),
);

/** A value of the same type that differs from `value`. */
function changed(value: unknown): unknown {
	if (typeof value === "boolean") return !value;
	if (typeof value === "number") return value / 2 + 0.1;
	if (typeof value === "string") return `${value}-changed`;
	if (Array.isArray(value)) return [...value, 1];
	throw new Error(`No changed value for ${JSON.stringify(value)}`);
}

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key: string) => data.get(key) ?? null,
		key: (index: number) => [...data.keys()][index] ?? null,
		removeItem: (key: string) => void data.delete(key),
		setItem: (key: string, value: string) => void data.set(key, value),
	};
}

describe("GROUP_RESETS", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("covers the pages whose settings are known", () => {
		expect(Object.keys(GROUP_RESETS).sort()).toEqual([
			"audio",
			"editing",
			"preview",
		]);
	});

	it("lists every atom in one group only", () => {
		expect(new Set(allAtoms).size).toBe(allAtoms.length);
	});

	it.each(
		allAtoms.map((setting, index) => [index, setting] as const),
	)("atom %i is stored and resets to its default", (_index, setting) => {
		const store = createStore();
		const initial = store.get(setting);
		store.set(setting, changed(initial));
		expect(store.get(setting)).not.toEqual(initial);
		expect(localStorage.length).toBeGreaterThan(0);
		store.set(setting, RESET);
		expect(store.get(setting)).toEqual(initial);
		expect(localStorage.length).toBe(0);
	});

	it("resets a whole group back to its defaults", () => {
		const store = createStore();
		for (const settings of groups) {
			const stored = (settings ?? []).flatMap((setting) => setting.atoms);
			const defaults = stored.map((setting) => store.get(setting));
			for (const setting of stored) {
				store.set(setting, changed(store.get(setting)));
			}
			resetSettings(store.set, settings ?? []);
			expect(stored.map((setting) => store.get(setting))).toEqual(defaults);
		}
	});

	it("leaves keybindings, API keys, flags and saved presets alone", () => {
		const excluded: ResettableAtom[] = [
			geniusApiKeyAtom,
			preferencesShellEnabledAtom,
			customEqualizerPresetsAtom,
			customPaletteStopsAtom,
			...EXPERIMENTAL_FLAGS.map((flag) => flag.atom as ResettableAtom),
		];
		const listed = new Set<unknown>(allAtoms);
		for (const setting of [...excluded, keyBindingTriggerModeAtom]) {
			expect(listed.has(setting)).toBe(false);
		}

		const store = createStore();
		store.set(geniusApiKeyAtom, "secret");
		store.set(preferencesShellEnabledAtom, true);
		store.set(customEqualizerPresetsAtom, { Mine: [1] });
		for (const flag of EXPERIMENTAL_FLAGS) store.set(flag.atom, true);
		const before = excluded.map((setting) => store.get(setting));
		for (const settings of groups) resetSettings(store.set, settings ?? []);
		expect(excluded.map((setting) => store.get(setting))).toEqual(before);
	});
});
