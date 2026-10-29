// @vitest-environment jsdom
import { enableMapSet } from "immer";
import { atom, createStore, Provider, useAtomValue } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { cmdClearWordTiming } from "$/modules/keyboard/commands";
import {
	enableManualTimestampEditAtom,
	showTimestampsAtom,
} from "$/modules/settings/states";
import {
	syncLevelModeAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync";
import {
	lyricLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { RESET_KEYBINDING } from "$/utils/keybindings";
import { SyncKeyBinding } from "../sync-keybinding";
import { LyricSyncWordView } from "./LyricSyncWordView";

enableMapSet();
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: {} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function mount(syncLevel: "word" | "line" = "word", mode = ToolMode.Sync) {
	const store = createStore();
	store.set(cmdClearWordTiming.atom, cmdClearWordTiming.defaultKeys);
	const words = ["hel", "lo", "there"].map((word, index) => ({
		...newLyricWord(),
		word,
		startTime: 1000 + index * 500,
		endTime: 1500 + index * 500,
	}));
	const line = { ...newLyricLine(), startTime: 1000, endTime: 2500, words };
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
	store.set(toolModeAtom, mode);
	store.set(syncLevelModeAtom, syncLevel);
	store.set(visualizeTimestampUpdateAtom, false);
	store.set(showTimestampsAtom, true);
	store.set(enableManualTimestampEditAtom, true);
	store.set(selectedWordsAtom, new Set([words[0].id]));
	const unsubscribe = store.sub(undoableLyricLinesAtom, () => {});
	const wordAtom = atom((get) => get(lyricLinesAtom).lyricLines[0].words[1]);
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	function Harness() {
		const currentLine = useAtomValue(lyricLinesAtom).lyricLines[0];
		const word = useAtomValue(wordAtom);
		return (
			<>
				<SyncKeyBinding />
				{
					<LyricSyncWordView
						syncId={word.id}
						wordAtom={wordAtom}
						line={currentLine}
						startTime={word.startTime}
						endTime={word.endTime}
						displayWord={word.word}
						isWordBlank={false}
						wordIndex={1}
						lineIndex={0}
						editableField="word"
					/>
				}
			</>
		);
	}
	act(() =>
		root.render(
			<Provider store={store}>
				<Harness />
			</Provider>,
		),
	);
	const target = container.firstElementChild;
	if (!target) throw new Error("Word view missing");
	return {
		store,
		words,
		line,
		container,
		target,
		cleanup: () => {
			act(() => root.unmount());
			unsubscribe();
			container.remove();
		},
	};
}

function pointerDown(
	target: Element,
	button: number,
	init: MouseEventInit = {},
	duringPress?: () => void,
) {
	const event = new MouseEvent("pointerdown", {
		button,
		bubbles: true,
		cancelable: true,
		...init,
	});
	act(() => {
		target.dispatchEvent(event);
	});
	act(() => duringPress?.());
	act(() => {
		// A removed word can still be released over; the window sees that.
		(target.isConnected ? target : window).dispatchEvent(
			new MouseEvent("pointerup", { button, bubbles: true, ...init }),
		);
	});
	return event;
}

function scrollPage() {
	window.dispatchEvent(new Event("scroll"));
}

describe("middle-click clear timing in the Time tab", () => {
	// Scroll times are module-wide; a moving fake clock keeps one test's scroll
	// from blocking the next test's click.
	beforeAll(() => {
		vi.useFakeTimers({ toFake: ["performance", "setTimeout", "clearTimeout"] });
	});
	afterEach(() => {
		vi.advanceTimersByTime(1000);
	});
	afterAll(() => {
		vi.useRealTimers();
	});

	it("can be unbound and restored using Reset default", () => {
		const view = mount();
		try {
			act(() => {
				void view.store.set(cmdClearWordTiming.atom, []);
			});
			pointerDown(view.target, 1);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
			act(() => {
				void view.store.set(cmdClearWordTiming.atom, RESET_KEYBINDING);
			});
			pointerDown(view.target, 1);
			expect(
				view.store.get(lyricLinesAtom).lyricLines[0].words[1],
			).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});

	it("can be rebound to a keyboard shortcut that clears the selected span", () => {
		const view = mount();
		try {
			act(() => {
				void view.store.set(cmdClearWordTiming.atom, ["KeyX"]);
			});
			act(() => {
				window.dispatchEvent(
					new KeyboardEvent("keydown", {
						code: "KeyX",
						bubbles: true,
						cancelable: true,
					}),
				);
				window.dispatchEvent(
					new KeyboardEvent("keyup", { code: "KeyX", bubbles: true }),
				);
			});
			const updated = view.store.get(lyricLinesAtom).lyricLines[0];
			expect(updated.words[0]).toMatchObject({ startTime: 0, endTime: 0 });
			expect(updated.words[1]).toBe(view.words[1]);
			pointerDown(view.target, 1);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
		} finally {
			view.cleanup();
		}
	});

	it("can be rebound to a modified mouse button", () => {
		const view = mount();
		try {
			act(() => {
				void view.store.set(cmdClearWordTiming.atom, ["Shift", "MouseRight"]);
			});
			pointerDown(view.target, 1);
			pointerDown(view.target, 2);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
			pointerDown(view.target, 2, { shiftKey: true });
			expect(
				view.store.get(lyricLinesAtom).lyricLines[0].words[1],
			).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});

	it.each([
		"word",
		"line",
	] as const)("clears only the clicked span, even in %s mode, and supports undo", (level) => {
		const view = mount(level);
		try {
			pointerDown(view.target, 1);
			const updated = view.store.get(lyricLinesAtom).lyricLines[0];
			expect(updated.words[1]).toMatchObject({
				word: "lo",
				startTime: 0,
				endTime: 0,
			});
			expect(updated.words[0]).toBe(view.words[0]);
			expect(updated.words[2]).toBe(view.words[2]);
			expect(updated).toMatchObject({ startTime: 1000, endTime: 2500 });
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.words[0].id]),
			);
			expect(view.container.textContent).toContain("--:--.---");
			const auxiliary = new MouseEvent("auxclick", {
				button: 1,
				bubbles: true,
				cancelable: true,
			});
			act(() => {
				view.target.dispatchEvent(auxiliary);
			});
			expect(auxiliary.defaultPrevented).toBe(true);
			act(() => view.store.set(undoLyricLinesAtom));
			expect(view.store.get(lyricLinesAtom).lyricLines[0]).toBe(view.line);
		} finally {
			view.cleanup();
		}
	});

	it.each([
		0, 2,
	])("does not clear timestamps with mouse button %s", (button) => {
		const view = mount();
		try {
			pointerDown(view.target, button);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
		} finally {
			view.cleanup();
		}
	});

	it("does not clear timing outside the Time tab", () => {
		const view = mount("word", ToolMode.Edit);
		try {
			pointerDown(view.target, 1);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
		} finally {
			view.cleanup();
		}
	});

	it.each([
		[
			"the pointer drags (middle-button scrolling)",
			{},
			() =>
				window.dispatchEvent(
					new MouseEvent("pointermove", { clientX: 40, clientY: 40 }),
				),
		],
		["the list scrolls while the button is held", {}, scrollPage],
		["the button is held down", {}, () => vi.advanceTimersByTime(700)],
	] as const)("does not clear when %s", (_case, init, duringPress) => {
		const view = mount();
		try {
			pointerDown(view.target, 1, init, duringPress);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
		} finally {
			view.cleanup();
		}
	});

	it("does not clear on the click that stops a scroll, but does once scrolling has settled", () => {
		const view = mount();
		try {
			act(scrollPage);
			pointerDown(view.target, 1);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
			vi.advanceTimersByTime(400);
			pointerDown(view.target, 1);
			expect(
				view.store.get(lyricLinesAtom).lyricLines[0].words[1],
			).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});

	it.each([
		[
			"the Time tab is left",
			(view: ReturnType<typeof mount>) =>
				view.store.set(toolModeAtom, ToolMode.Edit),
		],
		["the word unmounts", (view: ReturnType<typeof mount>) => view.cleanup()],
		["the window loses focus", () => window.dispatchEvent(new Event("blur"))],
	] as const)("does not clear when %s before the release", (_case, interrupt) => {
		const view = mount();
		try {
			pointerDown(view.target, 1, {}, () => interrupt(view));
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[1]).toBe(
				view.words[1],
			);
		} finally {
			view.cleanup();
		}
	});

	it("also works when clicking a timestamp rather than the word text", () => {
		const view = mount();
		try {
			const timestamp = view.target.firstElementChild;
			if (!timestamp) throw new Error("Timestamp missing");
			pointerDown(timestamp, 1);
			expect(
				view.store.get(lyricLinesAtom).lyricLines[0].words[1],
			).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});
});
