import { atom, useAtomValue, type useStore } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import { lyricLinesAtom, projectIdAtom, ToolMode } from "$/states/main.ts";
import { editScrollMemoryAtom } from "../../states/edit-mode-tools";
import {
	type EditScrollAnchor,
	editScrollProjectKey,
	recallEditScroll,
	rememberEditScroll,
} from "./edit-scroll-memory";

const SAVE_DELAY_MS = 400;
const lineCountAtom = atom((get) => get(lyricLinesAtom).lyricLines.length);

// Module level, so switching tabs (which remounts the view) doesn't count as
// reopening the project.
let restoredProjectKey: string | null = null;

export interface EditScrollMemory {
	/** Called with the line at the view's center whenever it is measured. */
	noteAnchor: (lineIndex: number) => void;
	/**
	 * The remembered line for a project the Edit view hasn't shown yet in this
	 * session, or -1. Claiming it marks the project as restored.
	 */
	claimRestore: () => number;
}

/**
 * With the setting on, keep each project's Edit-mode position across app
 * restarts and project switches. Off, or outside Edit mode, it does nothing.
 */
export function useEditScrollMemory({
	store,
	toolMode,
	scrollToLineIndex,
}: {
	store: ReturnType<typeof useStore>;
	toolMode: ToolMode;
	scrollToLineIndex: (index: number, smooth?: boolean) => void;
}): EditScrollMemory {
	const enabled =
		useAtomValue(editScrollMemoryAtom) && toolMode === ToolMode.Edit;
	const projectDir = useAtomValue(activeProjectDirAtom);
	const projectId = useAtomValue(projectIdAtom);
	const lineCount = useAtomValue(lineCountAtom);
	const key = editScrollProjectKey(projectDir, projectId);

	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;
	const scrollRef = useRef(scrollToLineIndex);
	scrollRef.current = scrollToLineIndex;
	const pendingRef = useRef<{ key: string; anchor: EditScrollAnchor } | null>(
		null,
	);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const currentKey = useCallback(
		() =>
			editScrollProjectKey(
				store.get(activeProjectDirAtom),
				store.get(projectIdAtom),
			),
		[store],
	);

	const flush = useCallback(() => {
		if (timerRef.current !== null) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		const pending = pendingRef.current;
		pendingRef.current = null;
		if (pending) rememberEditScroll(pending.key, pending.anchor);
	}, []);

	const noteAnchor = useCallback(
		(lineIndex: number) => {
			if (!enabledRef.current) return;
			const projectKey = currentKey();
			// Until the saved spot is restored, the view's position isn't the user's.
			if (restoredProjectKey !== projectKey) return;
			// Read the id now: by the time this is saved, lines may have moved.
			const id = store.get(lyricLinesAtom).lyricLines[lineIndex]?.id;
			pendingRef.current = {
				key: projectKey,
				anchor: { id, index: lineIndex },
			};
			timerRef.current ??= setTimeout(flush, SAVE_DELAY_MS);
		},
		[currentKey, flush, store],
	);

	const claimRestore = useCallback(() => {
		if (!enabledRef.current) return -1;
		const lines = store.get(lyricLinesAtom).lyricLines;
		const projectKey = currentKey();
		if (lines.length === 0 || restoredProjectKey === projectKey) return -1;
		flush();
		restoredProjectKey = projectKey;
		return recallEditScroll(
			projectKey,
			lines.map((line) => line.id),
		);
	}, [currentKey, flush, store]);

	// A project opened while the view is already showing.
	useEffect(() => {
		if (!enabled || lineCount === 0 || restoredProjectKey === key) return;
		const line = claimRestore();
		if (line === -1) return;
		// Let the new lines render before scrolling to one of them.
		requestAnimationFrame(() =>
			requestAnimationFrame(() => scrollRef.current(line)),
		);
	}, [enabled, key, lineCount, claimRestore]);

	useEffect(() => {
		if (!enabled) return;
		window.addEventListener("pagehide", flush);
		window.addEventListener("beforeunload", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			window.removeEventListener("beforeunload", flush);
			flush();
		};
	}, [enabled, flush]);

	return { noteAnchor, claimRestore };
}
