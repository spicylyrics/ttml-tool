import { type createStore, useStore } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	cmdAuditionSelection,
	cmdAuditionSelectionAfter,
	cmdAuditionSelectionBefore,
} from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
import { processedLyricLinesAtom } from "$/modules/segmentation/utils/segment-processing";
import { selectedWordIdAtom } from "$/modules/spectrogram/states/dnd";
import { lyricLinesAtom, selectedWordsAtom } from "$/states/main";

type Store = ReturnType<typeof createStore>;

/**
 * 试听片段前后的时长 (毫秒)
 */
const AUDITION_PADDING_MS = 500;

export interface AuditionRange {
	startTime: number;
	endTime: number;
}

export type WordSelectionSource = "spectrogram" | "editor";

/** The word selected in the spectrogram, in milliseconds. */
function getSpectrogramRange(store: Store): AuditionRange | null {
	const selectedWordId = store.get(selectedWordIdAtom);
	if (!selectedWordId) return null;

	for (const line of store.get(processedLyricLinesAtom)) {
		const segment = line.segments.find(
			(s) => s.type === "word" && s.id === selectedWordId,
		);
		if (segment?.startTime == null || segment.endTime == null) continue;
		return { startTime: segment.startTime, endTime: segment.endTime };
	}
	return null;
}

/**
 * The words selected in the editor, in milliseconds. Several words span from
 * the first start to the last end; untimed words are skipped.
 */
function getEditorRange(store: Store): AuditionRange | null {
	const selected = store.get(selectedWordsAtom);
	if (selected.size === 0) return null;

	let startTime = Number.POSITIVE_INFINITY;
	let endTime = Number.NEGATIVE_INFINITY;
	for (const line of store.get(lyricLinesAtom).lyricLines) {
		for (const word of line.words) {
			if (!selected.has(word.id) || word.endTime <= word.startTime) continue;
			startTime = Math.min(startTime, word.startTime);
			endTime = Math.max(endTime, word.endTime);
		}
	}
	return Number.isFinite(startTime) ? { startTime, endTime } : null;
}

/**
 * The range the audition keys play: the selection the user touched last,
 * falling back to the other one when it has nothing timed.
 */
export function getAuditionRange(
	store: Store,
	preferred: WordSelectionSource,
): AuditionRange | null {
	return preferred === "editor"
		? (getEditorRange(store) ?? getSpectrogramRange(store))
		: (getSpectrogramRange(store) ?? getEditorRange(store));
}

export const AuditionKeyBinding = () => {
	const store = useStore();
	// The spectrogram and the editor keep separate word selections. Lookups
	// happen when a key fires; subscribing to the segments would rebuild every
	// line on each sync key press, which adds up on long songs.
	const lastSource = useRef<WordSelectionSource>("spectrogram");

	useEffect(() => {
		const unsubSpectrogram = store.sub(selectedWordIdAtom, () => {
			lastSource.current = "spectrogram";
		});
		const unsubEditor = store.sub(selectedWordsAtom, () => {
			lastSource.current = "editor";
		});
		return () => {
			unsubSpectrogram();
			unsubEditor();
		};
	}, [store]);

	const getSelectedRange = useCallback(
		() => getAuditionRange(store, lastSource.current),
		[store],
	);

	// 播放选中片段前 500ms
	useCommand(cmdAuditionSelectionBefore, () => {
		const range = getSelectedRange();
		if (!range) return;
		audioEngine.auditionRange(
			(range.startTime - AUDITION_PADDING_MS) / 1000,
			range.startTime / 1000,
		);
	}, [getSelectedRange]);

	// 播放选中的片段
	useCommand(cmdAuditionSelection, () => {
		const range = getSelectedRange();
		if (!range) return;
		audioEngine.auditionRange(range.startTime / 1000, range.endTime / 1000);
	}, [getSelectedRange]);

	// 播放选中片段后 500ms
	useCommand(cmdAuditionSelectionAfter, () => {
		const range = getSelectedRange();
		if (!range) return;
		audioEngine.auditionRange(
			range.endTime / 1000,
			(range.endTime + AUDITION_PADDING_MS) / 1000,
		);
	}, [getSelectedRange]);

	return null;
};
