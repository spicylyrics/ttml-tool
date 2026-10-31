import { useAtomValue, useStore } from "jotai";
import { type FC, useCallback } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { SyncKeyBinding } from "$/modules/lyric-editor/components/sync-keybinding";
import { useSyncJudgeTime } from "$/modules/lyric-editor/components/use-sync-judge-time";
import {
	getCurrentLineLocation,
	getSynchronizableUnits,
} from "$/modules/lyric-editor/utils/lyric-states";
import { highlightActiveWordAtom } from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import { syncCommitOffsetAtom } from "$/modules/settings/states/sync";
import {
	keyMoveFirstWordAndPlayAtom,
	keyMoveLastWordAndPlayAtom,
	keyMoveNextLineAtom,
	keyMoveNextWordAndPlayAtom,
	keyMoveNextWordAtom,
	keyMovePrevLineAtom,
	keyMovePrevWordAndPlayAtom,
	keyMovePrevWordAtom,
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
	keyToggleWordHighlightAtom,
} from "$/states/keybindings";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { useKeyBindingAtom } from "$/utils/keybindings";
import {
	findNextLineSyncIndex,
	findPrevLineSyncIndex,
	type LineSyncResult,
	lineSyncEnd,
	lineSyncNext,
	lineSyncStart,
} from "./line-keys";
import { lineSyncActiveAtom } from "./states";

/**
 * Keyboard syncing for Line mode. F starts the selected line, G ends it and
 * starts the next, H ends it. Word navigation keys move by whole lines.
 */
export const LineSyncKeyBinding: FC = () => {
	const store = useStore();

	const calcJudgeTime = useSyncJudgeTime();

	const selectLine = useCallback(
		(line: LyricLine | undefined, play: boolean) => {
			if (!line) return;
			store.set(selectedLinesAtom, new Set([line.id]));
			store.set(
				selectedWordsAtom,
				new Set(getSynchronizableUnits(line).map((unit) => unit.id)),
			);
			if (play && line.endTime > line.startTime)
				void audioEngine.resumeOrSeekMusic(line.startTime / 1000);
		},
		[store],
	);

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
			if (nextIndex !== -1)
				selectLine(store.get(lyricLinesAtom).lyricLines[nextIndex], false);
		},
		[store, selectLine],
	);

	const moveBy = useCallback(
		(direction: 1 | -1, play: boolean) => {
			const location = getCurrentLineLocation(store);
			if (!location) return;
			const lane = store.get(backgroundSyncLaneAtom);
			const index =
				direction === 1
					? findNextLineSyncIndex(location.lines, location.lineIndex, lane)
					: findPrevLineSyncIndex(location.lines, location.lineIndex, lane);
			if (index !== -1) selectLine(location.lines[index], play);
		},
		[store, selectLine],
	);

	const replayLine = useCallback(() => {
		const location = getCurrentLineLocation(store);
		if (location) selectLine(location.line, true);
	}, [store, selectLine]);

	useKeyBindingAtom(
		keySyncStartAtom,
		(evt) => {
			const time = calcJudgeTime(evt);
			runSync((lines, index) => lineSyncStart(lines, index, time));
		},
		[calcJudgeTime, runSync],
	);
	useKeyBindingAtom(
		keySyncNextAtom,
		(evt) => {
			const time = calcJudgeTime(evt, store.get(syncCommitOffsetAtom));
			const lane = store.get(backgroundSyncLaneAtom);
			runSync((lines, index) => lineSyncNext(lines, index, time, lane));
		},
		[store, calcJudgeTime, runSync],
	);
	useKeyBindingAtom(
		keySyncEndAtom,
		(evt) => {
			const time = calcJudgeTime(evt);
			const lane = store.get(backgroundSyncLaneAtom);
			runSync((lines, index) => lineSyncEnd(lines, index, time, lane));
		},
		[store, calcJudgeTime, runSync],
	);

	useKeyBindingAtom(keyMoveNextLineAtom, () => moveBy(1, false), [moveBy]);
	useKeyBindingAtom(keyMovePrevLineAtom, () => moveBy(-1, false), [moveBy]);
	useKeyBindingAtom(keyMoveNextWordAtom, () => moveBy(1, false), [moveBy]);
	useKeyBindingAtom(keyMovePrevWordAtom, () => moveBy(-1, false), [moveBy]);
	useKeyBindingAtom(keyMoveNextWordAndPlayAtom, () => moveBy(1, true), [
		moveBy,
	]);
	useKeyBindingAtom(keyMovePrevWordAndPlayAtom, () => moveBy(-1, true), [
		moveBy,
	]);
	useKeyBindingAtom(keyMoveFirstWordAndPlayAtom, replayLine, [replayLine]);
	useKeyBindingAtom(keyMoveLastWordAndPlayAtom, replayLine, [replayLine]);

	useKeyBindingAtom(keyToggleWordHighlightAtom, () => {
		store.set(highlightActiveWordAtom, (v) => !v);
	}, [store]);

	return null;
};

/** Time-mode keys: Line mode gets its own set, everything else keeps word syncing. */
export const SyncKeyBindings: FC = () =>
	useAtomValue(lineSyncActiveAtom) ? (
		<LineSyncKeyBinding />
	) : (
		<SyncKeyBinding />
	);
