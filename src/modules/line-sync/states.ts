import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { getSongTiming } from "./line-timing";

/** How the open song is timed, so how it exports; a primitive, so readers skip edits that don't change it. */
export const songTimingAtom = atom((get) =>
	getSongTiming(get(lyricLinesAtom).lyricLines),
);

/** Whether the open song exports as line-timed. */
export const songExportsLineTimedAtom = atom(
	(get) => get(songTimingAtom) === "line",
);
