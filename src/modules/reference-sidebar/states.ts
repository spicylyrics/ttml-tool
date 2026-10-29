import { atom, type PrimitiveAtom, type SetStateAction } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import {
	previewPanelWidthAtom,
	projectIdAtom,
	showPreviewPanelAtom,
} from "$/states/main";
import {
	normalizeMemory,
	REFERENCE_SIDEBAR_TABS,
	type ReferenceGeniusSong,
	type ReferenceSidebarPatch,
	type ReferenceSidebarTab,
	readProjectState,
	resolveVisibleTab,
	writeProjectState,
} from "./project-memory";

/** Feature flag: the docked reference sidebar. Off by default. */
export const referenceSidebarEnabledAtom = atomWithStorage(
	"referenceSidebar.enabled",
	false,
	undefined,
	{ getOnInit: true },
);

/**
 * The old "Preview panel" setting, as App reads it: with the sidebar on, the
 * preview lives in the sidebar instead, so the old panel never renders.
 */
export const legacyPreviewPanelShownAtom = atom(
	(get) => get(showPreviewPanelAtom) && !get(referenceSidebarEnabledAtom),
);

/**
 * Extension point for the linter: set to true once the Problems tab has
 * something to show. Until then the tab is hidden and a saved "problems" tab
 * falls back to Preview.
 */
export const referenceSidebarProblemsAvailableAtom = atom(false);

export const referenceSidebarTabsAtom = atom<readonly ReferenceSidebarTab[]>(
	(get) => {
		const problems = get(referenceSidebarProblemsAvailableAtom);
		return REFERENCE_SIDEBAR_TABS.filter(
			(tab) => tab !== "problems" || problems,
		);
	},
);

const storedMemoryAtom = atomWithStorage<unknown>(
	"referenceSidebar.projects",
	{},
	undefined,
	{ getOnInit: true },
);

const memoryAtom = atom((get) => normalizeMemory(get(storedMemoryAtom)));

/**
 * Folder projects get a new project id each time they open, so their folder is
 * the stable key. Everything else uses the project id.
 */
export const referenceSidebarProjectKeyAtom = atom((get) => {
	const dir = get(activeProjectDirAtom);
	return dir ? `dir:${dir}` : `id:${get(projectIdAtom)}`;
});

/** This project's sidebar state. Writes take a partial patch. */
export const referenceSidebarStateAtom = atom(
	(get) =>
		readProjectState(get(memoryAtom), get(referenceSidebarProjectKeyAtom)),
	(get, set, patch: ReferenceSidebarPatch) => {
		set(
			storedMemoryAtom,
			writeProjectState(
				get(memoryAtom),
				get(referenceSidebarProjectKeyAtom),
				patch,
				Date.now(),
			),
		);
	},
);

export const referenceSidebarOpenAtom = selectAtom(
	referenceSidebarStateAtom,
	(state) => state.open,
);

export const referenceSidebarVisibleTabAtom = atom((get) =>
	resolveVisibleTab(
		get(referenceSidebarStateAtom).tab,
		get(referenceSidebarTabsAtom),
	),
);

export const referenceSidebarGeniusSongAtom = selectAtom(
	referenceSidebarStateAtom,
	(state): ReferenceGeniusSong | null => state.genius ?? null,
	(a, b) => a?.id === b?.id && a?.name === b?.name && a?.artist === b?.artist,
);

/** Width for `ResizablePanel`. New projects start at the old preview panel's width. */
export const referenceSidebarWidthAtom: PrimitiveAtom<number> = atom(
	(get) => get(referenceSidebarStateAtom).width ?? get(previewPanelWidthAtom),
	(get, set, update: SetStateAction<number>) => {
		const current = get(referenceSidebarWidthAtom);
		const width = typeof update === "function" ? update(current) : update;
		if (width !== current) set(referenceSidebarStateAtom, { width });
	},
);

/** Clicking a tab opens it; clicking the open tab collapses the sidebar. */
export const toggleReferenceSidebarTabAtom = atom(
	null,
	(get, set, tab: ReferenceSidebarTab) => {
		const open = get(referenceSidebarOpenAtom);
		if (open && get(referenceSidebarVisibleTabAtom) === tab) {
			set(referenceSidebarStateAtom, { open: false });
			return;
		}
		set(referenceSidebarStateAtom, { open: true, tab });
	},
);

/**
 * The old "Preview panel" switch (ribbon and Preferences) still writes
 * `showPreviewPanelAtom`. While the sidebar is on, a change there opens or
 * closes the sidebar's Preview tab instead of the old panel.
 */
export const applyPreviewPanelSwitchAtom = atom(
	null,
	(get, set, show: boolean) => {
		if (show) {
			set(referenceSidebarStateAtom, { open: true, tab: "preview" });
			return;
		}
		if (
			get(referenceSidebarOpenAtom) &&
			get(referenceSidebarVisibleTabAtom) === "preview"
		)
			set(referenceSidebarStateAtom, { open: false });
	},
);
