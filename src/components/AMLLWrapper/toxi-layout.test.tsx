// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testAudio = vi.hoisted(() => ({ activeIds: [] as string[] }));

vi.mock("@applemusic-like-lyrics/react", () => ({
	BackgroundRender: () => null,
	MeshGradientRenderer: class {},
}));
vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: { musicPlaying: false, seekMusic: vi.fn() },
}));
vi.mock("$/modules/audio/states/index.ts", async () => {
	const { atom } = await import("jotai");
	return {
		activeLineIdsAtom: atom(() => testAudio.activeIds),
		audioPlayingAtom: atom(false),
		currentTimeAtom: atom(0),
	};
});
vi.mock("$/modules/playback-clock", () => ({
	playbackClock: { getSnapshot: () => 0, subscribe: () => () => {} },
}));
vi.mock("$/modules/playback-clock/use-preview-scroll", () => ({
	usePreviewScroll: () => {},
}));
vi.mock("$/modules/settings/modals/customBackground", async () => {
	const { atom } = await import("jotai");
	return { customBackgroundImageAtom: atom(null) };
});
vi.mock("$/components/PreviewModeSwitcher/states", async () => {
	const { lyricLinesAtom } = await import("$/states/main");
	return { timedPreviewLyricsAtom: lyricLinesAtom };
});

import { createStore, Provider } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { AMLLWrapper } from ".";
import { toxiTightLayoutAtom } from "./toxi-layout-states";

const css = readFileSync(
	"src/components/AMLLWrapper/index.module.css",
	"utf8",
).replace(/\r\n/g, "\n");

function lyricsWithBackground() {
	const line = (id: string, text: string, isBG = false) => ({
		...newLyricLine(),
		id,
		isBG,
		startTime: 1000,
		endTime: 2000,
		words: [{ ...newLyricWord(), word: text, startTime: 1000, endTime: 2000 }],
	});
	return {
		lyricLines: [line("main", "Hello"), line("bg", "(hello)", true)],
		metadata: [],
	};
}

async function renderPreview(
	variant: "standard" | "toxi",
	tight: boolean,
	activeIds: string[] = [],
) {
	testAudio.activeIds = activeIds;
	const store = createStore();
	store.set(lyricLinesAtom, lyricsWithBackground());
	const container = document.createElement("div");
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<Provider store={store}>
				<AMLLWrapper variant={variant} />
			</Provider>,
		),
	);
	// Set after mount: atomWithStorage reloads from storage when it mounts.
	await act(async () => store.set(toxiTightLayoutAtom, tight));
	const wrapper = container.firstElementChild as HTMLElement;
	return { store, root, wrapper };
}

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
	vi.unstubAllGlobals();
	testAudio.activeIds = [];
});

describe("Toxi tight layout flag", () => {
	it("is off by default", async () => {
		expect(createStore().get(toxiTightLayoutAtom)).toBe(false);
	});

	it("keeps the classic Toxi layout when the flag is off", async () => {
		const { root, wrapper } = await renderPreview("toxi", false);
		expect(wrapper.dataset.toxiLayout).toBe("classic");
		expect(wrapper.className).toContain("isToxi");
		expect(wrapper.className).not.toContain("isToxiTight");
		act(() => root.unmount());
	});

	it("switches the layout class when the flag changes", async () => {
		const { store, root, wrapper } = await renderPreview("toxi", false);
		await act(async () => store.set(toxiTightLayoutAtom, true));
		expect(wrapper.dataset.toxiLayout).toBe("tight");
		expect(wrapper.className).toContain("isToxiTight");
		await act(async () => store.set(toxiTightLayoutAtom, false));
		expect(wrapper.className).not.toContain("isToxiTight");
		act(() => root.unmount());
	});

	it("never applies to the Standard preview", async () => {
		const { root, wrapper } = await renderPreview("standard", true);
		expect(wrapper.dataset.toxiLayout).toBeUndefined();
		expect(wrapper.className).not.toContain("isToxiTight");
		act(() => root.unmount());
	});

	it.each([
		["static", []],
		["active", ["main"]],
	])("renders %s background lines inside the tight layout", async (_state, ids) => {
		const { root, wrapper } = await renderPreview("toxi", true, ids);
		const bgLines = wrapper.querySelectorAll('[class*="lineBG"]');
		expect(bgLines).toHaveLength(1);
		expect(bgLines[0].textContent).toBe("(hello)");
		expect(bgLines[0].closest('[data-toxi-layout="tight"]')).toBe(wrapper);
		act(() => root.unmount());
	});

	it("gives background lines their own size, weight, ink and indent", () => {
		const rule = (selector: string) => {
			const start = css.indexOf(`${selector} {`);
			expect(start, selector).toBeGreaterThan(-1);
			return css.slice(start, css.indexOf("}", start));
		};
		// Four classes plus !important, so it beats `.isToxi .lineBG .word`.
		const bgWords = rule(
			".isToxi.isToxiTight .lineBG .wordStatic,\n.isToxi.isToxiTight .lineBG .word",
		);
		expect(bgWords).toMatch(/font-size: [\d.]+rem !important/);
		expect(bgWords).toContain("font-weight: 600");
		expect(bgWords).toContain("opacity: 1");
		const bgLine = rule(".isToxi.isToxiTight .lineBG");
		expect(bgLine).toContain("padding-inline-start");
		expect(bgLine).toContain("font-style: normal");
		// Nothing in the tight block animates.
		const tightBlock = css.slice(css.indexOf(".isToxi.isToxiTight {"));
		expect(tightBlock).not.toMatch(/transition|animation|filter/);
	});
});
