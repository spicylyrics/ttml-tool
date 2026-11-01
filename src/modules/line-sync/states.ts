import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { isLineTimedSong } from "./line-timing";

/** Whether the open song exports as line-timed; a primitive, so readers skip edits that don't change it. */
export const songExportsLineTimedAtom = atom((get) =>
	isLineTimedSong(get(lyricLinesAtom).lyricLines),
);
