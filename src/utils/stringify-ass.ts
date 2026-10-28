import type { LyricLine } from "@applemusic-like-lyrics/lyric";

// Standard V4+ columns. Strict readers map fields by these names.
const STYLE_FORMAT =
	"Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding";
const DEFAULT_STYLE =
	"Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,60,60,60,1";
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

/** A line break inside text would end the event early. */
const cleanText = (text: string) => text.replace(/\r\n|\r|\n/g, " ");

function dialogue(start: number, end: number, name: string, text: string) {
	return `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,${name},0,0,0,,${text}`;
}

function karaokeText(line: LyricLine, lineStart: number): string {
	let cursor = toCs(lineStart);
	let text = "";
	for (const word of line.words) {
		const start = toCs(word.startTime);
		// Unsung gap before the word gets its own empty step.
		if (start > cursor) {
			text += `{\\k${start - cursor}}`;
			cursor = start;
		}
		const end = Math.max(cursor, toCs(word.endTime));
		text += `{\\k${end - cursor}}${cleanText(word.word)}`;
		cursor = end;
	}
	return text;
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
		`Style: ${DEFAULT_STYLE}`,
		"",
		"[Events]",
		`Format: ${EVENT_FORMAT}`,
	];
	for (const line of lines) {
		const start = line.words.length
			? Math.min(...line.words.map((w) => w.startTime))
			: line.startTime;
		const end = line.words.length
			? Math.max(...line.words.map((w) => w.endTime))
			: line.endTime;
		const name = `${line.isDuet ? "v2" : "v1"}${line.isBG ? "-bg" : ""}`;
		out.push(dialogue(start, end, name, karaokeText(line, start)));
		if (line.translatedLyric.trim()) {
			out.push(
				dialogue(start, end, `${name}-trans`, cleanText(line.translatedLyric)),
			);
		}
		if (line.romanLyric.trim()) {
			out.push(
				dialogue(start, end, `${name}-roman`, cleanText(line.romanLyric)),
			);
		}
	}
	return `${out.join("\n")}\n`;
}
