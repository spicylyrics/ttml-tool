import { atom } from "jotai";
import type { WordCombinationSelection } from "$/modules/lyric-editor/tools/replace-word-combination";

export const importLyricsDialogAtom = atom(false);
export const metadataEditorDialogAtom = atom(false);
export const settingsDialogAtom = atom(false);
export const settingsTabAtom = atom("common");
export const latencyTestDialogAtom = atom(false);
export const ttmlChecklistDialogAtom = atom(false);
export const splitWordDialogAtom = atom(false);
export const replaceWordDialogAtom = atom(false);
export const replaceWordCombinationDialogAtom = atom<{
	open: boolean;
	selection: WordCombinationSelection | null;
}>({ open: false, selection: null });
export const replaceRomanizationDialogAtom = atom({
	open: false,
	lineIndex: -1,
	wordIndex: -1,
});
export const combineWordsDialogAtom = atom<{
	open: boolean;
	lineIndex: number;
}>({ open: false, lineIndex: -1 });
export const advancedSegmentationDialogAtom = atom(false);
export const autoSegmentDialogAtom = atom(false);
export const learnedSplitsDialogAtom = atom(false);
export const timeShiftDialogAtom = atom(false);
export const timeStretchDialogAtom = atom(false);
export const confirmDialogAtom = atom<{
	open: boolean;
	title: string;
	description: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm?: () => void;
	onCancel?: () => void;
}>({
	open: false,
	title: "",
	description: "",
});
export const historyRestoreDialogAtom = atom(false);
export const geniusSearchDialogAtom = atom(false);
/** Write `true` to open Preferences on the Changelog page. */
export const changelogDialogAtom = atom(null, (_get, set, open: boolean) => {
	if (!open) return;
	set(settingsTabAtom, "changelog");
	set(settingsDialogAtom, true);
});
export const fontSelectionDialogAtom = atom(false);
export const projectsDialogAtom = atom(false);
export const timeShiftPreviewOffsetAtom = atom(0);
export const timeShiftPreviewActiveAtom = atom(false);
export const timeShiftPreviewScopeAtom = atom<
	"all" | "selected" | "selected-following" | "custom"
>("all");
export const timeShiftPreviewCustomRangeAtom = atom<[number, number]>([1, 1]);
export const suggestedSplitsDialogAtom = atom<{
	open: boolean;
	lineId?: string;
	wordIndex?: number;
}>({ open: false });
