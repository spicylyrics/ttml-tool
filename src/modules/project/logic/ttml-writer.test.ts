import { describe, expect, it } from "vitest";
import type { LyricLine } from "../../../types/ttml";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import {
	collectFollowingBackgroundLines,
	getITunesTiming,
	hasExportableLineContent,
	removeEmptyDefaultNamespaces,
	shouldExportAsLineSynced,
} from "./ttml-writer";

function backgroundLine(id: string): LyricLine {
	return { ...newLyricLine(), id, isBG: true };
}

describe("shouldExportAsLineSynced", () => {
	it("keeps a genuine whole-line lyric line-synced", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [{ ...newLyricWord(), word: "Whole line" }];

		expect(shouldExportAsLineSynced(line)).toBe(true);
	});

	it("preserves word timing when a stale line-synced flag has multiple words", () => {
		const line = newLyricLine();
		line.isLineSynced = true;
		line.words = [
			{ ...newLyricWord(), word: "Timed", startTime: 100, endTime: 400 },
			{ ...newLyricWord(), word: " ", startTime: 0, endTime: 0 },
			{ ...newLyricWord(), word: "words", startTime: 400, endTime: 800 },
		];

		expect(shouldExportAsLineSynced(line)).toBe(false);
	});
});

describe("getITunesTiming", () => {
	const line = (
		words: [string, number, number][],
		startTime: number,
		endTime: number,
		isLineSynced = false,
	): LyricLine => ({
		...newLyricLine(),
		startTime,
		endTime,
		isLineSynced,
		words: words.map(([word, start, end]) => ({
			...newLyricWord(),
			word,
			startTime: start,
			endTime: end,
		})),
	});

	it("calls one-word lines synced word by word Word, not Line", () => {
		expect(
			getITunesTiming([
				line([["Yeah", 1000, 1500]], 1000, 1500),
				line([["Hey", 2000, 2500]], 2000, 2500),
			]),
		).toBe("Word");
	});

	it("calls a song of plain-text lines, as LRC opens, Line", () => {
		expect(
			getITunesTiming([
				line([["Whole line", 1000, 2000]], 1000, 2000, true),
				line([["Yeah", 2000, 2500]], 2000, 2500, true),
			]),
		).toBe("Line");
	});

	it("calls it Word as soon as one timed line is written as words", () => {
		expect(
			getITunesTiming([
				line([["Whole line", 1000, 2000]], 1000, 2000, true),
				line([["Yeah", 2000, 2500]], 2000, 2500),
			]),
		).toBe("Word");
	});

	it("calls a song with no timed words None, as before", () => {
		expect(getITunesTiming([line([["Hey", 0, 0]], 1000, 2000)])).toBe("None");
		expect(getITunesTiming([])).toBe("None");
	});
});

describe("collectFollowingBackgroundLines", () => {
	it("collects every consecutive background line when enabled", () => {
		const lines = [
			{ ...newLyricLine(), id: "main" },
			backgroundLine("bg-1"),
			backgroundLine("bg-2"),
			backgroundLine("bg-3"),
			{ ...newLyricLine(), id: "next-main" },
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, true).map((line) => line.id),
		).toEqual(["bg-1", "bg-2", "bg-3"]);
	});

	it("keeps legacy one-line grouping when disabled", () => {
		const lines = [
			{ ...newLyricLine(), id: "main" },
			backgroundLine("bg-1"),
			backgroundLine("bg-2"),
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, false).map((line) => line.id),
		).toEqual(["bg-1"]);
	});

	it("collects the full run after a standalone background line when enabled", () => {
		const lines = [
			backgroundLine("orphan"),
			backgroundLine("bg-2"),
			backgroundLine("bg-3"),
		];
		expect(
			collectFollowingBackgroundLines(lines, 0, true).map((line) => line.id),
		).toEqual(["bg-2", "bg-3"]);
	});
});

describe("hasExportableLineContent", () => {
	it("ignores a completely empty editor line", () => {
		expect(hasExportableLineContent(newLyricLine())).toBe(false);
	});

	it("keeps standalone background lines with content", () => {
		const line = backgroundLine("standalone-bg");
		line.words = [{ ...newLyricWord(), word: "Oh" }];
		expect(hasExportableLineContent(line)).toBe(true);
	});
});

describe("removeEmptyDefaultNamespaces", () => {
	// Captured from WebKitGTK 2.54 (the Linux app's engine) exporting songwriters.
	const webkit =
		'<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head xmlns=""><metadata xmlns=""><ttm:agent xmlns="" type="person" xml:id="v1"/><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters xmlns=""><songwriter xmlns="">Jane Doe</songwriter></songwriters></iTunesMetadata></metadata></head></tt>';
	// What Chromium writes for the same document.
	const chromium =
		'<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/><iTunesMetadata xmlns="http://music.apple.com/lyric-ttml-internal"><songwriters><songwriter>Jane Doe</songwriter></songwriters></iTunesMetadata></metadata></head></tt>';

	it("turns WebKit's output into Chromium's", () => {
		expect(removeEmptyDefaultNamespaces(webkit)).toBe(chromium);
	});

	it("leaves Chromium's output alone", () => {
		expect(removeEmptyDefaultNamespaces(chromium)).toBe(chromium);
	});

	it("never touches lyric text", () => {
		const text = '<span xmlns="">say xmlns="" twice</span>';
		expect(removeEmptyDefaultNamespaces(text)).toBe(
			'<span>say xmlns="" twice</span>',
		);
	});
});
