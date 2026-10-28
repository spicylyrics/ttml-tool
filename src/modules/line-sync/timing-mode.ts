import {
	type LyricLine,
	type LyricWord,
	newLyricWord,
	type TimingMode,
	type TTMLLyric,
} from "$/types/ttml";

/** Projects saved before line syncing existed have no mode and are word timed. */
export function getTimingMode(
	lyric: Pick<TTMLLyric, "timingMode">,
): TimingMode {
	return lyric.timingMode === "line" ? "line" : "word";
}

const isBlank = (word: LyricWord) => word.word.trim().length === 0;

/** Line mode keeps each word's time equal to its line, like line-synced TTML text. */
export function withLineBounds(
	line: LyricLine,
	start: number,
	end: number,
): LyricLine {
	return {
		...line,
		startTime: start,
		endTime: end,
		isLineSynced: true,
		lineBoundsSynced: end > start,
		words: line.words.map((word) =>
			isBlank(word) ? word : { ...word, startTime: start, endTime: end },
		),
	};
}

/** Whether switching to Line mode would throw away any word timing. */
export function hasWordTimings(lyric: TTMLLyric): boolean {
	return lyric.lyricLines.some((line) =>
		line.words.some(
			(word) =>
				!isBlank(word) &&
				word.endTime > word.startTime &&
				(word.startTime !== line.startTime || word.endTime !== line.endTime),
		),
	);
}

/** Word → Line: keep every word and the line bounds, drop the word timings. */
export function switchToLineMode(lyric: TTMLLyric): TTMLLyric {
	return {
		...lyric,
		timingMode: "line",
		lyricLines: lyric.lyricLines.map((line) => {
			let { startTime, endTime } = line;
			if (!(endTime > startTime)) {
				const timed = line.words.filter(
					(word) => !isBlank(word) && word.endTime > word.startTime,
				);
				if (timed.length > 0) {
					startTime = Math.min(...timed.map((word) => word.startTime));
					endTime = Math.max(...timed.map((word) => word.endTime));
				}
			}
			return withLineBounds(line, startTime, endTime);
		}),
	};
}

/** Line → Word: keep the line bounds as synced bounds, leave every word untimed. */
export function switchToWordMode(lyric: TTMLLyric): TTMLLyric {
	return {
		...lyric,
		timingMode: "word",
		lyricLines: lyric.lyricLines.map((line) => ({
			...line,
			isLineSynced: false,
			lineBoundsSynced: line.endTime > line.startTime,
			words: line.words.map((word) => ({ ...word, startTime: 0, endTime: 0 })),
		})),
	};
}

/** Splits a line-synced text into word and space tokens that all carry the line's time. */
export function splitLineText(
	text: string,
	startTime: number,
	endTime: number,
): LyricWord[] {
	return text
		.split(/(\s+)/)
		.filter((part) => part.length > 0)
		.map((part) => {
			const blank = part.trim().length === 0;
			return {
				...newLyricWord(),
				word: part,
				startTime: blank ? 0 : startTime,
				endTime: blank ? 0 : endTime,
			};
		});
}

/**
 * A Line-mode TTML stores each line as plain text. Split it back into words so
 * switching to Word mode later has words to sync, and mark the bounds as synced.
 */
export function restoreLineModeWords(lyric: TTMLLyric): TTMLLyric {
	if (getTimingMode(lyric) !== "line") return lyric;
	return {
		...lyric,
		lyricLines: lyric.lyricLines.map((line) => {
			const words =
				line.isLineSynced && line.words.length === 1
					? splitLineText(line.words[0].word, line.startTime, line.endTime)
					: line.words;
			return {
				...line,
				words,
				lineBoundsSynced: line.endTime > line.startTime,
			};
		}),
	};
}

/** LRC lines carry only line times, so with the feature on they open in Line mode. */
export function applyLrcTimingMode(
	lyric: TTMLLyric,
	lineSyncEnabled: boolean,
): TTMLLyric {
	if (!lineSyncEnabled) return lyric;
	return switchToLineMode(lyric);
}

export function hasSyncedLineBounds(line: LyricLine): boolean {
	return !!line.lineBoundsSynced && line.endTime > line.startTime;
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * R48: once a line's bounds were synced, word syncing stays inside them. Runs
 * after a word-sync key press: every line the press changed gets its synced
 * bounds back, and every word the press changed is clamped into them. A G on
 * the last word past the line's end therefore ends the word at the line's end
 * and moves on to the next line, whose first word can't start before that
 * line's own start.
 */
export function clampToSyncedLineBounds(
	prev: TTMLLyric,
	next: TTMLLyric,
	active: boolean,
): TTMLLyric {
	if (!active || prev.lyricLines.length !== next.lyricLines.length) return next;
	let lines: LyricLine[] | undefined;
	next.lyricLines.forEach((line, index) => {
		const before = prev.lyricLines[index];
		if (line === before || before.id !== line.id) return;
		if (!hasSyncedLineBounds(before)) return;
		const { startTime: start, endTime: end } = before;
		const words = line.words.map((word, wordIndex) => {
			const old = before.words[wordIndex];
			if (word === old) return word;
			// Only the times this press set; an end still at 0 is unsynced, not early.
			const startTime =
				old && word.startTime === old.startTime
					? word.startTime
					: clamp(word.startTime, start, end);
			const endTime =
				old && word.endTime === old.endTime
					? word.endTime
					: clamp(word.endTime, start, end);
			if (startTime === word.startTime && endTime === word.endTime) return word;
			return { ...word, startTime, endTime };
		});
		lines ??= next.lyricLines.slice();
		lines[index] = { ...line, startTime: start, endTime: end, words };
	});
	return lines ? { ...next, lyricLines: lines } : next;
}
