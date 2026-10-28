import { describe, expect, it } from "vitest";
import {
	type DetectorLine,
	decideHint,
	type EditorSnapshot,
	initialRepeatedSectionState,
	initialSplitTripState,
	isLineTimed,
	normalizeLineText,
	type RepeatedSectionState,
	type SplitTripState,
	stepRepeatedSection,
	stepSplitTrip,
} from "./detectors";

const line = (
	id: string,
	text: string,
	times: (readonly [number, number])[] = [],
): DetectorLine => ({
	id,
	words: text.split(" ").map((word, i) => ({
		word: i === 0 ? word : ` ${word}`,
		startTime: times[i]?.[0] ?? 0,
		endTime: times[i]?.[1] ?? 0,
	})),
});

const timed = (id: string, text: string, start = 1000) =>
	line(
		id,
		text,
		text.split(" ").map((_, i) => [start + i * 100, start + i * 100 + 90]),
	);

/** Times the first `count` words of line `index`, like sync keypresses do. */
const syncWords = (
	lines: readonly DetectorLine[],
	index: number,
	count: number,
): DetectorLine[] =>
	lines.map((l, i) =>
		i === index
			? {
					...l,
					words: l.words.map((w, j) =>
						j < count
							? {
									...w,
									startTime: 5000 + j * 100,
									endTime: 5000 + j * 100 + 90,
								}
							: w,
					),
				}
			: l,
	);

const snap = (
	mode: string,
	lines: readonly DetectorLine[],
): EditorSnapshot => ({
	mode,
	lines,
});

/** Runs a list of snapshots through the repeated-section detector. */
const runRepeated = (snapshots: EditorSnapshot[]) => {
	let state: RepeatedSectionState = initialRepeatedSectionState();
	let fired = false;
	for (let i = 1; i < snapshots.length; i++) {
		const result = stepRepeatedSection(state, snapshots[i - 1], snapshots[i]);
		state = result.state;
		fired ||= result.fire;
	}
	return { state, fired };
};

const chorus = ["we will rock you", "sing it out loud", "one more time"];

/** Earlier chorus timed, later copy untimed. */
const songWithRepeat = (): DetectorLine[] => [
	...chorus.map((text, i) => timed(`a${i}`, text, 1000 + i * 1000)),
	line("verse", "something in between"),
	...chorus.map((text, i) => line(`b${i}`, text)),
];

/** Syncs every word of the given lines one keypress at a time. */
const syncByHand = (start: DetectorLine[], indexes: number[]) => {
	const snapshots = [snap("sync", start)];
	let lines = start;
	for (const index of indexes) {
		for (let n = 1; n <= lines[index].words.length; n++) {
			lines = syncWords(lines, index, n);
			snapshots.push(snap("sync", lines));
		}
	}
	return snapshots;
};

describe("normalizeLineText", () => {
	it("ignores case, punctuation and spacing", () => {
		expect(normalizeLineText(line("x", "We  will, ROCK you!"))).toBe(
			"we will rock you",
		);
	});
});

describe("isLineTimed", () => {
	it("needs every word with text to have an end time", () => {
		expect(isLineTimed(timed("x", "a b"))).toBe(true);
		expect(isLineTimed(line("x", "a b", [[100, 200]]))).toBe(false);
		expect(isLineTimed(line("x", " "))).toBe(false);
	});
});

describe("stepRepeatedSection", () => {
	it("fires after three repeated lines are synced by hand", () => {
		const { fired, state } = runRepeated(
			syncByHand(songWithRepeat(), [4, 5, 6]),
		);
		expect(state.counted.size).toBe(3);
		expect(fired).toBe(true);
	});

	it("stays quiet after only two", () => {
		expect(runRepeated(syncByHand(songWithRepeat(), [4, 5])).fired).toBe(false);
	});

	it("ignores lines that don't repeat an earlier timed line", () => {
		const lines = songWithRepeat();
		// Untime the earlier chorus: nothing to copy from.
		const untimed = lines.map((l) =>
			l.id.startsWith("a") ? line(l.id, normalizeLineText(l)) : l,
		);
		expect(runRepeated(syncByHand(untimed, [4, 5, 6])).fired).toBe(false);
	});

	it("doesn't count the verse line between choruses", () => {
		const { state } = runRepeated(syncByHand(songWithRepeat(), [3]));
		expect(state.counted.size).toBe(0);
	});

	it("ignores bulk edits that retime many lines at once", () => {
		const start = songWithRepeat();
		let lines = start;
		for (const index of [4, 5, 6])
			lines = syncWords(lines, index, lines[index].words.length);
		// One update touching three lines, then a second identical-shaped one.
		const shifted = lines.map((l, i) =>
			i >= 4
				? {
						...l,
						words: l.words.map((w) => ({
							...w,
							startTime: w.startTime + 10,
							endTime: w.endTime + 10,
						})),
					}
				: l,
		);
		expect(
			runRepeated([
				snap("sync", start),
				snap("sync", lines),
				snap("sync", shifted),
			]).fired,
		).toBe(false);
	});

	it("doesn't count a line timed in one go, like Duplicate at playhead", () => {
		const start = songWithRepeat();
		const snapshots = [snap("sync", start)];
		let lines = start;
		for (const index of [4, 5, 6]) {
			lines = syncWords(lines, index, lines[index].words.length);
			snapshots.push(snap("sync", lines));
		}
		expect(runRepeated(snapshots).state.counted.size).toBe(0);
	});

	it("ignores inserted or removed lines", () => {
		const start = songWithRepeat();
		const inserted = [...start, timed("c0", chorus[0])];
		expect(
			stepRepeatedSection(
				initialRepeatedSectionState(),
				snap("sync", start),
				snap("sync", inserted),
			).state.edits.size,
		).toBe(0);
	});

	it("only listens in Time mode", () => {
		const snapshots = syncByHand(songWithRepeat(), [4, 5, 6]).map((s) =>
			snap("edit", s.lines),
		);
		expect(runRepeated(snapshots).fired).toBe(false);
	});

	it("skips one-word lines", () => {
		const start = [timed("a", "yeah"), line("b", "yeah")];
		expect(runRepeated(syncByHand(start, [1])).state.counted.size).toBe(0);
	});
});

describe("stepSplitTrip", () => {
	const words = [line("l1", "hello world"), line("l2", "another line")];
	const split: DetectorLine[] = [
		{
			id: "l1",
			words: [
				{ word: "hel", startTime: 0, endTime: 0 },
				{ word: "lo", startTime: 0, endTime: 0 },
				{ word: " world", startTime: 0, endTime: 0 },
			],
		},
		words[1],
	];

	const run = (snapshots: EditorSnapshot[]) => {
		let state: SplitTripState = initialSplitTripState();
		let fired = false;
		for (let i = 1; i < snapshots.length; i++) {
			const result = stepSplitTrip(state, snapshots[i - 1], snapshots[i]);
			state = result.state;
			fired ||= result.fire;
		}
		return { state, fired };
	};

	const trip = (before: DetectorLine[], after: DetectorLine[]) => [
		snap("sync", before),
		snap("edit", before),
		snap("edit", after),
		snap("sync", after),
	];

	it("fires on the second Time > Edit > split > Time round trip", () => {
		const once = run(trip(words, split));
		expect(once.state.trips).toBe(1);
		expect(once.fired).toBe(false);
		const twice = run([...trip(words, split), ...trip(words, split)]);
		expect(twice.fired).toBe(true);
	});

	it("ignores trips with no split", () => {
		const renamed = [line("l1", "hello there"), words[1]];
		expect(run([...trip(words, renamed), ...trip(words, renamed)]).fired).toBe(
			false,
		);
	});

	it("ignores splits made while starting in Edit mode", () => {
		const snapshots = [
			snap("edit", words),
			snap("edit", split),
			snap("sync", split),
			snap("edit", words),
			snap("edit", split),
			snap("sync", split),
		];
		expect(run(snapshots).state.trips).toBe(1);
	});

	it("resets when leaving Edit for Preview", () => {
		const snapshots = [
			snap("sync", words),
			snap("edit", words),
			snap("edit", split),
			snap("preview", split),
			snap("sync", split),
		];
		expect(run(snapshots).state.trips).toBe(0);
	});
});

describe("decideHint", () => {
	const gate = {
		enabled: true,
		shown: [] as string[],
		shownThisSession: false,
		syncing: false,
	};

	it("shows when nothing blocks it", () => {
		expect(decideHint("repeatedSection", gate)).toBe("show");
	});

	it("waits while syncing", () => {
		expect(decideHint("repeatedSection", { ...gate, syncing: true })).toBe(
			"defer",
		);
	});

	it("drops when off, already shown, or one already showed this session", () => {
		expect(decideHint("repeatedSection", { ...gate, enabled: false })).toBe(
			"drop",
		);
		expect(
			decideHint("repeatedSection", { ...gate, shown: ["repeatedSection"] }),
		).toBe("drop");
		expect(
			decideHint("splitInTimeMode", { ...gate, shownThisSession: true }),
		).toBe("drop");
	});
});
