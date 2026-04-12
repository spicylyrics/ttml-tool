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
	isSynchronizableLine,
} from "$/modules/lyric-editor/utils/lyric-states";
import {
	highlightActiveWordAtom,
	smartFirstWordAtom,
	smartLastWordAtom,
	SyncJudgeMode,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import {
	currentEmptyBeatAtom,
	smartFirstWordActiveIdAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
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
import type { LyricLine, LyricWord, LyricWordBase, TTMLLyric } from "$/types/ttml";
import {
	type KeyBindingEvent,
	useKeyBindingAtom,
} from "$/utils/keybindings.ts";


const getUnitStartTime = (unit: {
	word: LyricWord;
	rubyWord?: LyricWordBase;
}) => unit.rubyWord?.startTime ?? unit.word.startTime;

const updateRubyParentTime = (word: LyricWord) => {
	const ruby = word.ruby;
	if (!ruby || ruby.length === 0) return;
	let minStart = Number.POSITIVE_INFINITY;
	let maxEnd = Number.NEGATIVE_INFINITY;
	for (const r of ruby) {
		if (r.startTime < minStart) minStart = r.startTime;
		if (r.endTime > maxEnd) maxEnd = r.endTime;
	}
	if (Number.isFinite(minStart)) word.startTime = minStart;
	if (Number.isFinite(maxEnd)) word.endTime = maxEnd;
};

type LyricsState = TTMLLyric;

function cloneLineWithWords(line: LyricLine): LyricLine {
	return { ...line, words: line.words.slice() };
}

function cloneWordWithRuby(word: LyricWord): LyricWord {
	return {
		...word,
		ruby: word.ruby ? word.ruby.slice() : undefined,
	};
}

function setUnitStartTimeCloned(
	line: LyricLine,
	wordIndex: number,
	rubyIndex: number | undefined,
	time: number,
) {
	const prevWord = line.words[wordIndex];
	if (!prevWord) return;
	const nextWord = cloneWordWithRuby(prevWord);

	if (rubyIndex !== undefined && nextWord.ruby?.[rubyIndex]) {
		const prevRuby = nextWord.ruby[rubyIndex];
		nextWord.ruby[rubyIndex] = { ...prevRuby, startTime: time };
		updateRubyParentTime(nextWord);
	} else {
		nextWord.startTime = time;
	}

	line.words[wordIndex] = nextWord;
}

function setUnitEndTimeCloned(
	line: LyricLine,
	wordIndex: number,
	rubyIndex: number | undefined,
	time: number,
) {
	const prevWord = line.words[wordIndex];
	if (!prevWord) return;
	const nextWord = cloneWordWithRuby(prevWord);

	if (rubyIndex !== undefined && nextWord.ruby?.[rubyIndex]) {
		const prevRuby = nextWord.ruby[rubyIndex];
		nextWord.ruby[rubyIndex] = { ...prevRuby, endTime: time };
		updateRubyParentTime(nextWord);
	} else {
		nextWord.endTime = time;
	}

	line.words[wordIndex] = nextWord;
}

export const SyncKeyBinding: FC = () => {
	const store = useStore();

	const calcJudgeTime = useCallback(
		(evt: KeyBindingEvent) => {
			const syncTimeOffset = store.get(syncTimeOffsetAtom);
			const currentTime = Math.max(
				0,
				audioEngine.musicCurrentTime * 1000 + syncTimeOffset,
			);
			const syncJudgeMode = store.get(syncJudgeModeAtom);
			if (syncJudgeMode === SyncJudgeMode.FirstKeyDownTimeLegacy) {
				return (
					Math.max(
						0,
						audioEngine.musicCurrentTime * 1000 -
							evt.downTimeOffset +
							syncTimeOffset,
					) | 0
				);
			}
			let timeAdjustment = 0;
			if (audioEngine.musicPlaying) {
				switch (syncJudgeMode) {
					case SyncJudgeMode.FirstKeyDownTime:
						timeAdjustment -= evt.downTimeOffset;
						break;
					case SyncJudgeMode.LastKeyUpTime:
						break;
					case SyncJudgeMode.MiddleKeyTime:
						timeAdjustment -= evt.downTimeOffset / 2;
						break;
				}
				timeAdjustment *= audioEngine.musicPlayBackRate;
			}
			return Math.max(0, currentTime + timeAdjustment) | 0;
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
			);
			if (!nextWord) return false;
			store.set(selectedWordsAtom, new Set([nextWord.unit.id]));
			store.set(selectedLinesAtom, new Set([nextWord.line.id]));
			store.set(currentEmptyBeatAtom, 0);
			if (play) audioEngine.seekMusic(getUnitStartTime(nextWord.unit) / 1000);
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
							getSynchronizableUnits(line).length > 0,
					);
				if (!lastLine) return false;
				store.set(selectedLinesAtom, new Set([lastLine.id]));
				const lastUnit = getLastSynchronizableUnit(lastLine);
				if (!lastUnit) {
					store.set(selectedWordsAtom, new Set());
				} else {
					store.set(selectedWordsAtom, new Set([lastUnit.id]));
					if (play) audioEngine.seekMusic(getUnitStartTime(lastUnit) / 1000);
				}
			} else {
				const lineUnits = getSynchronizableUnits(location.line);
				const prevUnit = lineUnits[location.syncIndex - 1];
				if (!prevUnit) return false;
				store.set(selectedWordsAtom, new Set([prevUnit.id]));
				if (play) audioEngine.seekMusic(getUnitStartTime(prevUnit) / 1000);
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
		audioEngine.seekMusic(getUnitStartTime(lastUnit) / 1000);
	}, [store]);

	useKeyBindingAtom(keyMoveFirstWordAndPlayAtom, () => {
		const location = getCurrentLineLocation(store);
		if (!location) return;
		const firstUnit = getFirstSynchronizableUnit(location.line);
		if (!firstUnit) return;
		store.set(selectedWordsAtom, new Set([firstUnit.id]));
		store.set(selectedLinesAtom, new Set([location.line.id]));
		audioEngine.seekMusic(getUnitStartTime(firstUnit) / 1000);
	}, [store]);

	// 记录时间戳（主要打轴按键）

	useKeyBindingAtom(
		keySyncStartAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			const smartFirstWord = store.get(smartFirstWordAtom);
			if (smartFirstWord && location.isFirstWord) {
				store.set(smartFirstWordActiveIdAtom, location.word.id);
			}

			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const prevLine = state.lyricLines[location.lineIndex];
				if (!prevLine) return prev;

				const nextLines = state.lyricLines.slice();
				const nextLine = cloneLineWithWords(prevLine);
				if (location.isFirstWord) nextLine.startTime = currentTime;
				setUnitStartTimeCloned(
					nextLine,
					location.wordIndex,
					location.rubyIndex,
					currentTime,
				);
				nextLines[location.lineIndex] = nextLine;

				return { ...state, lyricLines: nextLines };
			});
		},
		[store],
	);
	useKeyBindingAtom(
		keySyncNextAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			const syncLevelMode = store.get(syncLevelModeAtom);
			if (syncLevelMode === "line") {
				store.set(lyricLinesAtom, (prev) => {
					const state: LyricsState = prev;
					const prevCurLine = state.lyricLines[location.lineIndex];
					if (!prevCurLine) return prev;

					const nextLines = state.lyricLines.slice();
					const curLine = cloneLineWithWords(prevCurLine);
					curLine.endTime = currentTime;

					const units = getSynchronizableUnits(curLine);
					if (units.length > 0) {
						let startTime = getUnitStartTime(units[0]);
						if (startTime === undefined || startTime >= currentTime || startTime === 0) {

							startTime = Math.max(0, currentTime - 1000);
						}
						const totalDuration = currentTime - startTime;
						const lengths = units.map((u) => Math.max(1, (u.rubyWord?.word || u.word.word).trim().length));
						const totalLength = lengths.reduce((a, b) => a + b, 0);

						let currentStart = startTime;
						for(let i = 0; i < units.length; i++) {
							const duration = Math.round((lengths[i] / totalLength) * totalDuration);
							const currentEnd = (i === units.length - 1) ? currentTime : currentStart + duration;
							setUnitStartTimeCloned(curLine, units[i].wordIndex, units[i].rubyIndex, currentStart);
							setUnitEndTimeCloned(curLine, units[i].wordIndex, units[i].rubyIndex, currentEnd);
							currentStart = currentEnd;
						}
					}

					const nextLineIndex = state.lyricLines.slice(location.lineIndex + 1).findIndex(
						(nextLine) => isSynchronizableLine(nextLine) && getSynchronizableUnits(nextLine).length > 0
					);

					if (nextLineIndex !== -1) {
						const absoluteNextLineIndex = location.lineIndex + 1 + nextLineIndex;
						const prevNextLine = state.lyricLines[absoluteNextLineIndex];
						const nextLine = cloneLineWithWords(prevNextLine);
						nextLine.startTime = currentTime;
						const nextLineUnits = getSynchronizableUnits(nextLine);
						if (nextLineUnits.length > 0) {
							setUnitStartTimeCloned(nextLine, nextLineUnits[0].wordIndex, nextLineUnits[0].rubyIndex, currentTime);
						}
						nextLines[absoluteNextLineIndex] = nextLine;
					}

					nextLines[location.lineIndex] = curLine;
					return { ...state, lyricLines: nextLines };
				});

				const state = store.get(lyricLinesAtom);
				const nextLineIndex = state.lyricLines.slice(location.lineIndex + 1).findIndex(
					(nextLine) => isSynchronizableLine(nextLine) && getSynchronizableUnits(nextLine).length > 0
				);
				if (nextLineIndex !== -1) {
					const absoluteNextLineIndex = location.lineIndex + 1 + nextLineIndex;
					const nextLine = state.lyricLines[absoluteNextLineIndex];
					store.set(selectedLinesAtom, new Set([nextLine.id]));
					const nextLineUnits = getSynchronizableUnits(nextLine);
					if (nextLineUnits.length > 0) {
						store.set(selectedWordsAtom, new Set([nextLineUnits[0].id]));
					}
				}
				return;
			}

			// 智能首字
			const smartFirstWord = store.get(smartFirstWordAtom);
			if (smartFirstWord && location.isFirstWord) {
				const activeId = store.get(smartFirstWordActiveIdAtom);
				if (activeId !== location.word.id) {
					store.set(lyricLinesAtom, (prev) => {
						const state: LyricsState = prev;
						const prevLine = state.lyricLines[location.lineIndex];
						if (!prevLine) return prev;

						const nextLines = state.lyricLines.slice();
						const nextLine = cloneLineWithWords(prevLine);
						nextLine.startTime = currentTime;
						setUnitStartTimeCloned(
							nextLine,
							location.wordIndex,
							location.rubyIndex,
							currentTime,
						);
						nextLines[location.lineIndex] = nextLine;

						return { ...state, lyricLines: nextLines };
					});
					store.set(smartFirstWordActiveIdAtom, location.word.id);
					return;
				}
			}
			store.set(smartFirstWordActiveIdAtom, null);

			const hasRuby = location.word.ruby?.length;
			if (!hasRuby) {
				const emptyBeat = store.get(currentEmptyBeatAtom);
				if (emptyBeat < location.word.emptyBeat) {
					store.set(currentEmptyBeatAtom, emptyBeat + 1);
					return;
				}
			}

			// 智能尾字
			const smartLastWord = store.get(smartLastWordAtom);
			if (smartLastWord && location.isLastWord) {
				store.set(lyricLinesAtom, (prev) => {
					const state: LyricsState = prev;
					const prevLine = state.lyricLines[location.lineIndex];
					if (!prevLine) return prev;

					const nextLines = state.lyricLines.slice();
					const nextLine = cloneLineWithWords(prevLine);
					setUnitEndTimeCloned(
						nextLine,
						location.wordIndex,
						location.rubyIndex,
						currentTime,
					);
					nextLine.endTime = currentTime;
					nextLines[location.lineIndex] = nextLine;

					return { ...state, lyricLines: nextLines };
				});
				moveToNextWord();
				return;
			}

			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const nextLines = state.lyricLines.slice();
				
				let curLineIndex = location.lineIndex;
				let curWordIndex = location.wordIndex;
				let curRubyIndex = location.rubyIndex;
				let curSyncIndex = location.syncIndex;

				const getLineToEdit = (idx: number) => {
					// Ensure the line is cloned and stored in nextLines
					nextLines[idx] = cloneLineWithWords(nextLines[idx]);
					return nextLines[idx];
				};

				// 1. Commit current word end time
				setUnitEndTimeCloned(getLineToEdit(curLineIndex), curWordIndex, curRubyIndex, currentTime);

				// 2. Scan forward for next selection
				let targetSelection: { id: string; lineId: string } | null = null;
				
				let iterLineIndex = curLineIndex;
				let iterSyncIndex = curSyncIndex;

				while (true) {
					const next = findNextWord(nextLines, iterLineIndex, iterSyncIndex);
					if (!next) break;

					const text = (next.unit.rubyWord?.word ?? next.unit.word.word).trim();
					if (text.length === 0) {
						// It's whitespace. Auto-commit both start and end to the current time.
						const targetLine = getLineToEdit(next.lineIndex);
						if (next.lineIndex !== iterLineIndex) {
							nextLines[iterLineIndex].endTime = currentTime;
							targetLine.startTime = currentTime;
						}
						setUnitStartTimeCloned(targetLine, next.unit.wordIndex, next.unit.rubyIndex, currentTime);
						setUnitEndTimeCloned(targetLine, next.unit.wordIndex, next.unit.rubyIndex, currentTime);
						iterLineIndex = next.lineIndex;
						iterSyncIndex = next.syncIndex;
					} else {
						// Found the next real word!
						const targetLine = getLineToEdit(next.lineIndex);
						if (next.lineIndex !== iterLineIndex) {
							nextLines[iterLineIndex].endTime = currentTime;
							targetLine.startTime = currentTime;
						}
						setUnitStartTimeCloned(targetLine, next.unit.wordIndex, next.unit.rubyIndex, currentTime);
						targetSelection = { id: next.unit.id, lineId: next.line.id };
						break;
					}
				}

				if (targetSelection) {
					store.set(selectedWordsAtom, new Set([targetSelection.id]));
					store.set(selectedLinesAtom, new Set([targetSelection.lineId]));
				}

				return { ...state, lyricLines: nextLines };
			});
			
			store.set(currentEmptyBeatAtom, 0);



			// 开了智能首字后，连轴打到下一行时跳过智能首字
			if (smartFirstWord) {
				const newLocation = getCurrentLocation(store);
				if (newLocation?.isFirstWord) {
					store.set(smartFirstWordActiveIdAtom, newLocation.word.id);
				}
			}
		},
		[store, moveToNextWord],
	);
	useKeyBindingAtom(
		keySyncEndAtom,
		(evt) => {
			const location = getCurrentLocation(store);
			if (!location) return;
			const currentTime = calcJudgeTime(evt);

			const syncLevelMode = store.get(syncLevelModeAtom);
			if (syncLevelMode === "line") {
				store.set(lyricLinesAtom, (prev) => {
					const state: LyricsState = prev;
					const prevCurLine = state.lyricLines[location.lineIndex];
					if (!prevCurLine) return prev;

					const nextLines = state.lyricLines.slice();
					const curLine = cloneLineWithWords(prevCurLine);
					curLine.endTime = currentTime;

					const units = getSynchronizableUnits(curLine);
					if (units.length > 0) {
						let startTime = getUnitStartTime(units[0]);
						if (startTime === undefined || startTime >= currentTime || startTime === 0) {

							startTime = Math.max(0, currentTime - 1000);
						}
						const totalDuration = currentTime - startTime;
						const lengths = units.map((u) => Math.max(1, (u.rubyWord?.word || u.word.word).trim().length));
						const totalLength = lengths.reduce((a, b) => a + b, 0);

						let currentStart = startTime;
						for(let i = 0; i < units.length; i++) {
							const duration = Math.round((lengths[i] / totalLength) * totalDuration);
							const currentEnd = (i === units.length - 1) ? currentTime : currentStart + duration;
							setUnitStartTimeCloned(curLine, units[i].wordIndex, units[i].rubyIndex, currentStart);
							setUnitEndTimeCloned(curLine, units[i].wordIndex, units[i].rubyIndex, currentEnd);
							currentStart = currentEnd;
						}
					}
					
					nextLines[location.lineIndex] = curLine;
					return { ...state, lyricLines: nextLines };
				});

				const state = store.get(lyricLinesAtom);
				const nextLineIndex = state.lyricLines.slice(location.lineIndex + 1).findIndex(
					(nextLine) => isSynchronizableLine(nextLine) && getSynchronizableUnits(nextLine).length > 0
				);
				if (nextLineIndex !== -1) {
					const absoluteNextLineIndex = location.lineIndex + 1 + nextLineIndex;
					const nextLine = state.lyricLines[absoluteNextLineIndex];
					store.set(selectedLinesAtom, new Set([nextLine.id]));
					const nextLineUnits = getSynchronizableUnits(nextLine);
					if (nextLineUnits.length > 0) {
						store.set(selectedWordsAtom, new Set([nextLineUnits[0].id]));
					}
				}
				return;
			}

			store.set(lyricLinesAtom, (prev) => {
				const state: LyricsState = prev;
				const prevLine = state.lyricLines[location.lineIndex];
				if (!prevLine) return prev;

				const nextLines = state.lyricLines.slice();
				const nextLine = cloneLineWithWords(prevLine);
				setUnitEndTimeCloned(
					nextLine,
					location.wordIndex,
					location.rubyIndex,
					currentTime,
				);
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
