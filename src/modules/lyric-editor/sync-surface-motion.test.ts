import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
	readFileSync(new URL(path, import.meta.url), "utf8");

// Nothing on the sync surface may animate: word chips, lines, the playhead's
// word, the spectrogram's handles and the timing overview. A fade here shifts
// what you see away from what you hear. Edit inputs and hover chrome are not
// part of the loop, so they are not checked.
const SYNC_SURFACE_RULES: Record<string, string[]> = {
	"./components/index.module.css": [
		".lyricWord.sync {",
		".wordGroup {",
		".lyricLine {",
		".lyricLineContainer {",
		".lyricWordsContainer {",
		".lyricWord.sync.active {",
	],
	"../spectrogram/components/DividerSegment.module.css": [".dividerLine {"],
	"../spectrogram/components/LyricLineSegment.module.css": [".lineSegment {"],
	"../../components/TimingOverview/index.module.css": [
		".wordPill {",
		".wordGroup {",
	],
};

/** The rule's own declarations, up to the first nested block. */
function ownDeclarations(css: string, selector: string) {
	const at = css.indexOf(selector);
	if (at < 0) return null;
	const body = css.slice(at + selector.length);
	const nested = body.search(/[^;{}]*\{/);
	const close = body.indexOf("}");
	return body.slice(0, nested >= 0 && nested < close ? nested : close);
}

describe("sync surface motion", () => {
	for (const [file, selectors] of Object.entries(SYNC_SURFACE_RULES)) {
		for (const selector of selectors) {
			it(`${selector} in ${file.split("/").pop()} has no transition or animation`, () => {
				const own = ownDeclarations(read(file), selector);
				expect(own, `${selector} not found`).not.toBeNull();
				expect(own).not.toMatch(/transition|animation/);
			});
		}
	}

	it("does not keep the removed glow keyframes", () => {
		const css = read("./components/index.module.css");
		expect(css).not.toContain("highlightBurst");
		expect(css).not.toContain("laneItemFadeIn");
	});
});
