import { useStore } from "jotai";
import { type FC, useCallback } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	findNextWord,
	getCurrentLineLocation,
	getCurrentLocation,
	getFirstSynchronizableUnit,
	getLastSynchronizableUnit,
	getSynchronizableUnits,
	isInSyncLane,
	isSynchronizableLine,
} from "$/modules/lyric-editor/utils/lyric-states";
import { calculateSyncTime } from "$/modules/lyric-editor/utils/sync-timing";
import {
	highlightActiveWordAtom,
	smartLastWordAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import {
	spectrogramHoverSyncEnabledAtom,
	syncCommitOffsetAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	spectrogramHoverTimeMsAtom,
	spectrogramIsHoveringAtom,
} from "$/modules/spectrogram/states";
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
} from "$/states/keybindings.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";
import {
	type KeyBindingEvent,
	useKeyBindingAtom,
} from "$/utils/keybindings.ts";

const getUnitStartTime = (unit: { word: LyricWord }) => unit.word.startTime;

type LyricsState = TTMLLyric;

function cloneLineWithWords(line: LyricLine): LyricLine {
	return { ...line, words: line.words.slice() };
}

function setUnitStartTimeCloned(
	line: LyricLine,
	wordIndex: number,
	time: number,
) {
	const prevWord = line.words[wordIndex];
	if (!prevWord) return;
	const nextWord = { ...prevWord };

	nextWord.startTime = time;

	line.words[wordIndex] = nextWord;
}

function setUnitEndTimeCloned(
	line: LyricLine,
	wordIndex: number,
	time: number,
) {
	const prevWord = line.words[wordIndex];
	if (!prevWord) return;
	const nextWord = { ...prevWord };

	nextWord.endTime = time;

	line.words[wordIndex] = nextWord;
}

export const SyncKeyBinding: FC = () => {
	const store = useStore();

	const calcJudgeTime = useCallback(
		(evt: KeyBindingEvent, actionOffset = 0) => {
			const spectrogramHoverSync = store.get(spectrogramHoverSyncEnabledAtom);
			const isSpectrogramHovering = store.get(spectrogramIsHoveringAtom);
			if (spectrogramHoverSync && isSpectrogramHovering) {
				const hoverTimeMs = Math.round(store.get(spectrogramHoverTimeMsAtom));
				if (hoverTimeMs >= 0) {
					return hoverTimeMs;
				}
			}

			return calculateSyncTime({
				audioTimeSeconds: audioEngine.interpolatedCurrentTime,
				playbackRate: audioEngine.musicPlayBackRate,
				isPlaying: audioEngine.musicPlaying,
				event: evt,
				judgeMode: store.get(syncJudgeModeAtom),
				syncTimeOffset: store.get(syncTimeOffsetAtom),
				actionOffset,
				performanceTime: performance.now(),
				performanceTimeOrigin: performance.timeOrigin,
			});
		},
		[store],
	);

	const moveToNextWordBase = useCallback(
		(play: boolean): boolean => {
			const location = getCurrentLocation(store);
			if (!location) return false;
			const nextWord = findNextWord(
				location.lines,
				location.lineIndex,
				location.syncIndex,
				store.get(backgroundSyncLaneAtom),
			);
			if (!nextWord) return false;
			store.set(selectedWordsAtom, new Set([nextWord.unit.id]));
			store.set(selectedLinesAtom, new Set([nextWord.line.id]));
			if (play)
				void audioEngine.resumeOrSeekMusic(
					getUnitStartTime(nextWord.unit) / 1000,
				);
			return true;
		},
		[store],
	);

	const moveToNextWord = useCallback(
		() => moveToNextWordBase(false),
		[moveToNextWordBase],
	);
	const moveToNextWordAndPlay = useCallback(
		() => moveToNextWordBase(true),
		[moveToNextWordBase],
	);

	const moveToPrevWordBase = useCallback(
		(play: boolean): boolean => {
			const location = getCurrentLocation(store);
			if (!location) return false;
			if (location.syncIndex === 0) {
				if (location.lineIndex === 0) return false;
				const lastLineIndex = Math.max(0, location.lineIndex);
				const lastLine = location.lines
					.slice(0, lastLineIndex)
					.reverse()
					.find(
						(line) =>
							isSynchronizableLine(line) &&
							isInSyncLane(
								location.line,
								line,
								store.get(backgroundSyncLaneAtom),
							) &&
							getSynchronizableUnits(line).length > 0,
					);
				if (!lastLine) return false;
				store.set(selectedLinesAtom, new Set([lastLine.id]));
				const lastUnit = getLastSynchronizableUnit(lastLine);
				if (!lastUnit) {
					store.set(selectedWordsAtom, new Set());
				} else {
					store.set(selectedWordsAtom, new Set([lastUnit.id]));
					if (play)
						void audioEngine.resumeOrSeekMusic(
							getUnitStartTime(lastUnit) / 1000,
						);
				}
			} else {
				const lineUnits = getSynchronizableUnits(location.line);
				const prevUnit = lineUnits[location.syncIndex - 1];
				if (!prevUnit) return false;
				store.set(selectedWordsAtom, new Set([prevUnit.id]));
				if (play)
					void audioEngine.resumeOrSeekMusic(getUnitStartTime(prevUnit) / 1000);
			}
			return true;
		},
		[store],
	);
	const moveToPrevWord = useCallback(
		() => moveToPrevWordBase(false),
		[moveToPrevWordBase],
	);
	const moveToPrevWordAndPlay = useCallback(
		() => moveToPrevWordBase(true),
		[moveToPrevWordBase],
	);

	// 移动打轴光标

	useKeyBindingAtom(keyMoveNextLineAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const lastLineIndex = Math.min(
			location.lines.length,
			location.lineIndex + 1,
		);
		const lastLine = location.lines[lastLineIndex];
		if (!lastLine) return;
		store.set(selectedLinesAtom, new Set([lastLine.id]));
		const firstUnit = getFirstSynchronizableUnit(lastLine);
		if (!firstUnit) {
			store.set(selectedWordsAtom, new Set());
		} else {
			store.set(selectedWordsAtom, new Set([firstUnit.id]));
		}
	}, [store]);

	useKeyBindingAtom(keyMovePrevLineAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const lastLineIndex = Math.max(0, location.lineIndex - 1);
		const lastLine = location.lines[lastLineIndex];
		if (!lastLine) return;
		store.set(selectedLinesAtom, new Set([lastLine.id]));
		const firstUnit = getFirstSynchronizableUnit(lastLine);
		if (!firstUnit) {
			store.set(selectedWordsAtom, new Set());
		} else {
			store.set(selectedWordsAtom, new Set([firstUnit.id]));
		}
	}, [store]);

	useKeyBindingAtom(keyMoveNextWordAtom, moveToNextWord, [store]);
	useKeyBindingAtom(keyMoveNextWordAndPlayAtom, moveToNextWordAndPlay, [store]);
	useKeyBindingAtom(keyMovePrevWordAtom, moveToPrevWord, [store]);
	useKeyBindingAtom(keyMovePrevWordAndPlayAtom, moveToPrevWordAndPlay, [store]);

	useKeyBindingAtom(keyMoveLastWordAndPlayAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const lastUnit = getLastSynchronizableUnit(location.line);
		if (!lastUnit) return;
		store.set(selectedWordsAtom, new Set([lastUnit.id]));
		store.set(selectedLinesAtom, new Set([location.line.id]));
		void audioEngine.resumeOrSeekMusic(getUnitStartTime(lastUnit) / 1000);
	}, [store]);

	useKeyBindingAtom(keyMoveFirstWordAndPlayAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const firstUnit = getFirstSynchronizableUnit(location.line);
		if (!firstUnit) return;
		store.set(selectedWordsAtom, new Set([firstUnit.id]));
		store.set(selectedLinesAtom, new Set([location.line.id]));
		void audioEngine.resumeOrSeekMusic(getUnitStartTime(firstUnit) / 1000);
	}, [store]);

	// 记录时间戳（主要打轴按键）

	useKeyBindingAtom(
		keySyncStartAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const prevLine = state.lyricLines[location.lineIndex];
				if (!prevLine) return prev;

				const nextLines = state.lyricLines.slice();
				const nextLine = cloneLineWithWords(prevLine);
				if (location.isFirstWord) nextLine.startTime = currentTime;
				setUnitStartTimeCloned(nextLine, location.wordIndex, currentTime);
				nextLines[location.lineIndex] = nextLine;

				return { ...state, lyricLines: nextLines };
			});
		},
		[store],
	);
	useKeyBindingAtom(
		keySyncNextAtom,
		(evt) => {
			const _t0 = performance.now();
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt, store.get(syncCommitOffsetAtom));
			const lane = store.get(backgroundSyncLaneAtom);
			const _t1 = performance.now();

			// 智能尾字
			const smartLastWord = store.get(smartLastWordAtom);
			if (smartLastWord && location.isLastWord) {
				store.set(lyricLinesAtom, (prev) => {
					const state: LyricsState = prev;
					const prevLine = state.lyricLines[location.lineIndex];
					if (!prevLine) return prev;

					const nextLines = state.lyricLines.slice();
					const nextLine = cloneLineWithWords(prevLine);
					setUnitEndTimeCloned(nextLine, location.wordIndex, currentTime);
					nextLine.endTime = currentTime;
					nextLines[location.lineIndex] = nextLine;

					return { ...state, lyricLines: nextLines };
				});
				moveToNextWord();
				return;
			}

			// ── Main word-mode commit path ──
			// Collect selection result from updater, then set it after — avoids
			// nested store.set calls inside an atom updater (causes double propagation).
			let targetSelection: { id: string; lineId: string } | null = null;

			const _t2 = performance.now();
			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const nextLines = state.lyricLines.slice();

				const curLineIndex = location.lineIndex;
				const curWordIndex = location.wordIndex;
				const curSyncIndex = location.syncIndex;

				const getLineToEdit = (idx: number) => {
					nextLines[idx] = cloneLineWithWords(nextLines[idx]);
					return nextLines[idx];
				};

				// 1. Commit current word end time
				setUnitEndTimeCloned(
					getLineToEdit(curLineIndex),
					curWordIndex,
					currentTime,
				);

				// 2. Scan forward for next selection
				targetSelection = null;

				let iterLineIndex = curLineIndex;
				let iterSyncIndex = curSyncIndex;

				while (true) {
					const next = findNextWord(
						nextLines,
						iterLineIndex,
						iterSyncIndex,
						lane,
					);
					if (!next) break;

					const text = next.unit.word.word.trim();
					if (text.length === 0) {
						// Whitespace — auto-commit both start and end
						const targetLine = getLineToEdit(next.lineIndex);
						if (next.lineIndex !== iterLineIndex) {
							nextLines[iterLineIndex].endTime = currentTime;
							targetLine.startTime = currentTime;
						}
						setUnitStartTimeCloned(
							targetLine,
							next.unit.wordIndex,
							currentTime,
						);
						setUnitEndTimeCloned(targetLine, next.unit.wordIndex, currentTime);
						iterLineIndex = next.lineIndex;
						iterSyncIndex = next.syncIndex;
					} else {
						// Found the next real word
						const targetLine = getLineToEdit(next.lineIndex);
						if (next.lineIndex !== iterLineIndex) {
							nextLines[iterLineIndex].endTime = currentTime;
							targetLine.startTime = currentTime;
						}
						setUnitStartTimeCloned(
							targetLine,
							next.unit.wordIndex,
							currentTime,
						);
						targetSelection = { id: next.unit.id, lineId: next.line.id };
						break;
					}
				}

				// The song's last word has no next line to close this one, so close it here.
				if (!targetSelection) nextLines[iterLineIndex].endTime = currentTime;

				return { ...state, lyricLines: nextLines };
			});
			const _t3 = performance.now();

			// Apply selection AFTER lyricLinesAtom is set (avoids nested propagation)
			if (targetSelection) {
				store.set(
					selectedWordsAtom,
					new Set([(targetSelection as { id: string; lineId: string }).id]),
				);
				store.set(
					selectedLinesAtom,
					new Set([(targetSelection as { id: string; lineId: string }).lineId]),
				);
			}

			const _t4 = performance.now();
			if (import.meta.env.DEV)
				console.debug(
					`[commit] setup=${(_t1 - _t0).toFixed(2)}ms | lyricLinesAtom.set=${(_t3 - _t2).toFixed(2)}ms | post-set=${(_t4 - _t3).toFixed(2)}ms | TOTAL=${(_t4 - _t0).toFixed(2)}ms`,
				);
		},
		[store, moveToNextWord],
	);
	useKeyBindingAtom(
		keySyncEndAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const prevLine = state.lyricLines[location.lineIndex];
				if (!prevLine) return prev;

				const nextLines = state.lyricLines.slice();
				const nextLine = cloneLineWithWords(prevLine);
				setUnitEndTimeCloned(nextLine, location.wordIndex, currentTime);
				if (location.isLastWord) nextLine.endTime = currentTime;
				nextLines[location.lineIndex] = nextLine;

				return { ...state, lyricLines: nextLines };
			});
			moveToNextWord();
		},
		[store, moveToNextWord],
	);

	useKeyBindingAtom(keyToggleWordHighlightAtom, () => {
		store.set(highlightActiveWordAtom, (v) => !v);
	}, [store]);

	return null;
};
