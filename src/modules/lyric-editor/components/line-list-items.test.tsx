// @vitest-environment jsdom
import { atom, createStore, Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { lyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { LyricLinesView } from "./index";

// Draws every item, so the test sees the DOM the real list would walk.
vi.mock("react-viewport-list", () => ({
	ViewportList: ({
		items,
		children,
	}: {
		items: unknown[];
		children: (item: unknown, index: number) => ReactNode;
	}) => (
		<div data-testid="list">{items.map((item, i) => children(item, i))}</div>
	),
}));
// A line that draws more than one root, as one with a section divider does.
vi.mock("./lyric-line-view", () => ({
	LyricLineView: () => (
		<>
			<div data-divider="" />
			<div data-row="" />
		</>
	),
}));
vi.mock("$/components/TopMenu/useTopMenuActions", () => ({
	useTopMenuActions: () => ({ onOpenFile: () => {} }),
}));
vi.mock("./ApplySectionTimingsDialog.tsx", () => ({
	ApplySectionTimingsDialog: () => null,
}));
vi.mock("./lyric-lines-view/use-line-drag-drop.ts", () => ({
	useLineDragDrop: () => {},
}));
vi.mock("./lyric-lines-view/use-line-list-scrolling.ts", () => ({
	useLineListScrolling: () => ({
		scrollRafRef: { current: null },
		isProgrammaticScrollRef: { current: false },
		lastProgrammaticScrollTimeRef: { current: 0 },
		cancelScrollAnimation: () => {},
		updateEditorAnchor: () => {},
		scrollToLineIndex: () => {},
		restoreEditorAnchorOnListReady: () => {},
	}),
}));
vi.mock("./lyric-lines-view/use-line-list-auto-scroll.ts", () => ({
	useLineListAutoScroll: () => ({ handleLocate: () => {} }),
}));
vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (_: string, fallback: string) => fallback }),
}));
vi.mock("@radix-ui/themes", () => {
	const Pass = ({ children }: { children?: ReactNode }) => (
		<div>{children}</div>
	);
	return { Box: Pass, Button: Pass, Flex: Pass, Grid: Pass, Text: Pass };
});
// The real states drag in the whole app; the list only needs these few.
vi.mock("$/modules/onboarding/states", () => ({
	guidePanelOpenAtom: atom(false),
	guideStepAtom: atom(0),
	guideWelcomeOpenAtom: atom(false),
}));

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("LyricLinesView list items", () => {
	const host = document.createElement("div");
	const root = createRoot(host);
	afterEach(() => act(() => root.unmount()));

	it("gives the list one child per line, even when a line draws several", () => {
		const store = createStore();
		const lyricLines = [0, 1, 2].map(() => ({
			...newLyricLine(),
			words: [{ ...newLyricWord(), word: "word" }],
		}));
		store.set(lyricLinesAtom, { metadata: [], lyricLines });

		act(() =>
			root.render(
				<Provider store={store}>
					<LyricLinesView />
				</Provider>,
			),
		);

		const list = host.querySelector('[data-testid="list"]');
		expect(list?.children.length).toBe(lyricLines.length);
		expect(host.querySelectorAll("[data-row]").length).toBe(lyricLines.length);
	});
});
