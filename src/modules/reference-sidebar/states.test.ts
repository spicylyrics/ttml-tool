import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import {
	previewPanelWidthAtom,
	projectIdAtom,
	showPreviewPanelAtom,
} from "$/states/main";
import {
	applyPreviewPanelSwitchAtom,
	legacyPreviewPanelShownAtom,
	referenceSidebarEnabledAtom,
	referenceSidebarGeniusSongAtom,
	referenceSidebarOpenAtom,
	referenceSidebarProblemsAvailableAtom,
	referenceSidebarProjectKeyAtom,
	referenceSidebarStateAtom,
	referenceSidebarTabsAtom,
	referenceSidebarVisibleTabAtom,
	referenceSidebarWidthAtom,
	toggleReferenceSidebarTabAtom,
} from "./states";

describe("reference sidebar states", () => {
	it("is off by default", () => {
		expect(createStore().get(referenceSidebarEnabledAtom)).toBe(false);
	});

	it("hides the old preview panel only while the sidebar is on", () => {
		const store = createStore();
		store.set(showPreviewPanelAtom, true);
		expect(store.get(legacyPreviewPanelShownAtom)).toBe(true);
		store.set(referenceSidebarEnabledAtom, true);
		expect(store.get(legacyPreviewPanelShownAtom)).toBe(false);
		expect(store.get(showPreviewPanelAtom)).toBe(true);
	});

	it("keys folder projects by folder and others by project id", () => {
		const store = createStore();
		store.set(projectIdAtom, "abc");
		expect(store.get(referenceSidebarProjectKeyAtom)).toBe("id:abc");
		store.set(activeProjectDirAtom, "C:/Songs/Track");
		expect(store.get(referenceSidebarProjectKeyAtom)).toBe(
			"dir:C:/Songs/Track",
		);
	});

	it("remembers the tab per project", () => {
		const store = createStore();
		store.set(projectIdAtom, "one");
		store.set(toggleReferenceSidebarTabAtom, "genius");
		store.set(projectIdAtom, "two");
		store.set(toggleReferenceSidebarTabAtom, "preview");
		store.set(projectIdAtom, "one");
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("genius");
		store.set(projectIdAtom, "two");
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("preview");
	});

	it("collapses when the open tab is clicked again", () => {
		const store = createStore();
		store.set(toggleReferenceSidebarTabAtom, "genius");
		expect(store.get(referenceSidebarOpenAtom)).toBe(true);
		store.set(toggleReferenceSidebarTabAtom, "genius");
		expect(store.get(referenceSidebarOpenAtom)).toBe(false);
		store.set(toggleReferenceSidebarTabAtom, "preview");
		expect(store.get(referenceSidebarOpenAtom)).toBe(true);
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("preview");
	});

	it("starts at the old preview panel width and saves drags per project", () => {
		const store = createStore();
		store.set(previewPanelWidthAtom, 480);
		expect(store.get(referenceSidebarWidthAtom)).toBe(480);
		store.set(referenceSidebarWidthAtom, (width) => width - 80);
		expect(store.get(referenceSidebarWidthAtom)).toBe(400);
		expect(store.get(previewPanelWidthAtom)).toBe(480);
	});

	it("hides the Problems tab until the linter makes it available", () => {
		const store = createStore();
		expect(store.get(referenceSidebarTabsAtom)).toEqual(["preview", "genius"]);
		store.set(referenceSidebarStateAtom, { open: true, tab: "problems" });
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("preview");
		store.set(referenceSidebarProblemsAvailableAtom, true);
		expect(store.get(referenceSidebarTabsAtom)).toContain("problems");
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("problems");
	});

	it("follows the old Preview panel switch", () => {
		const store = createStore();
		store.set(applyPreviewPanelSwitchAtom, true);
		expect(store.get(referenceSidebarOpenAtom)).toBe(true);
		expect(store.get(referenceSidebarVisibleTabAtom)).toBe("preview");
		store.set(applyPreviewPanelSwitchAtom, false);
		expect(store.get(referenceSidebarOpenAtom)).toBe(false);

		store.set(toggleReferenceSidebarTabAtom, "genius");
		store.set(applyPreviewPanelSwitchAtom, false);
		expect(store.get(referenceSidebarOpenAtom)).toBe(true);
	});

	it("keeps the Genius song value stable across unrelated writes", () => {
		const store = createStore();
		const song = { id: 1, name: "A", artist: "B" };
		store.set(referenceSidebarStateAtom, { genius: song });
		const before = store.get(referenceSidebarGeniusSongAtom);
		store.set(referenceSidebarWidthAtom, 350);
		expect(store.get(referenceSidebarGeniusSongAtom)).toBe(before);
		expect(before).toEqual(song);
	});
});
