import { atomWithStorage } from "jotai/utils";

/**
 * Split text typed into an empty line's "Insert word" field into words, the
 * way the import splits a line. On by default.
 */
export const splitTypedLinesAtom = atomWithStorage(
	"lyricEditor.splitTypedLines",
	true,
	undefined,
	{ getOnInit: true },
);

/** Reopen each project at the line where Edit mode was left. On by default. */
export const editScrollMemoryAtom = atomWithStorage(
	"lyricEditor.editScrollMemory",
	true,
	undefined,
	{ getOnInit: true },
);
