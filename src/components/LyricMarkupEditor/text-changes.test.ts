import { describe, expect, it } from "vitest";
import { lineChanges, type TextChange } from "./text-changes";

const applyChanges = (text: string, changes: TextChange[]) =>
	[...changes]
		.reverse()
		.reduce(
			(result, change) =>
				result.slice(0, change.from) + change.insert + result.slice(change.to),
			text,
		);

const roundTrip = (before: string, after: string) => {
	const changes = lineChanges(before, after);
	for (let index = 1; index < changes.length; index++)
		expect(changes[index].from).toBeGreaterThanOrEqual(changes[index - 1].to);
	expect(applyChanges(before, changes)).toBe(after);
	return changes;
};

describe("lineChanges", () => {
	it("returns nothing for equal text", () => {
		expect(lineChanges("a\nb", "a\nb")).toEqual([]);
	});

	it("edits each changed line on its own and leaves the rest alone", () => {
		const before = ["one", "two", "three", "four"].join("\n");
		const after = ["one", "t·wo", "three", "fo·ur"].join("\n");
		const changes = roundTrip(before, after);
		expect(changes).toHaveLength(2);
		expect(changes[0]).toEqual({ from: 5, to: 5, insert: "·" });
	});

	it("handles a line that becomes two", () => {
		roundTrip("a (b)\nc\nd", "a\n<B\nc\nd");
	});

	it("handles added and removed lines at the edges", () => {
		roundTrip("a\nb", "x\na\nb\ny");
		roundTrip("x\na\nb\ny", "a\nb");
		roundTrip("a", "");
		roundTrip("", "a\nb");
	});

	it("still edits line by line when every line changes", () => {
		const before = Array.from({ length: 10 }, (_, i) => `line ${i} (oh)`);
		const after = before.flatMap((_, i) => [`Line ${i}`, `<Oh ${i}`]);
		const changes = roundTrip(before.join("\n"), after.join("\n"));
		expect(changes).toHaveLength(10);
		roundTrip("a\nb\nc", "x\ny\nz\nw");
		roundTrip("a\nb\nc\nd", "x\ny");
	});
});
