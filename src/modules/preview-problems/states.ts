import { atom } from "jotai";
import { timedPreviewLyricsAtom } from "$/components/PreviewModeSwitcher/states";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { detectWordTimingProblems } from "./detect-word-timing-problems";

/** Timing problems the Spicy preview marks, in the lines it shows. */
export const previewTimingProblemsAtom = atom((get) =>
	detectWordTimingProblems(get(timedPreviewLyricsAtom).lyricLines),
);

/** Select the first flagged word in Time mode, so its timing can be fixed. */
export const jumpToFirstTimingProblemAtom = atom(null, (get, set) => {
	const issue = get(previewTimingProblemsAtom)[0];
	if (!issue) return;
	const line = get(lyricLinesAtom).lyricLines.find(
		(item) => item.id === issue.lineId,
	);
	if (line?.sectionId) {
		const expanded = new Set(get(collapsedSectionIdsAtom));
		expanded.delete(line.sectionId);
		set(collapsedSectionIdsAtom, expanded);
	}
	set(selectedLinesAtom, new Set([issue.lineId]));
	set(selectedWordsAtom, new Set([issue.wordId]));
	set(toolModeAtom, ToolMode.Sync);
});
