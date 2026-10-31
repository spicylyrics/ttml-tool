// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	extraKeyBindingsStorageKey,
	keyBindingListAtom,
} from "../binding-list";
import { cmdSaveFile, cmdSyncStart, cmdUndo } from "../commands";
import { shortcutSearchAtom } from "../states";
import {
	AutoKeyBindingSettingsPanel,
	ShowAllShortcutsSwitch,
} from "./SettingsPanel";

// Node's own localStorage stub shadows jsdom's; use a plain in-memory one.
const data = vi.hoisted(() => {
	const data = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => data.set(name, String(value)),
		removeItem: (name: string) => data.delete(name),
		clear: () => data.clear(),
	});
	return data;
});
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup = () => {};
beforeEach(() => data.clear());
afterEach(() => cleanup());

const EXTRA_KEY = extraKeyBindingsStorageKey(cmdSyncStart.id);

function mount() {
	data.set(`keybindings:${cmdSyncStart.id}`, JSON.stringify(["KeyJ"]));
	data.set(EXTRA_KEY, JSON.stringify([["KeyZ"]]));
	const store = createStore();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					{/* On the page the switch sits on the keyboard view's hint line. */}
					<ShowAllShortcutsSwitch />
					<AutoKeyBindingSettingsPanel />
				</Theme>
			</Provider>,
		),
	);
	cleanup = () => {
		act(() => root.unmount());
		container.remove();
	};
	return { store, container };
}

function rowButton(container: HTMLElement, text: string) {
	const field = [...container.querySelectorAll("input")].find(
		(input) => input.value === "J",
	);
	const row = field?.closest(".rt-Flex");
	const button = [...(row?.querySelectorAll("button") ?? [])].find(
		(candidate) => candidate.textContent === text,
	);
	if (!button) throw new Error(`No ${text} button in the sync start row`);
	return button;
}

async function click(button: HTMLButtonElement) {
	await act(async () => button.click());
}

describe("shortcut rows", () => {
	it("lists the second keys next to the primary", () => {
		const { container } = mount();
		const row = [...container.querySelectorAll("input")]
			.find((input) => input.value === "J")
			?.closest(".rt-Flex");
		const keys = [...(row?.querySelectorAll(".rt-Kbd") ?? [])].map(
			(kbd) => kbd.textContent,
		);
		expect(keys).toEqual(["Z"]);
	});

	it("clears the extra keys along with the primary", async () => {
		const { store, container } = mount();
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([
			["KeyJ"],
			["KeyZ"],
		]);
		await click(rowButton(container, "settingsDialog.keybindings.clear"));
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([[]]);
		expect(data.has(EXTRA_KEY)).toBe(false);
	});

	it("resets to the default and drops the extra keys", async () => {
		const { store, container } = mount();
		await click(
			rowButton(container, "settingsDialog.keybindings.resetDefault"),
		);
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([
			cmdSyncStart.defaultKeys,
		]);
		expect(data.has(EXTRA_KEY)).toBe(false);
	});
});

describe("shortcut list", () => {
	const listed = (container: HTMLElement, description: string) =>
		container.textContent?.includes(description) ?? false;

	it("lists actions with a key, and the rest behind the switch", async () => {
		const { store, container } = mount();
		await act(async () => void store.set(cmdUndo.atom, []));
		expect(listed(container, cmdUndo.description)).toBe(false);
		expect(listed(container, cmdSyncStart.description)).toBe(true);
		const toggle = container.querySelector<HTMLButtonElement>(
			'button[role="switch"]',
		);
		await act(async () => toggle?.click());
		expect(listed(container, cmdUndo.description)).toBe(true);
	});

	it("filters by the keyboard view's search, by key or by name, over every action", async () => {
		const { store, container } = mount();
		await act(async () => void store.set(cmdUndo.atom, []));
		await act(async () => void store.set(shortcutSearchAtom, "J"));
		expect(listed(container, cmdSyncStart.description)).toBe(true);
		expect(listed(container, cmdSaveFile.description)).toBe(false);
		// Unbound actions are searched too, so they can be given a key.
		await act(
			async () => void store.set(shortcutSearchAtom, cmdUndo.description),
		);
		expect(listed(container, cmdUndo.description)).toBe(true);
		await act(async () => void store.set(shortcutSearchAtom, "ctrl+alt+q"));
		expect(container.textContent).toContain("keyboardView.searchResults");
	});
});
