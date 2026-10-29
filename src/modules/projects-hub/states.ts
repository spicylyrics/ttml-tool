import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Feature flag for the projects and files work: the song list and folder scan
 * in Projects, the start screen, the launch resume prompt, dropping TTML and
 * audio together, and the plain and Genius text exports. Off by default.
 */
export const projectsHubEnabledAtom = atomWithStorage(
	"projectsHub.enabled",
	false,
	undefined,
	{ getOnInit: true },
);

export type ProjectsDialogTab =
	| "project"
	| "recent"
	| "linked"
	| "workspace"
	| "songs";

/** Set before opening the Projects window to land on a given tab. */
export const projectsDialogTabRequestAtom = atom<ProjectsDialogTab | null>(
	null,
);

/** The launch resume prompt's last answered session, so it asks once per state. */
export const resumeAnsweredKeyAtom = atomWithStorage<string | null>(
	"projectsHub.resumeAnswered",
	null,
	undefined,
	{ getOnInit: true },
);
