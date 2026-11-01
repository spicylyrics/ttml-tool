import { useStore } from "jotai";
import { type FC, useCallback } from "react";
import { useSyncJudgeTime } from "$/modules/lyric-editor/components/use-sync-judge-time";
import {
	getCurrentLineLocation,
	getSynchronizableUnits,
} from "$/modules/lyric-editor/utils/lyric-states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import { syncCommitOffsetAtom } from "$/modules/settings/states/sync";
import {
	keySyncLineEndAtom,
	keySyncLineNextAtom,
	keySyncLineStartAtom,
} from "$/states/keybindings";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { useKeyBindingAtom } from "$/utils/keybindings";
import {
	type LineSyncResult,
	lineSyncEnd,
	lineSyncNext,
	lineSyncStart,
} from "./line-keys";

/**
 * Whole-line timing in Time mode, next to word syncing: Start line, End line
 * and start next, End line. They set the selected line's start and end only.
 * No default keys; they run from the palette or a shortcut set in Preferences.
 */
export const LineSyncKeyBinding: FC = () => {
	const store = useStore();
	const calcJudgeTime = useSyncJudgeTime();

	const runSync = useCallback(
		(apply: (lines: LyricLine[], lineIndex: number) => LineSyncResult) => {
			const location = getCurrentLineLocation(store);
			if (!location) return;
			let nextIndex = -1;
			store.set(lyricLinesAtom, (prev) => {
				const result = apply(prev.lyricLines, location.lineIndex);
				nextIndex = result.nextIndex;
				return { ...prev, lyricLines: result.lines };
			});
			const next = store.get(lyricLinesAtom).lyricLines[nextIndex];
			if (!next) return;
			// Land on the next line's first word, like moving to the next line does.
			const first = getSynchronizableUnits(next)[0];
			store.set(selectedLinesAtom, new Set([next.id]));
			store.set(selectedWordsAtom, new Set(first ? [first.id] : []));
		},
		[store],
	);

	useKeyBindingAtom(
		keySyncLineStartAtom,
		(evt) => {
			const time = calcJudgeTime(evt);
			runSync((lines, index) => lineSyncStart(lines, index, time));
		},
		[calcJudgeTime, runSync],
	);
	useKeyBindingAtom(
		keySyncLineNextAtom,
		(evt) => {
			const time = calcJudgeTime(evt, store.get(syncCommitOffsetAtom));
			const lane = store.get(backgroundSyncLaneAtom);
			runSync((lines, index) => lineSyncNext(lines, index, time, lane));
		},
		[store, calcJudgeTime, runSync],
	);
	useKeyBindingAtom(
		keySyncLineEndAtom,
		(evt) => {
			const time = calcJudgeTime(evt);
			const lane = store.get(backgroundSyncLaneAtom);
			runSync((lines, index) => lineSyncEnd(lines, index, time, lane));
		},
		[store, calcJudgeTime, runSync],
	);

	return null;
};
