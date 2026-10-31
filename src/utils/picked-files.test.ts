import { describe, expect, it } from "vitest";
import { sortPickedFiles } from "./picked-files";

const file = (name: string) => new File([""], name);

describe("sortPickedFiles", () => {
	it("takes one lyric file and one audio file from a mixed pick", () => {
		const picked = sortPickedFiles([file("song.MP3"), file("song.ttml")]);
		expect(picked.lyric?.name).toBe("song.ttml");
		expect(picked.audio?.name).toBe("song.MP3");
		expect(picked.ignored).toBe(0);
	});

	it("counts extra files of either kind as left out", () => {
		const picked = sortPickedFiles([
			file("a.lrc"),
			file("b.ttml"),
			file("a.flac"),
			file("b.wav"),
		]);
		expect(picked.lyric?.name).toBe("a.lrc");
		expect(picked.audio?.name).toBe("a.flac");
		expect(picked.ignored).toBe(2);
	});

	it("handles a pick of only one kind", () => {
		expect(sortPickedFiles([file("x.ogg")])).toEqual({
			lyric: undefined,
			audio: expect.objectContaining({ name: "x.ogg" }),
			ignored: 0,
		});
		expect(sortPickedFiles([file("x.yrc")]).audio).toBeUndefined();
	});
});
