import type { LyricLine } from "@applemusic-like-lyrics/lyric";
import { describe, expect, it } from "vitest";
import { formatAssTime, stringifyAss } from "./stringify-ass";

const word = (text: string, startTime: number, endTime: number) => ({
	word: text,
	startTime,
	endTime,
	romanWord: "",
});

const line = (overrides: Partial<LyricLine>): LyricLine => ({
	words: [],
	translatedLyric: "",
	romanLyric: "",
	isBG: false,
	isDuet: false,
	startTime: 0,
	endTime: 0,
	...overrides,
});

const sample = [
	line({
		words: [word("Hello ", 1000, 1500), word("world", 1500, 2230)],
		translatedLyric: "Bonjour",
	}),
	line({ words: [word("echo", 2400, 2700)], isBG: true }),
	line({
		words: [
			word("late ", 3_725_000, 3_725_400),
			word("line", 3_725_900, 3_726_000),
		],
		isDuet: true,
		romanLyric: "rom",
	}),
];

describe("formatAssTime", () => {
	it("carries minutes and seconds into hours", () => {
		expect(formatAssTime(0)).toBe("0:00:00.00");
		expect(formatAssTime(2238)).toBe("0:00:02.23");
		expect(formatAssTime(3_726_000)).toBe("1:02:06.00");
	});
});

describe("stringifyAss", () => {
	const out = stringifyAss(sample);
	const rows = out.split("\n");

	it("writes a standard header with Lyrics and Background styles", () => {
		expect(rows.slice(0, 13)).toEqual([
			"[Script Info]",
			"ScriptType: v4.00+",
			"PlayResX: 1920",
			"PlayResY: 1080",
			"WrapStyle: 0",
			"ScaledBorderAndShadow: yes",
			"YCbCr Matrix: None",
			"",
			"[V4+ Styles]",
			"Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
			"Style: Lyrics,Roboto,57,&H00FFFFFF,&H00808080,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,60,60,57,1",
			"Style: Background,Roboto,45,&H00FFFFFF,&H00808080,&H00000000,&H80000000,0,1,0,0,100,100,0,0,1,3,0,8,60,60,57,1",
			"",
		]);
		expect(rows[13]).toBe("[Events]");
		expect(rows[14]).toBe(
			"Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
		);
	});

	it("writes karaoke lines with voice names and gap steps", () => {
		expect(rows.slice(15, -1)).toEqual([
			"Dialogue: 0,0:00:01.00,0:00:02.23,Lyrics,v1,0,0,0,,{\\k50}Hello {\\k73}world",
			"Dialogue: 0,0:00:01.00,0:00:02.23,Lyrics,v1-trans,0,0,0,,Bonjour",
			"Dialogue: 0,0:00:02.40,0:00:02.70,Background,v1-bg,0,0,0,,{\\k30}echo",
			"Dialogue: 0,1:02:05.00,1:02:06.00,Lyrics,v2,0,0,0,,{\\k40}late {\\k50}​{\\k10}line",
			"Dialogue: 0,1:02:05.00,1:02:06.00,Lyrics,v2-roman,0,0,0,,rom",
		]);
		expect(out.endsWith("\n")).toBe(true);
	});

	it("follows the grammar strict ASS readers parse", () => {
		const sections = new Map<string, Map<string, string[][]>>();
		let current: Map<string, string[][]> | undefined;
		for (const row of rows) {
			if (!row.trim() || row.startsWith(";")) continue;
			if (row.startsWith("[") && row.endsWith("]")) {
				current = new Map();
				sections.set(row.slice(1, -1), current);
				continue;
			}
			const match = /^([\w ]+):\s*(.+)$/.exec(row);
			expect(match, row).not.toBeNull();
			expect(current, row).toBeDefined();
			const [, type, rest] = match as RegExpExecArray;
			const items = current?.get(type) ?? [];
			items.push(rest.split(","));
			current?.set(type, items);
		}

		const styles = sections.get("V4+ Styles");
		const events = sections.get("Events");
		expect(sections.has("Script Info")).toBe(true);
		const styleFormat = styles?.get("Format")?.[0].map((f) => f.trim()) ?? [];
		const styleNames = new Set(
			styles?.get("Style")?.map((s) => s[styleFormat.indexOf("Name")]),
		);
		for (const style of styles?.get("Style") ?? []) {
			expect(style).toHaveLength(styleFormat.length);
			for (const col of [
				"PrimaryColour",
				"SecondaryColour",
				"OutlineColour",
				"BackColour",
			]) {
				expect(style[styleFormat.indexOf(col)]).toMatch(/^&H[0-9A-F]{8}$/);
			}
		}

		const format = events?.get("Format")?.[0].map((f) => f.trim()) ?? [];
		expect(format).toContain("Layer");
		for (const fields of events?.get("Dialogue") ?? []) {
			expect(fields.length).toBeGreaterThanOrEqual(format.length);
			for (const col of ["Start", "End"]) {
				const time = /^\d+:(\d\d):(\d\d)\.\d\d$/.exec(
					fields[format.indexOf(col)],
				);
				expect(time).not.toBeNull();
				expect(Number(time?.[1])).toBeLessThan(60);
				expect(Number(time?.[2])).toBeLessThan(60);
			}
			expect(styleNames.has(fields[format.indexOf("Style")])).toBe(true);
		}
	});

	it("keeps line breaks in text from splitting an event", () => {
		const text = stringifyAss([
			line({ words: [word("a\nb", 0, 100)], translatedLyric: "c\r\nd" }),
		]);
		expect(text).toContain("{\\k10}a b");
		expect(text).toContain(",,c d");
	});

	it("ignores untimed space words when timing a line", () => {
		const text = stringifyAss([
			line({
				words: [
					word("Hey,", 36940, 37220),
					word(" ", 0, 0),
					word("Nate", 37220, 37430),
				],
			}),
		]);
		expect(text).toContain(
			"Dialogue: 0,0:00:36.94,0:00:37.43,Lyrics,v1,0,0,0,,{\\k28}Hey, {\\k21}Nate",
		);
	});

	it("keeps braces and backslashes in text from acting as tags", () => {
		const text = stringifyAss([
			line({
				words: [word("{x}", 0, 100)],
				translatedLyric: "a\\Nb \\h",
			}),
		]);
		expect(text).toContain("{\\k10}｛x｝");
		expect(text).toContain(",,a＼Nb ＼h");
	});
});
