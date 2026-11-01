// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { produce } from "immer";
import { atom, createStore, Provider } from "jotai";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { lyricLinesAtom, ToolMode } from "$/states/main";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { LineWordRow } from "../lyric-line-view/line-word-row";
import { LyricWordViewEdit } from "./LyricWordViewEdit";
import { WordEditField } from "./WordEditField";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) => fallback ?? key,
	}),
}));
vi.mock("../lyric-line-menu", () => ({ LyricLineMenu: () => null }));
vi.mock("../lyric-word-menu", () => ({ LyricWordMenu: () => null }));
vi.mock("./LyricWordViewEditSpan", () => ({
	LyricWordViewEditSpan: ({
		children,
		onDoubleClick,
	}: {
		children: ReactNode;
		onDoubleClick: () => void;
	}) => (
		<span data-testid="word" onDoubleClick={onDoubleClick}>
			{children}
		</span>
	),
}));

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const values = ["word|reading", "word|", "|", "a|b|c"];

function mount(
	render: (
		store: ReturnType<typeof createStore>,
		line: TTMLLyric["lyricLines"][number],
	) => ReactNode,
	empty = false,
) {
	const store = createStore();
	const line = {
		...newLyricLine(),
		words: empty ? [] : [{ ...newLyricWord(), word: "original" }],
	};
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>{render(store, line)}</Theme>
			</Provider>,
		),
	);
	return {
		store,
		container,
		cleanup: () => {
			act(() => root.unmount());
			container.remove();
		},
	};
}

function enterValue(container: HTMLElement, value: string) {
	const input = container.querySelector("input");
	if (!input) throw new Error("Missing word input");
	// React's native input path covers typed text and text inserted by paste.
	act(() => {
		Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
	act(() =>
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Enter",
				code: "Enter",
				bubbles: true,
			}),
		),
	);
}

describe("literal pipes in former shortcut entry points", () => {
	it.each(values)("preserves %j in advanced word editing", (value) => {
		const view = mount((_store, line) => (
			<WordEditField
				wordAtom={atom(line.words[0])}
				fieldName="word"
				formatter={String}
				parser={String}
			/>
		));
		try {
			enterValue(view.container, value);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[0]).toEqual({
				...newLyricWord(),
				id: expect.any(String),
				word: value,
			});
		} finally {
			view.cleanup();
		}
	});

	it.each(values)("preserves %j in capsule word editing", (value) => {
		const view = mount((_store, line) => (
			<LyricWordViewEdit
				wordAtom={atom(line.words[0])}
				wordIndex={0}
				lineIndex={0}
				line={line}
			/>
		));
		try {
			act(() =>
				view.container
					.querySelector('[data-testid="word"]')
					?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
			);
			enterValue(view.container, value);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words[0]).toEqual({
				...newLyricWord(),
				id: expect.any(String),
				word: value,
			});
		} finally {
			view.cleanup();
		}
	});

	it.each(values)("preserves %j when inserting a word", (value) => {
		const view = mount(
			(store, line) => (
				<LineWordRow
					lineIndex={0}
					t={
						((key: string, fallback?: string) =>
							fallback ?? key) as ComponentProps<typeof LineWordRow>["t"]
					}
					line={line}
					words={[]}
					toolMode={ToolMode.Edit}
					editLyricLines={(recipe) =>
						store.set(
							lyricLinesAtom,
							produce(store.get(lyricLinesAtom), recipe),
						)
					}
					showTimestamps={false}
					store={store}
					wordsContainerRef={{ current: null }}
					showWordRomanizationInput={false}
					wordTexts={[]}
					editingRomanWordIndexAtom={atom<number | null>(null)}
					legacySpaceLabels={false}
					syncWordWrap={false}
					enableInsert={false}
				/>
			),
			true,
		);
		try {
			enterValue(view.container, value);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].words).toEqual([
				{ ...newLyricWord(), id: expect.any(String), word: value },
			]);
		} finally {
			view.cleanup();
		}
	});
});
