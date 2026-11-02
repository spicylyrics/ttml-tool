// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { urbanDictionaryDialogAtom } from "$/states/urban-dictionary";
import { UrbanDictionaryDialog } from "./UrbanDictionaryDialog";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

const cleanups: (() => void)[] = [];
beforeEach(() => {
	// Never resolves, so the dialog stays on its loading state.
	vi.stubGlobal(
		"fetch",
		vi.fn(() => new Promise(() => {})),
	);
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.unstubAllGlobals();
});

function setup() {
	const store = createStore();
	const opener = document.createElement("button");
	document.body.appendChild(opener);
	opener.focus();
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					<UrbanDictionaryDialog />
				</Theme>
			</Provider>,
		),
	);
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
		opener.remove();
	});
	act(() => store.set(urbanDictionaryDialogAtom, { open: true, word: "yeet" }));
	return { store, opener };
}

function pressEscape(init: KeyboardEventInit = {}) {
	act(() => {
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true, ...init }),
		);
	});
}

describe("UrbanDictionaryDialog", () => {
	it("focuses close, closes on Escape and gives focus back", () => {
		const { store, opener } = setup();
		expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
		pressEscape();
		expect(store.get(urbanDictionaryDialogAtom).open).toBe(false);
		expect(document.activeElement).toBe(opener);
	});

	it("ignores Escape while composing text", () => {
		const { store } = setup();
		pressEscape({ isComposing: true });
		expect(store.get(urbanDictionaryDialogAtom).open).toBe(true);
	});

	it("leaves Escape to an open menu or popover", () => {
		const { store } = setup();
		const popper = document.createElement("div");
		popper.setAttribute("data-radix-popper-content-wrapper", "");
		document.body.appendChild(popper);
		pressEscape();
		popper.remove();
		expect(store.get(urbanDictionaryDialogAtom).open).toBe(true);
	});
});
