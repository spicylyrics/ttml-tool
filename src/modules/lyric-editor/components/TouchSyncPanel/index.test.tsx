// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	keyMoveNextWordAtom,
	keyMovePrevWordAtom,
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings";
import { registerKeyBindingAtom } from "$/utils/keybindings";
import { TouchSyncPanel } from ".";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

const actions = [
	keyMovePrevWordAtom,
	keyMoveNextWordAtom,
	keySyncStartAtom,
	keySyncNextAtom,
	keySyncEndAtom,
];

function mount() {
	const store = createStore();
	const calls = actions.map((action) => {
		const callback = vi.fn();
		cleanups.push(registerKeyBindingAtom(action, [], callback));
		return callback;
	});
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					<TouchSyncPanel />
				</Theme>
			</Provider>,
		),
	);
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	const buttons = [...container.querySelectorAll("button")];
	return { buttons, calls };
}

function pointer(
	type: string,
	init: { pointerType: string; isPrimary?: boolean; button?: number },
) {
	const options = {
		bubbles: true,
		cancelable: true,
		button: init.button ?? 0,
	};
	const evt =
		typeof PointerEvent === "function"
			? new PointerEvent(type, { ...options, ...init })
			: new MouseEvent(type, options);
	if (typeof PointerEvent !== "function") {
		Object.defineProperty(evt, "pointerType", { value: init.pointerType });
		Object.defineProperty(evt, "isPrimary", { value: init.isPrimary ?? true });
	}
	return evt;
}

function fire(target: Element, evt: Event) {
	act(() => {
		target.dispatchEvent(evt);
	});
	return evt;
}

function mouse(type: string) {
	return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
}

function touch(type: string) {
	return new Event(type, { bubbles: true, cancelable: true });
}

describe("TouchSyncPanel", () => {
	it("fires once per pointerdown and cancels the default action", () => {
		const { buttons, calls } = mount();
		expect(buttons).toHaveLength(5);
		const down = fire(
			buttons[3],
			pointer("pointerdown", { pointerType: "mouse" }),
		);
		expect(calls[3]).toHaveBeenCalledTimes(1);
		expect(down.defaultPrevented).toBe(true);
	});

	it("fires once for a mouse click sequence", () => {
		const { buttons, calls } = mount();
		const button = buttons[2];
		fire(button, pointer("pointerdown", { pointerType: "mouse" }));
		fire(button, mouse("mousedown"));
		fire(button, pointer("pointerup", { pointerType: "mouse" }));
		fire(button, mouse("mouseup"));
		fire(button, mouse("click"));
		expect(calls[2]).toHaveBeenCalledTimes(1);
	});

	it("fires once when a tap is followed by synthesized mouse events", () => {
		const { buttons, calls } = mount();
		const button = buttons[3];
		fire(button, pointer("pointerdown", { pointerType: "touch" }));
		fire(button, touch("touchstart"));
		fire(button, pointer("pointerup", { pointerType: "touch" }));
		fire(button, touch("touchend"));
		fire(button, mouse("mousedown"));
		fire(button, mouse("mouseup"));
		fire(button, mouse("click"));
		expect(calls[3]).toHaveBeenCalledTimes(1);
	});

	it("lands every rapid alternating tap, including a second finger", () => {
		const { buttons, calls } = mount();
		for (let i = 0; i < 10; i++) {
			const index = i % 2 === 0 ? 2 : 3;
			// Two thumbs overlap, so every other finger is not the primary pointer.
			fire(
				buttons[index],
				pointer("pointerdown", {
					pointerType: "touch",
					isPrimary: i % 2 === 0,
				}),
			);
			fire(buttons[index], touch("touchstart"));
		}
		expect(calls[2]).toHaveBeenCalledTimes(5);
		expect(calls[3]).toHaveBeenCalledTimes(5);
	});

	it("ignores secondary mouse buttons", () => {
		const { buttons, calls } = mount();
		fire(
			buttons[4],
			pointer("pointerdown", { pointerType: "mouse", button: 2 }),
		);
		expect(calls[4]).not.toHaveBeenCalled();
	});
});
