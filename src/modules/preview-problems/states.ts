import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { timedPreviewLyricsAtom } from "$/components/PreviewModeSwitcher/states";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import {
	detectWordTimingProblems,
	type WordTimingIssue,
} from "./detect-word-timing-problems";

/** Feature flag: mark words with timing problems in the Spicy preview. Off by default. */
export const showPreviewTimingProblemsAtom = atomWithStorage(
	"previewProblems.enabled",
	false,
	undefined,
	{ getOnInit: true },
);

const NO_ISSUES: WordTimingIssue[] = [];

/** Timing problems in the lines the preview shows; empty while the flag is off. */
export const previewTimingProblemsAtom = atom((get) =>
	get(showPreviewTimingProblemsAtom)
		? detectWordTimingProblems(get(timedPreviewLyricsAtom).lyricLines)
		: NO_ISSUES,
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
