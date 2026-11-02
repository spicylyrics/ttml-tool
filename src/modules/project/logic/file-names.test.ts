import { describe, expect, it } from "vitest";
import { isSafeProjectFileName } from "../folder-project/manifest";
import { resolveProjectName } from "../folder-project/project-naming";
import { sanitizeFileName } from "./file-names";
import { getSuggestedTtmlFileName } from "./metadata-filename";

describe("new file names", () => {
	it.each([
		["CON", "_CON"],
		["nul.ttml", "_nul.ttml"],
		["LPT9.wav", "_LPT9.wav"],
		["COM¹.mp3", "_COM¹.mp3"],
		["project.json", "_project.json"],
		["  Björk / 東京:歌?  ", "Björk _ 東京_歌_"],
		["name...  ", "name"],
		["../a", "_a"],
		["a\u0000b", "a_b"],
		["   ", "Untitled"],
		["...", "Untitled"],
	])("sanitizes %s", (input, expected) => {
		expect(sanitizeFileName(input)).toBe(expected);
		expect(isSafeProjectFileName(sanitizeFileName(input))).toBe(true);
	});

	it("bounds length without leaving trailing dots or half a Unicode character", () => {
		const output = sanitizeFileName(`${"a".repeat(119)}𠮷. `, 120);
		expect(output).toBe("a".repeat(119));
		expect(isSafeProjectFileName(output)).toBe(true);
	});

	it("trims huge dot and space runs from untrusted metadata in linear time", () => {
		// A backtracking /[.\s]+$/ takes minutes on this input.
		const run = ". ".repeat(100_000);
		// Truncation keeps only "a" plus the run, which then trims away.
		expect(sanitizeFileName(`a${run}x`, 120)).toBe("a");
		expect(sanitizeFileName(`${run}name${run}`)).toBe("name");
	});

	it("keeps extensions on long files and repeated metadata sanitization stable", () => {
		const audio = sanitizeFileName(`${"a".repeat(300)}.mp3`);
		expect(audio.length).toBe(240);
		expect(audio.endsWith(".mp3")).toBe(true);
		const suggested = getSuggestedTtmlFileName([
			{ key: "artists", value: ["Artist"] },
			{ key: "musicName", value: ["Song".repeat(80)] },
		]);
		expect(sanitizeFileName(suggested?.fileName ?? "")).toBe(
			suggested?.fileName,
		);
	});

	it("uses the same safe artist-title stem for file and project suggestions", () => {
		const metadata = [
			{ key: "artists", value: [" ", "Björk/東京"] },
			{ key: "musicName", value: ["歌?"] },
		];
		const suggested = getSuggestedTtmlFileName(metadata);
		expect(suggested).toEqual({
			baseName: "Björk_東京 - 歌_",
			fileName: "Björk_東京 - 歌_.ttml",
		});
		expect(resolveProjectName({ metadata }).name).toBe(suggested?.baseName);
		expect(
			getSuggestedTtmlFileName([{ key: "musicName", value: ["Song"] }]),
		).toBeNull();
	});
});
