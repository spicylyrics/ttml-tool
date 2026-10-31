// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	folderOf,
	lastFolder,
	rememberPick,
	savePathFor,
} from "./dialog-folders";

// Node 26's own global localStorage can be unusable in tests; use an in-memory one.
const data = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
	configurable: true,
	value: {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		clear: () => data.clear(),
	},
});

beforeEach(() => data.clear());

describe("folderOf", () => {
	it("returns the folder of a Windows or macOS path", () => {
		expect(folderOf("C:\\Music\\Album\\song.mp3")).toBe("C:\\Music\\Album");
		expect(folderOf("/Users/me/Lyrics/song.ttml")).toBe("/Users/me/Lyrics");
	});

	it("keeps a root's separator", () => {
		expect(folderOf("C:\\song.mp3")).toBe("C:\\");
		expect(folderOf("/song.mp3")).toBe("/");
	});
});

describe("remembered dialog folders", () => {
	it("keeps a separate folder for each place", () => {
		rememberPick("loadAudio", "C:\\Music\\a.mp3");
		rememberPick("openFile", ["D:\\Lyrics\\b.ttml", "D:\\Lyrics\\c.mp3"]);
		expect(lastFolder("loadAudio")).toBe("C:\\Music");
		expect(lastFolder("openFile")).toBe("D:\\Lyrics");
		expect(lastFolder("timeStretchAudio")).toBeUndefined();
	});

	it("remembers a picked folder's parent", () => {
		rememberPick("workspace", "/Users/me/Projects/Workspace");
		expect(lastFolder("workspace")).toBe("/Users/me/Projects");
	});

	it("ignores an empty pick", () => {
		rememberPick("loadAudio", "C:\\Music\\a.mp3");
		rememberPick("loadAudio", null);
		rememberPick("loadAudio", []);
		expect(lastFolder("loadAudio")).toBe("C:\\Music");
	});

	it("builds a save path in the remembered folder", () => {
		expect(savePathFor("linkLyrics", "Song.ttml")).toBe("Song.ttml");
		rememberPick("linkLyrics", "C:\\Lyrics\\old.ttml");
		expect(savePathFor("linkLyrics", "Song.ttml")).toBe(
			"C:\\Lyrics\\Song.ttml",
		);
	});

	it("survives broken stored data", () => {
		data.set("fileDialog.lastFolders", "{not json");
		expect(lastFolder("loadAudio")).toBeUndefined();
		rememberPick("loadAudio", "/a/b.mp3");
		expect(lastFolder("loadAudio")).toBe("/a");
	});
});
