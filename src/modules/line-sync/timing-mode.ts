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

const boundsOf = (start: number, end: number): LyricLine["syncedLineBounds"] =>
	end > start ? { startTime: start, endTime: end } : undefined;

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
		syncedLineBounds: boundsOf(start, end),
		words: line.words.map((word) =>
			isBlank(word) ? word : { ...word, startTime: start, endTime: end },
		),
	};
}

/** Whether any word in the line is timed apart from the line itself. */
export function lineHasWordTimings(line: LyricLine): boolean {
	return line.words.some(
		(word) =>
			!isBlank(word) &&
			word.endTime > word.startTime &&
			(word.startTime !== line.startTime || word.endTime !== line.endTime),
	);
}

/** Whether switching to Line mode would throw away any word timing. */
export function hasWordTimings(lyric: TTMLLyric): boolean {
	return lyric.lyricLines.some(lineHasWordTimings);
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

/** A line stored as one text token, as line-synced TTML and LRC open. */
const isTextBlob = (line: LyricLine) =>
	!!line.isLineSynced && line.words.length === 1;

/**
 * Line → Word: keep the line bounds as synced bounds, split text stored as one
 * token into words, and leave every word untimed. The mode is dropped rather
 * than stored as "word", so a line with one word still exports as line-synced
 * text, the same as before Line mode existed.
 */
export function switchToWordMode(lyric: TTMLLyric): TTMLLyric {
	const { timingMode: _mode, ...rest } = lyric;
	return {
		...rest,
		lyricLines: lyric.lyricLines.map((line) => {
			const words = isTextBlob(line)
				? splitLineText(line.words[0].word, 0, 0)
				: line.words.map((word) => ({ ...word, startTime: 0, endTime: 0 }));
			return {
				...line,
				isLineSynced: words.filter((word) => !isBlank(word)).length <= 1,
				syncedLineBounds: boundsOf(line.startTime, line.endTime),
				words,
			};
		}),
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
			const words = isTextBlob(line)
				? splitLineText(line.words[0].word, line.startTime, line.endTime)
				: line.words;
			return {
				...line,
				words,
				syncedLineBounds: boundsOf(line.startTime, line.endTime),
			};
		}),
	};
}

/** LRC lines carry only line times, so they open in Line mode, split into words. */
export function applyLrcTimingMode(lyric: TTMLLyric): TTMLLyric {
	return restoreLineModeWords(switchToLineMode(lyric));
}

/**
 * Whether R48 applies to the line. The bounds are recorded when they are
 * synced; once the line's start or end is changed any other way (a typed time,
 * a drag, Clear timing), they no longer match and the clamp stops applying.
 */
export function hasSyncedLineBounds(line: LyricLine): boolean {
	const bounds = line.syncedLineBounds;
	return (
		!!bounds &&
		bounds.endTime > bounds.startTime &&
		line.startTime === bounds.startTime &&
		line.endTime === bounds.endTime
	);
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
): TTMLLyric {
	if (prev.lyricLines.length !== next.lyricLines.length) return next;
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
