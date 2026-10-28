// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { commandPaletteEnabledAtom } from "$/modules/command-palette/states";
import { pasteRomanizationDialogAtom } from "$/modules/romanization/states";
import {
	changelogDialogAtom,
	replaceRomanizationDialogAtom,
	settingsDialogAtom,
	timeShiftDialogAtom,
} from "$/states/dialogs";
import { Dialogs } from "./index";

const loaded = vi.hoisted(() => {
	const data = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => data.set(name, String(value)),
		removeItem: (name: string) => data.delete(name),
		clear: () => data.clear(),
	});
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	// The audio engine starts a Worker when the project modules load.
	vi.stubGlobal(
		"Worker",
		class {
			onmessage = null;
			postMessage() {}
			terminate() {}
			addEventListener() {}
			removeEventListener() {}
		},
	);
	return new Set<string>();
});
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("idb", () => ({ openDB: () => new Promise(() => {}) }));
// The equalizer starts the audio engine (a Worker) on import.
vi.mock("$/modules/settings/modals/audio", () => ({
	AudioSettingsTab: () => null,
}));
// Record when a dialog's module is first imported.
vi.mock("./changelog.tsx", async (importOriginal) => {
	loaded.add("changelog");
	return importOriginal();
});
vi.mock(
	"$/modules/lyric-editor/tools/TimeShift.tsx",
	async (importOriginal) => {
		loaded.add("time-shift");
		return importOriginal();
	},
);

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function renderDialogs(store = createStore()) {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					<Dialogs />
				</Theme>
			</Provider>,
		),
	);
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	return store;
}

const openDialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

async function findDialog() {
	await vi.waitFor(
		() => {
			if (!openDialog()) throw new Error("no dialog yet");
		},
		{ timeout: 5000 },
	);
	return openDialog() as HTMLElement;
}

describe("on-demand dialogs", () => {
	it("doesn't import a dialog's module until it first opens", async () => {
		const store = renderDialogs();
		expect(openDialog()).toBeNull();
		expect(loaded.has("changelog")).toBe(false);
		expect(loaded.has("time-shift")).toBe(false);

		await act(async () => store.set(changelogDialogAtom, true));
		await findDialog();
		expect(loaded.has("changelog")).toBe(true);
		expect(loaded.has("time-shift")).toBe(false);
	});

	it.each([
		["Time shift", timeShiftDialogAtom],
		["Paste romanization", pasteRomanizationDialogAtom],
		["Preferences", settingsDialogAtom],
	] as const)("%s still opens from its atom", async (_name, dialogAtom) => {
		const store = renderDialogs();
		expect(openDialog()).toBeNull();
		await act(async () => store.set(dialogAtom, true));
		expect(await findDialog()).toBeTruthy();
	});

	it("opens object-shaped dialog atoms on their open field", async () => {
		const store = renderDialogs();
		await act(async () =>
			store.set(replaceRomanizationDialogAtom, {
				open: false,
				lineIndex: 0,
				wordIndex: 0,
			}),
		);
		expect(openDialog()).toBeNull();
		await act(async () =>
			store.set(replaceRomanizationDialogAtom, {
				open: true,
				lineIndex: 0,
				wordIndex: 0,
			}),
		);
		expect(await findDialog()).toBeTruthy();
	});

	it("keeps a dialog mounted after it closes", async () => {
		const store = renderDialogs();
		await act(async () => store.set(changelogDialogAtom, true));
		await findDialog();
		await act(async () => store.set(changelogDialogAtom, false));
		await vi.waitFor(() => expect(openDialog()).toBeNull());
		await act(async () => store.set(changelogDialogAtom, true));
		// Mounted already, so it opens in the same commit with no fetch.
		expect(openDialog()).toBeTruthy();
	});

	it("opens the command palette with Ctrl+K before its chunk loads", async () => {
		const store = createStore();
		store.set(commandPaletteEnabledAtom, true);
		renderDialogs(store);
		expect(openDialog()).toBeNull();
		const key = (type: "keydown" | "keyup", code: string) =>
			window.dispatchEvent(
				new KeyboardEvent(type, { code, ctrlKey: true, bubbles: true }),
			);
		await act(async () => {
			key("keydown", "ControlLeft");
			key("keydown", "KeyK");
			key("keyup", "KeyK");
			key("keyup", "ControlLeft");
		});
		expect(await findDialog()).toBeTruthy();
	});
});
