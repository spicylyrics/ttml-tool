import type { createStore } from "jotai";
import type { TTMLLyric } from "$/types/ttml";
import { lineSyncEnabledAtom } from "./states";
import { clampToSyncedLineBounds } from "./timing-mode";

/** Word-sync keys pass their result through this so R48 applies only with the feature on. */
export function keepInSyncedLineBounds(
	store: ReturnType<typeof createStore>,
	prev: TTMLLyric,
	next: TTMLLyric,
): TTMLLyric {
	return clampToSyncedLineBounds(prev, next, store.get(lineSyncEnabledAtom));
}
