import { describe, expect, it } from "vitest";
import { lineNumberChipWidth, pickNumberedLines } from "./line-number-labels";

/** `count` lines of 2.4 s every 2.6 s, numbered 1.. in order. */
function song(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		id: `l${i + 1}`,
		startTime: 2000 + i * 2600,
		endTime: 4400 + i * 2600,
	}));
}
const numberOf = (id: string) => Number(id.slice(1));

describe("line number labels", () => {
	it("numbers every line when there's room", () => {
		const shown = pickNumberedLines(song(20), 30, numberOf);
		expect(shown.size).toBe(20);
	});

	it("thins out labels instead of overlapping them when zoomed far out", () => {
		const lines = song(64);
		const zoom = 7.7;
		const shown = pickNumberedLines(lines, zoom, numberOf);
		expect(shown.size).toBeGreaterThan(20);
		expect(shown.size).toBeLessThan(64);
		const chips = lines
			.filter((line) => shown.has(line.id))
			.map((line) => {
				const center = ((line.startTime + line.endTime) / 2000) * zoom;
				const half = lineNumberChipWidth(numberOf(line.id)) / 2;
				return [center - half, center + half];
			});
		for (let i = 1; i < chips.length; i++)
			expect(chips[i][0]).toBeGreaterThan(chips[i - 1][1]);
	});

	it("skips lines without a number, like background vocals", () => {
		const lines = song(3);
		const shown = pickNumberedLines(lines, 30, (id) =>
			id === "l2" ? 0 : numberOf(id),
		);
		expect([...shown]).toEqual(["l1", "l3"]);
	});
});
