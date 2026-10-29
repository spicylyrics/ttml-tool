import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { routeDroppedFiles } from "./dropped-files";
import { findLinkablePairs, withoutLinkedPaths } from "./linkable-pairs";
import {
	LEGACY_AUTOSAVE_PROJECT_ID,
	pickSessionToResume,
	RESUME_MAX_AGE_MS,
	resumeKey,
} from "./resume-session";
import { lyricToText, textFileName } from "./text-export";

const AUDIO = new Set(["mp3", "flac", "wav", "m4a", "ogg", "opus", "webm"]);

describe("findLinkablePairs", () => {
	it("pairs same-name TTML and audio, ignoring case", () => {
		expect(
			findLinkablePairs(
				["Song A.ttml", "song a.MP3", "Song B.ttml", "cover.jpg", "Other.flac"],
				AUDIO,
			),
		).toEqual([
			{ name: "Song A", lyricFile: "Song A.ttml", audioFile: "song a.MP3" },
		]);
	});

	it("prefers lossless audio when there are several", () => {
		expect(
			findLinkablePairs(["X.ttml", "X.mp3", "X.flac"], AUDIO)[0]?.audioFile,
		).toBe("X.flac");
	});

	it("skips names with two TTMLs and hidden files", () => {
		expect(
			findLinkablePairs(
				["Dup.ttml", "dup.TTML", "Dup.mp3", ".hidden.ttml", ".hidden.mp3"],
				AUDIO,
			),
		).toEqual([]);
	});

	it("drops pairs that are already linked, whatever the slashes", () => {
		const pairs = [
			{ lyricPath: "C:\\Music\\A.ttml" },
			{ lyricPath: "C:\\Music\\B.ttml" },
		];
		expect(withoutLinkedPaths(pairs, ["c:/music/a.ttml"])).toEqual([
			{ lyricPath: "C:\\Music\\B.ttml" },
		]);
	});
});

describe("routeDroppedFiles", () => {
	it("takes the first lyric and the first audio file", () => {
		expect(
			routeDroppedFiles(
				["song.mp3", "notes.txt", "song.ttml", "other.ttml", "b.flac"],
				AUDIO,
			),
		).toEqual({ lyric: 2, audio: 0, ignored: [1, 3, 4] });
	});

	it("handles a drop with only one kind", () => {
		expect(routeDroppedFiles(["a.lrc", "b.LRC"], AUDIO)).toEqual({
			lyric: 0,
			audio: undefined,
			ignored: [1],
		});
	});
});

describe("pickSessionToResume", () => {
	const now = 1_000_000_000_000;
	const session = {
		id: "p1",
		name: "Artist - Song",
		lastModified: now - 1000,
		lineCount: 12,
	};

	it("offers the newest session with lyrics", () => {
		expect(pickSessionToResume([session], { now, answeredKey: null })).toBe(
			session,
		);
	});

	it("skips the legacy archive", () => {
		expect(
			pickSessionToResume(
				[{ ...session, id: LEGACY_AUTOSAVE_PROJECT_ID }, session],
				{ now, answeredKey: null },
			),
		).toBe(session);
	});

	it("doesn't offer empty, old or already answered sessions", () => {
		expect(
			pickSessionToResume([{ ...session, lineCount: 0 }], {
				now,
				answeredKey: null,
			}),
		).toBeNull();
		expect(
			pickSessionToResume(
				[{ ...session, lastModified: now - RESUME_MAX_AGE_MS - 1 }],
				{ now, answeredKey: null },
			),
		).toBeNull();
		expect(
			pickSessionToResume([session], {
				now,
				answeredKey: resumeKey(session),
			}),
		).toBeNull();
		// The same session edited again is offered again.
		expect(
			pickSessionToResume([{ ...session, lastModified: now }], {
				now,
				answeredKey: resumeKey(session),
			}),
		).not.toBeNull();
	});
});

const line = (text: string, extra: Partial<LyricLine> = {}): LyricLine => ({
	...newLyricLine(),
	words: text.split(/(?<= )/).map((word) => ({ ...newLyricWord(), word })),
	...extra,
});

describe("lyricToText", () => {
	const lyric = {
		lyricLines: [
			line("Hello there", { sectionId: "v" }),
			line("oh yeah", { sectionId: "v", isBG: true }),
			line("Second line", { sectionId: "v" }),
			line("Hook", { sectionId: "c" }),
		],
		sections: [
			{ id: "v", label: "[Verse 1]", category: "verse" as const },
			{ id: "c", label: "[Chorus]", category: "chorus" as const },
		],
	};

	it("writes Genius text with headers and bg in parentheses", () => {
		expect(lyricToText(lyric, "genius")).toBe(
			"[Verse 1]\nHello there (oh yeah)\nSecond line\n\n[Chorus]\nHook",
		);
	});

	it("writes plain text without headers", () => {
		expect(lyricToText(lyric, "plain")).toBe(
			"Hello there (oh yeah)\nSecond line\n\nHook",
		);
	});

	it("names the text file after the TTML", () => {
		expect(textFileName("Artist - Song.ttml")).toBe("Artist - Song.txt");
		expect(textFileName("")).toBe("lyrics.txt");
	});
});
