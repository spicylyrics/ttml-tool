// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { createStore, Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ribbonCustomizeEnabledAtom } from "$/components/RibbonBar/customize/states";
import { commandPaletteEnabledAtom } from "$/modules/command-palette/states";
import { editAsTextEnabledAtom } from "$/modules/edit-as-text/states";
import { keyboardViewEnabledAtom } from "$/modules/keyboard/flags";
import { lineSyncEnabledAtom } from "$/modules/line-sync/states";
import { logoColorEnabledAtom } from "$/modules/logo-color/states";
import { editModeToolsAtom } from "$/modules/lyric-editor/states/edit-mode-tools";
import { sectionEditingEnabledAtom } from "$/modules/lyric-editor/states/section-editing";
import { importSplitChoiceEnabledAtom } from "$/modules/lyrics-import/flags";
import { showPreviewTimingProblemsAtom } from "$/modules/preview-problems/states";
import { projectsHubEnabledAtom } from "$/modules/projects-hub/states";
import { referenceSidebarEnabledAtom } from "$/modules/reference-sidebar/states";
import { romanizationToolsFlagAtom } from "$/modules/romanization/states";
import { spectrogramFollowFeatureAtom } from "$/modules/spectrogram/states/follow-playhead";
import { spectrogramLanesEnabledAtom } from "$/modules/spectrogram/states/lanes.ts";
import { timeModeWordEditingEnabledAtom } from "$/modules/time-mode-editing/states";
import { transcriptionModeEnabledAtom } from "$/modules/transcription/states";
import { updatedToastEnabledAtom } from "$/modules/updated-toast/states";
import { showLineTranslationAtom } from "../states";
import { EXPERIMENTAL_FLAGS } from "./experimental";
import { GroupReset } from "./GroupReset";
import { GROUP_RESETS } from "./group-reset";
import { SHELL_PAGE_MAP } from "./page-map";
import { collectPageElements } from "./page-snapshot";
import { getShellPages } from "./pages";
import { type PageSnapshot, searchSettingsPages } from "./search";
import { preferencesShellEnabledAtom } from "./states";

// Node's own localStorage stub shadows jsdom's; use a plain in-memory one.
vi.hoisted(() => {
	const data = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => data.set(name, String(value)),
		removeItem: (name: string) => data.delete(name),
		clear: () => data.clear(),
	});
	// Radix ScrollArea (in a select) needs it; jsdom has none.
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Some settings modules open IndexedDB on import; jsdom has none.
vi.mock("idb", () => ({ openDB: () => new Promise(() => {}) }));
// The equalizer starts the audio engine (a Worker) on import. Not rendered here.
vi.mock("../modals/audio", () => ({ AudioSettingsTab: () => null }));

/** Every feature flag from the overnight PRs (#179-#206). */
const ALL_FLAGS = [
	sectionEditingEnabledAtom,
	spectrogramFollowFeatureAtom,
	transcriptionModeEnabledAtom,
	lineSyncEnabledAtom,
	romanizationToolsFlagAtom,
	keyboardViewEnabledAtom,
	editModeToolsAtom,
	projectsHubEnabledAtom,
	updatedToastEnabledAtom,
	logoColorEnabledAtom,
	timeModeWordEditingEnabledAtom,
	spectrogramLanesEnabledAtom,
	preferencesShellEnabledAtom,
	commandPaletteEnabledAtom,
	editAsTextEnabledAtom,
	showPreviewTimingProblemsAtom,
	importSplitChoiceEnabledAtom,
	referenceSidebarEnabledAtom,
	ribbonCustomizeEnabledAtom,
];

// Without an i18n instance, `t` returns the fallback text.
const t = ((key: string, fallback?: unknown) =>
	typeof fallback === "string" ? fallback : key) as unknown as TFunction;

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function render(node: ReactNode, store = createStore()) {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>{node}</Theme>
			</Provider>,
		),
	);
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	return container;
}

/** The pages that hold flag rows in the classic dialog, plus Experimental. */
const RENDERED = [
	"common",
	"editing",
	"syncing",
	"preview",
	"files",
	"audio",
	"keybinding",
	"experimental",
];

function snapshotPages(): Record<string, PageSnapshot> {
	const pages = getShellPages(t).filter((page) =>
		RENDERED.includes(page.value),
	);
	return Object.fromEntries(
		pages.map((page) => [
			page.value,
			collectPageElements(render(page.content)).snapshot,
		]),
	);
}

/** The first line of text in a flag's first card: the switch's title. */
function flagTitle(Row: (typeof EXPERIMENTAL_FLAGS)[number]["Row"]): string {
	const container = render(<Row />);
	const label = container.querySelector(".rt-Card label, .rt-Card .rt-Text");
	return label?.firstChild?.textContent?.trim() ?? "";
}

describe("Experimental page", () => {
	it("lists every feature flag exactly once", () => {
		const atoms = EXPERIMENTAL_FLAGS.map((flag) => flag.atom);
		expect(new Set(atoms).size).toBe(atoms.length);
		expect(new Set(atoms)).toEqual(new Set(ALL_FLAGS));
		const ids = EXPERIMENTAL_FLAGS.map((flag) => flag.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("groups flags under existing shell pages", () => {
		const pages = new Set<string>(SHELL_PAGE_MAP.map((page) => page.value));
		for (const flag of EXPERIMENTAL_FLAGS) {
			expect(pages.has(flag.area), flag.id).toBe(true);
		}
	});

	it("shows each flag's row on Experimental only, and search finds it there", () => {
		const snapshots = snapshotPages();
		const searchable = Object.keys(snapshots).map((value) => ({
			value,
			label: value,
			keywords: "",
		}));
		for (const flag of EXPERIMENTAL_FLAGS) {
			const title = flagTitle(flag.Row);
			expect(title, flag.id).not.toBe("");
			const holders = Object.entries(snapshots).flatMap(([page, snapshot]) =>
				snapshot.rows.filter((row) => row.text.includes(title)).map(() => page),
			);
			expect(holders, `${flag.id}: "${title}"`).toEqual(["experimental"]);
			const result = searchSettingsPages(searchable, snapshots, title).find(
				(page) => page.value === "experimental",
			);
			expect(result?.matchCount, flag.id).toBeGreaterThan(0);
		}
	});

	it("turns a group's flags off, but never the layout switch", () => {
		const store = createStore();
		store.set(lineSyncEnabledAtom, true);
		store.set(timeModeWordEditingEnabledAtom, true);
		store.set(commandPaletteEnabledAtom, true);
		store.set(preferencesShellEnabledAtom, true);
		const experimental = getShellPages(t).find(
			(page) => page.value === "experimental",
		);
		const container = render(experimental?.content, store);
		const button = (area: string) =>
			container.querySelector<HTMLButtonElement>(
				`[data-experimental-area="${area}"] [data-turn-all-off]`,
			);
		act(() => button("syncing")?.click());
		expect(store.get(lineSyncEnabledAtom)).toBe(false);
		expect(store.get(timeModeWordEditingEnabledAtom)).toBe(false);
		expect(store.get(commandPaletteEnabledAtom)).toBe(true);
		expect(button("syncing")?.disabled).toBe(true);
		act(() => button("common")?.click());
		expect(store.get(commandPaletteEnabledAtom)).toBe(false);
		expect(store.get(preferencesShellEnabledAtom)).toBe(true);
	});

	it("still shows the non-flag rows of a split page", () => {
		const snapshots = snapshotPages();
		const text = (page: string) => snapshots[page]?.text ?? "";
		expect(text("editing")).toContain("Show advanced ribbon controls");
		expect(text("editing")).not.toContain("Show timestamps");
		expect(text("syncing")).toContain("Show timestamps");
		expect(text("syncing")).toContain("Manual timestamp editing");
		expect(text("preview")).toContain("Smooth preview (every frame)");
		expect(text("preview")).not.toContain("Manual timestamp editing");
	});
});

describe("Reset to defaults", () => {
	it("asks first, lists the settings, then resets the group", () => {
		const store = createStore();
		store.set(showLineTranslationAtom, false);
		const settings = GROUP_RESETS.editing ?? [];
		render(<GroupReset settings={settings} groupLabel="Editing" />, store);
		const trigger =
			document.querySelector<HTMLButtonElement>("[data-reset-group]");
		act(() => trigger?.click());
		const dialog = document.querySelector('[role="alertdialog"]');
		// No i18n instance here, so the fallback isn't interpolated.
		expect(dialog?.textContent).toContain("Reset {group} settings?");
		expect(dialog?.textContent).toContain("Show translation line");
		expect(store.get(showLineTranslationAtom)).toBe(false);
		const confirm = [...(dialog?.querySelectorAll("button") ?? [])].find(
			(button) => button.textContent === "Reset",
		);
		act(() => confirm?.click());
		expect(store.get(showLineTranslationAtom)).toBe(true);
	});
});
