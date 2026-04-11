import { atom } from "jotai";

export const importFromTextDialogAtom = atom(false);
export const metadataEditorDialogAtom = atom(false);
export const settingsDialogAtom = atom(false);
export const settingsTabAtom = atom("common");
export const latencyTestDialogAtom = atom(false);
export const submitToAMLLDBDialogAtom = atom(false);
export const splitWordDialogAtom = atom(false);
export const replaceWordDialogAtom = atom(false);
export const advancedSegmentationDialogAtom = atom(false);
export const timeShiftDialogAtom = atom(false);
export const lineSpectrogramDialogAtom = atom<{
	open: boolean;
	lineId?: string;
}>({ open: false });
export const confirmDialogAtom = atom<{
	open: boolean;
	title: string;
	description: string;
	onConfirm?: () => void;
}>({
	open: false,
	title: "",
	description: "",
});
export const historyRestoreDialogAtom = atom(false);
export const importFromLRCLIBDialogAtom = atom(false);
export const geniusSearchDialogAtom = atom(false);
export const changelogDialogAtom = atom(false);
export const geniusImportLyricsDialogAtom = atom(false);
export const fontSelectionDialogAtom = atom(false);
