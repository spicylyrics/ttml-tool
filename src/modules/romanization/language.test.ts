import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { detectSongLanguage, lineLanguage } from "./language";

const line = (text: string): LyricLine => ({
	...newLyricLine(),
	words: [{ ...newLyricWord(), word: text }],
});

describe("song language", () => {
	it("reads kanji-only lines of a Japanese song as Japanese", () => {
		const song = [line("君の名は"), line("今日明日"), line("Oh yeah")];
		expect(detectSongLanguage(song)).toBe("ja");
		expect(lineLanguage("今日明日", "ja")).toBe("ja");
	});

	it("detects Chinese, Korean and nothing", () => {
		expect(detectSongLanguage([line("今天明天"), line("陰天晴天")])).toBe("zh");
		expect(detectSongLanguage([line("사랑해"), line("보고 싶어")])).toBe("ko");
		expect(detectSongLanguage([line("La la la")])).toBeUndefined();
	});

	it("keeps a line's own script in a mixed song", () => {
		expect(lineLanguage("사랑해", "ja")).toBe("ko");
		expect(lineLanguage("ありがとう", "zh")).toBe("ja");
		expect(lineLanguage("我爱你", "yue")).toBe("yue");
		expect(lineLanguage("Lai-la, la-lu", "zh")).toBeUndefined();
	});

	it("lets a Korean song's Han lines read as Chinese", () => {
		expect(detectSongLanguage([line("사랑해"), line("사랑"), line("愛")])).toBe(
			"ko",
		);
		expect(lineLanguage("愛", "ko")).toBe("zh");
	});
});
