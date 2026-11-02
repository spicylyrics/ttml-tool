/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import { stateAt } from "./math";

type TimedLine = {
	startTime: number;
	endTime: number;
	isBackground?: boolean;
	isUntimed?: boolean;
};

/**
 * How far ahead, in lead rows (background rows excluded), the highest active
 * group may look when deciding whether it keeps the scroll anchor.
 */
const PIN_LOOKAHEAD = 2;

/** Background rows belong to the lead above them and are never a scroll target. */
function leadIndexOf(lines: TimedLine[], index: number) {
	let lead = index;
	while (lead > 0 && lines[lead].isBackground) lead--;
	return lead;
}

function groupEndTime(lines: TimedLine[], lead: number) {
	let end = lines[lead].endTime;
	for (let i = lead + 1; i < lines.length && lines[i].isBackground; i++)
		end = Math.max(end, lines[i].endTime);
	return end;
}

function lookaheadLine(lines: TimedLine[], lead: number) {
	let remaining = PIN_LOOKAHEAD;
	for (let i = lead + 1; i < lines.length; i++) {
		if (lines[i].isBackground) continue;
		if (--remaining === 0) return lines[i];
	}
	return null;
}

/** The row Spicy scrolls to: a lead row, chosen from every active group. */
export function findSpicyActiveIndex(lines: TimedLine[], timeMs: number) {
	const active: number[] = [];
	for (let i = 0; i < lines.length; i++)
		if (
			!lines[i].isUntimed &&
			lines[i].startTime <= timeMs &&
			lines[i].endTime >= timeMs
		)
			active.push(i);
	if (active.length === 0) return -1;

	// A background row with another active group below it is a sustained tail
	// of a group already left behind, so it doesn't pull the anchor back up.
	let frontLead = -1;
	for (const index of active)
		frontLead = Math.max(frontLead, leadIndexOf(lines, index));
	const leads: number[] = [];
	for (const index of active) {
		const lead = leadIndexOf(lines, index);
		if (lines[index].isBackground && lead < frontLead) continue;
		if (leads[leads.length - 1] !== lead) leads.push(lead);
	}

	const anchor = leads[0];
	const lookahead = lookaheadLine(lines, anchor);
	if (lookahead === null || groupEndTime(lines, anchor) <= lookahead.startTime)
		return anchor;
	const last = leads[leads.length - 1];
	return last - anchor <= 1 ? anchor : last;
}

export function findSpicyScrollIndex(lines: TimedLine[], timeMs: number) {
	// Past the end, rest on the last timed row. Untimed rows are never a
	// target, so an unsynced tail (or song) doesn't pull the view to the bottom.
	let lastTimed = -1;
	for (let i = lines.length - 1; i >= 0 && lastTimed < 0; i--)
		if (!lines[i].isUntimed) lastTimed = i;
	if (
		lastTimed >= 0 &&
		lines.every((line) => line.isUntimed || timeMs >= line.endTime)
	)
		return lastTimed;
	return findSpicyActiveIndex(lines, timeMs);
}

/**
 * Spicy blurs by distance from the last active row and leaves the blur as it
 * was while nothing is active, so this returns the previous anchor then.
 */
export function findSpicyBlurAnchor(
	lines: TimedLine[],
	timeMs: number,
	previous: number,
) {
	for (let i = lines.length - 1; i >= 0; i--)
		if (stateAt(timeMs, lines[i].startTime, lines[i].endTime) === "active")
			return i;
	return previous;
}
