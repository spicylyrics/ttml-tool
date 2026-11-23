import type { Draft } from "immer";
import { distributeTime } from "$/modules/lyric-editor/utils/distribute-time";
import {
	type ProcessedLyricLine,
	processSingleLine,
	type WordSegment,
} from "$/modules/segmentation/utils/segment-processing";
import { lyricLinesAtom } from "$/states/main";
import { globalStore } from "$/states/store.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";

const MIN_WORD_DURATION_MS = 10;

/**
 * Which edges a divider moves. "shared" moves the boundary between two
 * touching segments; "end" and "start" move one word's edge where words
 * overlap, so dragging one doesn't flatten the overlap.
 */
export type DividerEdge = "shared" | "end" | "start";

/** The edge kind of the divider drawn after `segments[index]`. */
export function getDividerEdge(
	segments: ProcessedLyricLine["segments"],
	index: number,
	lineEndTime: number,
): DividerEdge {
	const segment = segments[index];
	const next = segments[index + 1];
	if (!next) return segment.endTime === lineEndTime ? "shared" : "end";
	return next.startTime === segment.endTime ? "shared" : "end";
}

/** Whether `segments[index]` starts inside the previous segment and needs its own start handle. */
export function hasOverlappedStart(
	segments: ProcessedLyricLine["segments"],
	index: number,
) {
	const previous = segments[index - 1];
	const segment = segments[index];
	return (
		!!previous &&
		segment.type === "word" &&
		segment.startTime < previous.endTime
	);
}

function updateOverlappingEdge(
	originalLine: ProcessedLyricLine,
	segmentIndex: number,
	newTime: number,
	edge: "end" | "start",
): ProcessedLyricLine {
	const segments = [...originalLine.segments];
	const words = segments.filter((s): s is WordSegment => s.type === "word");
	let { startTime, endTime } = originalLine;

	if (edge === "end") {
		const word = segments[segmentIndex] as WordSegment;
		const ownsLineEnd = word.endTime === originalLine.endTime;
		const clamped = Math.min(
			Math.max(newTime, word.startTime + MIN_WORD_DURATION_MS),
			ownsLineEnd ? Number.POSITIVE_INFINITY : originalLine.endTime,
		);
		segments[segmentIndex] = { ...word, endTime: clamped };
		if (ownsLineEnd) {
			const otherEnds = words
				.filter((w) => w.id !== word.id)
				.map((w) => w.endTime);
			endTime = Math.max(clamped, ...otherEnds);
		}
	} else {
		const word = segments[segmentIndex + 1] as WordSegment;
		const ownsLineStart = word.startTime === originalLine.startTime;
		const clamped = Math.max(
			Math.min(newTime, word.endTime - MIN_WORD_DURATION_MS),
			ownsLineStart ? 0 : originalLine.startTime,
		);
		segments[segmentIndex + 1] = { ...word, startTime: clamped };
		if (ownsLineStart) {
			const otherStarts = words
				.filter((w) => w.id !== word.id)
				.map((w) => w.startTime);
			startTime = Math.min(clamped, ...otherStarts);
		}
	}

	return { ...originalLine, startTime, endTime, segments };
}

// Gap preview/direction handling adapted from apoint123's upstream ecd0594f (GPLv3).
export function getUpdatedLineForDivider(
	originalLine: ProcessedLyricLine,
	/**
	 * 分割线左侧 segment 的索引
	 *
	 * -1 表示行首
	 */
	segmentIndex: number,
	/**
	 * 拖拽后计算出的新时间戳
	 */
	newTime: number,
	isGapCreation: boolean,
	_zoom?: number,
	lockedGapDirection?: "left" | "right" | null,
	edge: DividerEdge = "shared",
): ProcessedLyricLine {
	if (edge !== "shared") {
		return updateOverlappingEdge(originalLine, segmentIndex, newTime, edge);
	}
	const segments = [...originalLine.segments];
	let newStartTime = originalLine.startTime;
	let newEndTime = originalLine.endTime;

	const leftSegment = segments[segmentIndex] || null;
	const rightSegment = segments[segmentIndex + 1] || null;

	const minTime =
		leftSegment && leftSegment.type === "word"
			? leftSegment.startTime + MIN_WORD_DURATION_MS
			: leftSegment
				? leftSegment.startTime
				: 0;

	const maxTime =
		rightSegment && rightSegment.type === "word"
			? rightSegment.endTime - MIN_WORD_DURATION_MS
			: rightSegment
				? rightSegment.endTime
				: Infinity;

	let clampedTime = newTime;
	if (minTime <= maxTime) {
		clampedTime = Math.max(minTime, clampedTime);
		clampedTime = Math.min(maxTime, clampedTime);
	}
	clampedTime = Math.max(0, clampedTime);

	const newSegments = [...segments];

	if (segmentIndex === -1) {
		if (rightSegment && rightSegment.type === "word") {
			clampedTime = Math.min(
				clampedTime,
				rightSegment.endTime - MIN_WORD_DURATION_MS,
			);
		}
		newStartTime = clampedTime;
		if (rightSegment) {
			newSegments[segmentIndex + 1] = {
				...rightSegment,
				startTime: clampedTime,
			};
		}
	} else if (segmentIndex === segments.length - 1) {
		if (leftSegment && leftSegment.type === "word") {
			clampedTime = Math.max(
				clampedTime,
				leftSegment.startTime + MIN_WORD_DURATION_MS,
			);
		}
		newEndTime = clampedTime;
		if (leftSegment) {
			newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
		}
	} else {
		const originalTime = leftSegment.endTime;
		if (
			isGapCreation &&
			leftSegment.type === "word" &&
			rightSegment.type === "word"
		) {
			if (lockedGapDirection === "right") {
				clampedTime = Math.max(originalTime, clampedTime);
			} else if (lockedGapDirection === "left") {
				clampedTime = Math.min(originalTime, clampedTime);
			}
			if (clampedTime > originalTime) {
				newSegments[segmentIndex + 1] = {
					...rightSegment,
					startTime: clampedTime,
				};
				newSegments.splice(segmentIndex + 1, 0, {
					type: "gap",
					id: `preview-gap-${leftSegment.id}`,
					startTime: originalTime,
					endTime: clampedTime,
				});
			} else if (clampedTime < originalTime) {
				newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
				newSegments.splice(segmentIndex + 1, 0, {
					type: "gap",
					id: `preview-gap-${leftSegment.id}`,
					startTime: clampedTime,
					endTime: originalTime,
				});
			}
		} else {
			newSegments[segmentIndex] = { ...leftSegment, endTime: clampedTime };
			newSegments[segmentIndex + 1] = {
				...rightSegment,
				startTime: clampedTime,
			};
		}
	}

	return {
		...originalLine,
		startTime: newStartTime,
		endTime: newEndTime,
		segments: newSegments,
	};
}

export function commitUpdatedLine(updatedLine: ProcessedLyricLine) {
	const updatedValidSegments = updatedLine.segments.filter(
		(s): s is WordSegment => s.type === "word",
	);

	const updatedWordsMap = new Map<string, WordSegment>();
	for (const segment of updatedValidSegments)
		updatedWordsMap.set(segment.id, segment);

	globalStore.set(lyricLinesAtom, (prev) => {
		// A drag that ends where it started must not add an undo step.
		const current = prev.lyricLines.find((line) => line.id === updatedLine.id);
		if (
			current &&
			current.startTime === updatedLine.startTime &&
			current.endTime === updatedLine.endTime &&
			current.words.every((word) => {
				const updated = updatedWordsMap.get(word.id);
				return (
					!updated ||
					(updated.startTime === word.startTime &&
						updated.endTime === word.endTime)
				);
			})
		)
			return prev;

		const newLines = prev.lyricLines.map((line) => {
			if (line.id !== updatedLine.id) {
				return line;
			}

			const newWords = line.words.map((originalWord) => {
				const updatedWord = updatedWordsMap.get(originalWord.id);
				let nextWord = originalWord;
				if (updatedWord) {
					const { type, ...word } = updatedWord;
					nextWord = word;
				}

				return nextWord;
			});

			return {
				...line,
				startTime: updatedLine.startTime,
				endTime: updatedLine.endTime,
				words: newWords,
			};
		});

		return {
			...prev,
			lyricLines: newLines,
		};
	});
}

export function getUpdatedLineForWordPan(
	processedLine: ProcessedLyricLine,
	wordId: string,
	desiredNewStartMS: number,
	_zoom?: number,
): ProcessedLyricLine {
	const segmentIndex = processedLine.segments.findIndex((s) => s.id === wordId);
	if (segmentIndex === -1) return processedLine;

	const segment = processedLine.segments[segmentIndex];
	if (segment.type !== "word") return processedLine;

	const leftSegment = processedLine.segments[segmentIndex - 1] || null;
	const rightSegment = processedLine.segments[segmentIndex + 1] || null;

	const wordDurationMS = segment.endTime - segment.startTime;

	let minStartMS: number;
	if (!leftSegment) {
		minStartMS = processedLine.startTime;
	} else if (leftSegment.type === "gap") {
		minStartMS = leftSegment.startTime;
	} else {
		minStartMS = leftSegment.startTime + MIN_WORD_DURATION_MS;
	}

	let maxStartMS: number;
	if (!rightSegment) {
		maxStartMS = processedLine.endTime - wordDurationMS;
	} else if (rightSegment.type === "gap") {
		maxStartMS = rightSegment.endTime - wordDurationMS;
	} else {
		maxStartMS = rightSegment.endTime - MIN_WORD_DURATION_MS - wordDurationMS;
	}

	if (minStartMS > maxStartMS) {
		minStartMS = Math.min(minStartMS, maxStartMS);
	}

	let newStartMS = Math.max(minStartMS, desiredNewStartMS);
	newStartMS = Math.min(maxStartMS, newStartMS);
	const newEndMS = newStartMS + wordDurationMS;

	if (Math.round(newStartMS) === Math.round(segment.startTime)) {
		return processedLine;
	}

	const newSegments = [...processedLine.segments];

	newSegments[segmentIndex] = {
		...segment,
		startTime: newStartMS,
		endTime: newEndMS,
	};

	if (leftSegment) {
		newSegments[segmentIndex - 1] = {
			...leftSegment,
			endTime: newStartMS,
		};
	}

	if (rightSegment) {
		newSegments[segmentIndex + 1] = {
			...rightSegment,
			startTime: newEndMS,
		};
	}

	return {
		...processedLine,
		segments: newSegments,
	};
}

export function getUpdatedLineForLinePan(
	processedLine: ProcessedLyricLine,
	newStartMS: number,
): ProcessedLyricLine {
	newStartMS = Math.max(0, newStartMS);

	const deltaMS = newStartMS - processedLine.startTime;

	if (Math.round(deltaMS) === 0) {
		return processedLine;
	}

	const newEndMS = processedLine.endTime + deltaMS;

	const newSegments = processedLine.segments.map((segment) => ({
		...segment,
		startTime: segment.startTime + deltaMS,
		endTime: segment.endTime + deltaMS,
	}));

	return {
		...processedLine,
		startTime: newStartMS,
		endTime: newEndMS,
		segments: newSegments,
	};
}

export function tryInitializeZeroTimestampLine(
	line: Draft<LyricLine>,
	newStartTime: number,
	newEndTime: number,
): boolean {
	const isAllZero =
		line.words.length > 0 &&
		line.words.every((w) => w.startTime === 0 && w.endTime === 0);

	if (isAllZero) {
		line.startTime = newStartTime;
		line.endTime = newEndTime;
		line.words = distributeTime(line.words, newStartTime, newEndTime);
		line.startTime = line.words[0].startTime;
		line.endTime = Math.max(line.startTime, Math.round(newEndTime));
		return true;
	}
	return false;
}

export function tryFixPartialInitialization(line: Draft<LyricLine>): boolean {
	const hasZeroWord = line.words.some(
		(w) => w.startTime === 0 && w.endTime === 0 && w.word.trim() !== "",
	);
	const hasNonZeroWord = line.words.some(
		(w) => w.startTime !== 0 || w.endTime !== 0,
	);

	if (!hasZeroWord || !hasNonZeroWord) {
		return false;
	}

	let didChange = false;

	for (let i = 0; i < line.words.length; i++) {
		const anchorWord = line.words[i];

		if (anchorWord.startTime !== 0 || anchorWord.endTime !== 0) {
			const groupToProcess = [anchorWord];
			let lookaheadIndex = i + 1;

			while (
				lookaheadIndex < line.words.length &&
				line.words[lookaheadIndex].startTime === 0 &&
				line.words[lookaheadIndex].endTime === 0
			) {
				groupToProcess.push(line.words[lookaheadIndex]);
				lookaheadIndex++;
			}

			if (groupToProcess.length > 1) {
				didChange = true;
				if (anchorWord.endTime > anchorWord.startTime) {
					const times = distributeTime(
						groupToProcess,
						anchorWord.startTime,
						anchorWord.endTime,
					);
					groupToProcess.forEach((word, index) => {
						word.startTime = times[index].startTime;
						word.endTime = times[index].endTime;
					});
				}

				i = lookaheadIndex - 1;
			}
		}
	}

	return didChange;
}

export function shiftLineStartTime(
	line: Draft<LyricLine>,
	newStartTime: number,
) {
	const delta = newStartTime - line.startTime;
	if (delta !== 0) {
		line.startTime = newStartTime;
		for (const word of line.words) {
			word.startTime += delta;
			word.endTime += delta;
		}
	}
}

export function adjustLineEndTime(line: Draft<LyricLine>, newEndTime: number) {
	const currentLastWordEnd =
		line.words.length > 0
			? line.words[line.words.length - 1].endTime
			: line.endTime;

	const diff = currentLastWordEnd - newEndTime;

	if (line.words.length === 0) {
		line.endTime = newEndTime;
		return;
	}

	if (diff < 0) {
		line.endTime = newEndTime;
		const lastWord = line.words[line.words.length - 1];
		if (newEndTime > lastWord.startTime) {
			lastWord.endTime = newEndTime;
		}
	} else if (diff > 0) {
		line.endTime = newEndTime;

		const processedLine = processSingleLine(line);

		interface CompressTarget {
			duration: number;
			ref?: Draft<LyricWord>;
		}

		const wordDraftMap = new Map<string, Draft<LyricWord>>();
		for (const w of line.words) {
			wordDraftMap.set(w.id, w);
		}

		const targets: CompressTarget[] = processedLine.segments.map((seg) => ({
			duration: seg.endTime - seg.startTime,
			ref: seg.type === "word" ? wordDraftMap.get(seg.id) : undefined,
		}));

		let remainingReduction = diff;
		const MIN_DURATION = 50;

		for (let i = targets.length - 1; i >= 0; i--) {
			if (remainingReduction <= 0) break;

			const target = targets[i];
			const maxReducible = Math.max(0, target.duration - MIN_DURATION);
			const reduceAmount = Math.min(remainingReduction, maxReducible);

			target.duration -= reduceAmount;
			remainingReduction -= reduceAmount;
		}

		if (remainingReduction > 0) {
			const currentTotalDuration = targets.reduce(
				(sum, t) => sum + t.duration,
				0,
			);
			const targetTotalDuration = currentTotalDuration - remainingReduction;

			if (targetTotalDuration > 0 && currentTotalDuration > 0) {
				const scale = targetTotalDuration / currentTotalDuration;
				for (const target of targets) {
					target.duration *= scale;
				}
			}
		}

		let writeCursor = line.startTime;

		for (const target of targets) {
			if (target.ref) {
				target.ref.startTime = writeCursor;
				target.ref.endTime = writeCursor + target.duration;
			}
			writeCursor += target.duration;
		}
	}
}
