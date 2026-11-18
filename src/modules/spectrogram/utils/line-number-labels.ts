/** Measured chip width for a line number: 12px tabular digits plus padding. */
export const lineNumberChipWidth = (lineNumber: number) =>
	String(lineNumber).length * 8.7 + 6;

/** Space kept between two neighbouring chips. */
const CHIP_GAP_PX = 3;

/**
 * Picks which zoomed-out line bars show their number. A number is centred on
 * its bar and may spill past a narrow bar, but never onto a neighbour's
 * number, so a dense song shows every other line or so and zooming in fills
 * in the rest. Background lines (number 0) never show one.
 */
export function pickNumberedLines(
	lines: readonly { id: string; startTime: number; endTime: number }[],
	zoom: number,
	numberOf: (id: string) => number | undefined,
) {
	const shown = new Set<string>();
	let lastRight = Number.NEGATIVE_INFINITY;
	const ordered = [...lines].sort((a, b) => a.startTime - b.startTime);
	for (const line of ordered) {
		const number = numberOf(line.id);
		if (!number) continue;
		const center = ((line.startTime + line.endTime) / 2000) * zoom;
		const half = lineNumberChipWidth(number) / 2;
		if (center - half < lastRight + CHIP_GAP_PX) continue;
		shown.add(line.id);
		lastRight = center + half;
	}
	return shown;
}
