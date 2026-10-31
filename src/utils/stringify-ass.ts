import type { LyricLine } from "@applemusic-like-lyrics/lyric";

// Standard V4+ columns. Strict readers map fields by these names.
const STYLE_FORMAT =
	"Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding";
// YouTube's own face, sung white over unsung gray. Background vocals are
// smaller, italic and sit at the top.
const LYRICS_STYLE =
	"Lyrics,Roboto,57,&H00FFFFFF,&H00808080,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,60,60,57,1";
const BACKGROUND_STYLE =
	"Background,Roboto,45,&H00FFFFFF,&H00808080,&H00000000,&H80000000,0,1,0,0,100,100,0,0,1,3,0,8,60,60,57,1";
const EVENT_FORMAT =
	"Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text";

/** Milliseconds to centiseconds, truncated like the timestamps. */
const toCs = (ms: number) => Math.max(0, Math.floor(ms / 10));

/** `H:MM:SS.cc`, with minutes and seconds carried below 60. */
export function formatAssTime(ms: number): string {
	const cs = toCs(ms);
	const h = Math.floor(cs / 360000);
	const m = Math.floor(cs / 6000) % 60;
	const s = Math.floor(cs / 100) % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}

/**
 * A line break inside text would end the event early, braces open override
 * blocks and backslashes start \N or \h, so lyric text gets none of them raw.
 */
const cleanText = (text: string) =>
	text
		.replace(/\r\n|\r|\n/g, " ")
		.replace(/\{/g, "｛")
		.replace(/\}/g, "｝")
		.replace(/\\/g, "＼");

function dialogue(
	start: number,
	end: number,
	style: string,
	name: string,
	text: string,
) {
	return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},${style},${name},0,0,0,,${text}`;
}

function karaokeText(line: LyricLine, lineStart: number): string {
	let cursor = toCs(lineStart);
	let text = "";
	for (const word of line.words) {
		// Untimed words (the spaces between words) ride on the step before them.
		if (word.endTime <= 0) {
			text += cleanText(word.word);
			continue;
		}
		const start = toCs(word.startTime);
		// An unsung gap gets its own step. The zero-width space keeps strict
		// readers from dropping a step with no text.
		if (start > cursor) {
			text += `{\\k${start - cursor}}​`;
			cursor = start;
		}
		const end = Math.max(cursor + 1, toCs(word.endTime));
		text += `{\\k${end - cursor}}${cleanText(word.word)}`;
		cursor = end;
	}
	return text.trimEnd();
}

/**
 * Standard Advanced SubStation Alpha with `\k` karaoke. The Name column keeps
 * the voice markers (`v1`, `v2`, `-bg`, `-trans`, `-roman`).
 */
export function stringifyAss(lines: LyricLine[]): string {
	const out = [
		"[Script Info]",
		"ScriptType: v4.00+",
		"PlayResX: 1920",
		"PlayResY: 1080",
		"WrapStyle: 0",
		"ScaledBorderAndShadow: yes",
		"YCbCr Matrix: None",
		"",
		"[V4+ Styles]",
		`Format: ${STYLE_FORMAT}`,
		`Style: ${LYRICS_STYLE}`,
		`Style: ${BACKGROUND_STYLE}`,
		"",
		"[Events]",
		`Format: ${EVENT_FORMAT}`,
	];
	for (const line of lines) {
		// Spaces between words carry no timing (0/0); they must not pull the
		// line's start back to 0:00.
		const timed = line.words.filter((w) => w.endTime > 0);
		const start = timed.length
			? Math.min(...timed.map((w) => w.startTime))
			: line.startTime;
		const end = timed.length
			? Math.max(...timed.map((w) => w.endTime))
			: line.endTime;
		const name = `${line.isDuet ? "v2" : "v1"}${line.isBG ? "-bg" : ""}`;
		const style = line.isBG ? "Background" : "Lyrics";
		out.push(dialogue(start, end, style, name, karaokeText(line, start)));
		if (line.translatedLyric.trim()) {
			out.push(
				dialogue(
					start,
					end,
					style,
					`${name}-trans`,
					cleanText(line.translatedLyric),
				),
			);
		}
		if (line.romanLyric.trim()) {
			out.push(
				dialogue(
					start,
					end,
					style,
					`${name}-roman`,
					cleanText(line.romanLyric),
				),
			);
		}
	}
	return `${out.join("\n")}\n`;
}
