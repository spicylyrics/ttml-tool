/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 * This source code is part of AMLL TTML Tool and is licensed under GPLv3.
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import { type Atom, atom } from "jotai";
import { selectAtom } from "jotai/utils";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";

const lyricLineArrayAtom = atom((get) => get(lyricLinesAtom).lyricLines);
const lyricLinesByIdAtom = atom(
	(get) => new Map(get(lyricLineArrayAtom).map((line) => [line.id, line])),
);

type LineRow = { id: string; lineAtom: Atom<LyricLine> };

const lyricLineRowsAtom = selectAtom(
	lyricLinesByIdAtom,
	(lines, previous: LineRow[] = []) => {
		if (lines.size === previous.length) {
			let index = 0;
			let sameOrder = true;
			for (const id of lines.keys()) {
				if (id !== previous[index++].id) {
					sameOrder = false;
					break;
				}
			}
			if (sameOrder) return previous;
		}
		const existing = new Map(previous.map((row) => [row.id, row]));
		return Array.from(
			lines,
			([id, initialLine]) =>
				existing.get(id) ?? {
					id,
					lineAtom: selectAtom(
						lyricLinesByIdAtom,
						(current, lastLine) => current.get(id) ?? lastLine ?? initialLine,
					),
				},
		);
	},
);

export const lyricLinesOnlyAtom = atom((get) =>
	get(lyricLineRowsAtom).map((row) => row.lineAtom),
);

// Adapted from apoint123's upstream structural subscription fix (eb67dea0).
// Section membership and background status also affect this fork's list layout.
export const lyricLineStructureAtom = selectAtom(
	lyricLinesAtom,
	(state) =>
		state.lyricLines.map(({ id, sectionId, isBG }) => ({
			id,
			sectionId,
			isBG,
		})),
	(prev, next) =>
		prev.length === next.length &&
		prev.every(
			(line, index) =>
				line.id === next[index].id &&
				line.sectionId === next[index].sectionId &&
				line.isBG === next[index].isBG,
		),
);

export const lineDisplayNumbersAtom = atom((get) => {
	let currentNumber = 0;
	return get(lyricLineStructureAtom).map((line, index) => {
		if (index === 0 || !line.isBG) currentNumber++;
		return currentNumber;
	});
});

const GENIUS_HEADER_PATTERN =
	/^\[(Chorus|Verse|Bridge|Intro|Outro|Pre-Chorus|Hook|Strofa|Refren|Skit|Interlude|Instrumental|Pre-Refren|Partea|Slofa|Section|Part|S\d+|V\d+|C\d+|Strophe|Refrain|Pont|Couplet|Refrain|Break).*?\]$/i;

// Edits replace only the lines they touch, so untouched lines answer from here
// instead of re-joining every word in the song on each sync key press.
const geniusHeaderLineCache = new WeakMap<LyricLine, boolean>();

const isGeniusHeaderLine = (line: LyricLine) => {
	let isHeader = geniusHeaderLineCache.get(line);
	if (isHeader === undefined) {
		isHeader = GENIUS_HEADER_PATTERN.test(
			line.words.map((word) => word.word).join(""),
		);
		geniusHeaderLineCache.set(line, isHeader);
	}
	return isHeader;
};

// Header detection must still respond to text edits without subscribing the list
// to every word and timestamp in the document.
export const hasGeniusHeaderAtom = selectAtom(lyricLinesAtom, (state) =>
	state.lyricLines.some(isGeniusHeaderLine),
);
