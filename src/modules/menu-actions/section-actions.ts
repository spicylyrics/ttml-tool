import { atom, type createStore } from "jotai";
import { withImmer } from "jotai-immer";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { t as key } from "$/modules/keyboard/i18n-helper";
import {
	applyTimingsSectionIdAtom,
	editingSectionIdAtom,
} from "$/modules/lyric-editor/states/sections";
import { shiftSectionToTime } from "$/modules/lyric-editor/utils/genius-sections";
import { startSectionAt } from "$/modules/lyric-editor/utils/section-editing";
import {
	getSectionBoundsById,
	mergeSectionWithAdjacent,
	removeSectionMetadata,
} from "$/modules/lyric-editor/utils/section-system";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main.ts";
import { defineAction, type MenuAction, SELECTION_MODES } from "./actions";

type Store = ReturnType<typeof createStore>;

const lyricLinesImmerAtom = withImmer(lyricLinesAtom);

/**
 * The first selected line and its section. The divider's tools act on one
 * section, so from the palette or a shortcut that's the section the
 * selection starts in.
 */
const selectedSectionAtom = atom((get) => {
	const selected = get(selectedLinesAtom);
	const lyrics = get(lyricLinesAtom);
	const lineIndex = lyrics.lyricLines.findIndex((line) =>
		selected.has(line.id),
	);
	if (lineIndex === -1) return undefined;
	const sectionId = lyrics.lyricLines[lineIndex].sectionId;
	const section = sectionId
		? lyrics.sections?.find((item) => item.id === sectionId)
		: undefined;
	const bounds = section
		? getSectionBoundsById(lyrics.lyricLines, section.id)
		: undefined;
	return {
		lineIndex,
		section,
		startsSection: bounds?.start === lineIndex,
		hasPrevious: !!bounds && !!lyrics.lyricLines[bounds.start - 1]?.sectionId,
	};
});

const hasSectionAtom = atom((get) => !!get(selectedSectionAtom)?.section);
const canStartSectionAtom = atom((get) => {
	const target = get(selectedSectionAtom);
	return !!target && !target.startsSection;
});
const canMergePreviousAtom = atom(
	(get) => !!get(selectedSectionAtom)?.hasPrevious,
);

const selectedSectionId = (store: Store) =>
	store.get(selectedSectionAtom)?.section?.id;

export const SECTION_ACTIONS = {
	sectionRename: defineAction(
		"sectionRename",
		"Edit",
		[key("settingsDialog.keybindings.sectionRename"), "Section - Rename"],
		{
			modes: SELECTION_MODES,
			enabledAtom: hasSectionAtom,
			run: ({ store }) => {
				const id = selectedSectionId(store);
				if (id) store.set(editingSectionIdAtom, id);
			},
		},
	),
	sectionStartHere: defineAction(
		"sectionStartHere",
		"Edit",
		[
			key("settingsDialog.keybindings.sectionStartHere"),
			"Section - Start section here",
		],
		{
			modes: ["edit"],
			enabledAtom: canStartSectionAtom,
			run: ({ store }) => {
				const target = store.get(selectedSectionAtom);
				if (!target || target.startsSection) return;
				let createdId: string | undefined;
				store.set(lyricLinesImmerAtom, (draft) => {
					createdId = startSectionAt(
						draft,
						target.lineIndex,
						target.section?.category ?? "verse",
					)?.id;
				});
				if (createdId) store.set(editingSectionIdAtom, createdId);
			},
		},
	),
	// Timing tools, so Time mode only, like the divider's buttons.
	sectionApplyTimings: defineAction(
		"sectionApplyTimings",
		"Edit",
		[
			key("settingsDialog.keybindings.sectionApplyTimings"),
			"Section - Apply timings from...",
		],
		{
			modes: ["sync"],
			enabledAtom: hasSectionAtom,
			run: ({ store }) => {
				const id = selectedSectionId(store);
				if (id) store.set(applyTimingsSectionIdAtom, id);
			},
		},
	),
	sectionSnapToPlayhead: defineAction(
		"sectionSnapToPlayhead",
		"Edit",
		[
			key("settingsDialog.keybindings.sectionSnapToPlayhead"),
			"Section - Snap to playhead",
		],
		{
			modes: ["sync"],
			enabledAtom: hasSectionAtom,
			run: ({ store }) => {
				const id = selectedSectionId(store);
				if (!id) return;
				const currentTime = store.get(currentTimeAtom);
				store.set(lyricLinesImmerAtom, (draft) => {
					const bounds = getSectionBoundsById(draft.lyricLines, id);
					if (bounds)
						shiftSectionToTime(draft.lyricLines, bounds.start, currentTime);
				});
			},
		},
	),
	sectionMergePrevious: defineAction(
		"sectionMergePrevious",
		"Edit",
		[
			key("settingsDialog.keybindings.sectionMergePrevious"),
			"Section - Merge with previous",
		],
		{
			modes: ["edit"],
			enabledAtom: canMergePreviousAtom,
			run: ({ store }) => {
				const id = selectedSectionId(store);
				if (!id) return;
				store.set(lyricLinesImmerAtom, (draft) => {
					mergeSectionWithAdjacent(draft, id, "previous");
				});
			},
		},
	),
	sectionRemove: defineAction(
		"sectionRemove",
		"Edit",
		[
			key("settingsDialog.keybindings.sectionRemove"),
			"Section - Remove header (keep lyrics)",
		],
		{
			modes: ["edit"],
			enabledAtom: hasSectionAtom,
			run: ({ store }) => {
				const id = selectedSectionId(store);
				if (!id) return;
				store.set(lyricLinesImmerAtom, (draft) => {
					removeSectionMetadata(draft, id);
				});
			},
		},
	),
} satisfies Record<string, MenuAction>;
