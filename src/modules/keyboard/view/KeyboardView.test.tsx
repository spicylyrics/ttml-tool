// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keyBindingListAtom } from "../binding-list";
import { cmdSyncStart } from "../commands";
import { keyboardViewEnabledAtom } from "../flags";
import { KeyboardViewSection } from "./KeyboardViewSection";

// Node's own localStorage stub shadows jsdom's; use a plain in-memory one.
vi.hoisted(() => {
	const data = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => data.set(name, String(value)),
		removeItem: (name: string) => data.delete(name),
		clear: () => data.clear(),
	});
});
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup = () => {};
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

function mount(enabled: boolean) {
	const store = createStore();
	store.set(keyboardViewEnabledAtom, enabled);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					<KeyboardViewSection />
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

const cap = (container: HTMLElement, code: string) =>
	container.querySelector<HTMLButtonElement>(
		`button[data-code="${code}"]:not([aria-hidden])`,
	);

function buttonWithText(container: HTMLElement, text: string) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.textContent === text,
	);
}

function key(type: "keydown" | "keyup", code: string) {
	act(() => {
		window.dispatchEvent(
			new KeyboardEvent(type, { code, bubbles: true, cancelable: true }),
		);
	});
}

describe("keyboard view", () => {
	it("shows only the switch while the flag is off", () => {
		const { container } = mount(false);
		expect(container.querySelector('[role="switch"]')).not.toBeNull();
		expect(cap(container, "KeyF")).toBeNull();
	});

	it("colors bound keys by category and leaves free keys blank", () => {
		const { container } = mount(true);
		expect(cap(container, "KeyF")?.dataset.category).toBe("sync");
		expect(cap(container, "Space")?.dataset.category).toBe("playback");
		expect(cap(container, "KeyD")?.dataset.category).toBe("navigation");
		expect(cap(container, "KeyZ")?.dataset.category).toBeUndefined();
	});

	it("switches to the Shift layer from the Shift cap", () => {
		const { container } = mount(true);
		const shift = container.querySelector<HTMLButtonElement>(
			'button[data-code="Shift"]',
		);
		act(() => shift?.click());
		expect(shift?.getAttribute("aria-pressed")).toBe("true");
		// Shift+E opens the auto segment dialog; plain E is quick auto segment.
		expect(cap(container, "KeyE")?.dataset.category).toBe("edit");
		expect(cap(container, "KeyG")?.dataset.category).toBeUndefined();
	});

	it("adds a second key from the side panel, and it shows on the board", async () => {
		const { store, container } = mount(true);
		act(() => cap(container, "KeyF")?.click());
		expect(cap(container, "KeyF")?.dataset.selected).toBe("true");
		act(() => buttonWithText(container, "keyboardView.addKey")?.click());
		key("keydown", "KeyZ");
		key("keyup", "KeyZ");
		await act(async () => {});
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([
			["KeyF"],
			["KeyZ"],
		]);
		expect(cap(container, "KeyZ")?.dataset.category).toBe("sync");
	});

	it("stops recording when another key is picked mid-recording", async () => {
		const { store, container } = mount(true);
		act(() => cap(container, "KeyF")?.click());
		act(() => buttonWithText(container, "keyboardView.addKey")?.click());
		act(() => cap(container, "KeyG")?.click());
		key("keydown", "KeyX");
		key("keyup", "KeyX");
		await act(async () => {});
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([["KeyF"]]);
		expect(cap(container, "KeyX")?.dataset.category).toBeUndefined();
	});

	it("refuses a key the action already has", async () => {
		const { store, container } = mount(true);
		act(() => cap(container, "KeyF")?.click());
		act(() => buttonWithText(container, "keyboardView.addKey")?.click());
		key("keydown", "KeyF");
		key("keyup", "KeyF");
		await act(async () => {});
		expect(store.get(keyBindingListAtom(cmdSyncStart))).toEqual([["KeyF"]]);
		expect(container.textContent).toContain("keyboardView.duplicateKey");
	});

	it("lights up the keys of matching actions while searching", () => {
		const { container } = mount(true);
		const search = container.querySelector<HTMLInputElement>(
			'input[aria-label="keyboardView.search"]',
		);
		expect(search).not.toBeNull();
		// Without loaded translations, names are their keys; "syncStart" is unique.
		act(() => {
			const setValue = Object.getOwnPropertyDescriptor(
				HTMLInputElement.prototype,
				"value",
			)?.set;
			setValue?.call(search, "syncStart");
			search?.dispatchEvent(new Event("input", { bubbles: true }));
		});
		expect(cap(container, "KeyF")?.dataset.match).toBe("true");
		expect(cap(container, "KeyG")?.dataset.match).toBe("false");
	});
});
