import { useStore } from "jotai";
import { type FC, useCallback, useEffect, useState } from "react";
import { createRepeatThrottle } from "$/modules/audio/utils/seek-step";
import {
	cmdNudgeEarlier,
	cmdNudgeEndEarlier,
	cmdNudgeEndLater,
	cmdNudgeLater,
} from "$/modules/keyboard/commands";
import {
	NUDGE_FINE_STEP_MS,
	NUDGE_SHIFT_FACTOR,
	type NudgeEdge,
	nudgeSelection,
} from "$/modules/lyric-editor/utils/nudge-timing";
import { nudgeStepAtom } from "$/modules/settings/states/sync";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import {
	type KeyBindingEvent,
	registerKeyBindings,
	useKeyBindingAtom,
} from "$/utils/keybindings";

type Speed = "normal" | "coarse" | "fine";

type Nudge = (
	edge: NudgeEdge,
	direction: 1 | -1,
	speed: Speed,
	evt: KeyBindingEvent,
) => void;

/**
 * The start keys move the selected word's start in Time mode and the selected
 * lines in Edit mode; the end keys move the word's end, in Time mode only.
 * Holding a key keeps nudging at the seek repeat rate; Shift moves 10 steps
 * and Alt 1 ms.
 */
export const NudgeKeyBinding: FC = () => {
	const store = useStore();
	const [accept] = useState(() => createRepeatThrottle());

	const nudge = useCallback<Nudge>(
		(edge, direction, speed, evt) => {
			const editMode = store.get(toolModeAtom) === ToolMode.Edit;
			if (edge === "end" && editMode) return;
			if (!accept(evt)) return;
			const step = store.get(nudgeStepAtom);
			const ms =
				speed === "fine"
					? NUDGE_FINE_STEP_MS
					: speed === "coarse"
						? step * NUDGE_SHIFT_FACTOR
						: step;
			// Edit mode moves whole lines, even if Time mode left a word selected.
			const selection = {
				lines: store.get(selectedLinesAtom),
				words: editMode ? new Set<string>() : store.get(selectedWordsAtom),
			};
			store.set(lyricLinesAtom, (doc) =>
				nudgeSelection(doc, selection, direction * ms, edge),
			);
		},
		[accept, store],
	);

	useNudgeKeys(cmdNudgeEarlier.atom, "start", -1, nudge);
	useNudgeKeys(cmdNudgeLater.atom, "start", 1, nudge);
	useNudgeKeys(cmdNudgeEndEarlier.atom, "end", -1, nudge);
	useNudgeKeys(cmdNudgeEndLater.atom, "end", 1, nudge);

	return null;
};

/** One nudge action, plus Shift and Alt versions unless its key already uses them. */
function useNudgeKeys(
	atom: typeof cmdNudgeEarlier.atom,
	edge: NudgeEdge,
	direction: 1 | -1,
	nudge: Nudge,
) {
	const keys = useKeyBindingAtom(
		atom,
		(evt) => nudge(edge, direction, "normal", evt),
		[edge, direction, nudge],
		{ repeat: true },
	);
	// The stored binding is a fresh array on every read; key the effect on its text.
	const joined = keys.join("+");
	useEffect(() => {
		const base = joined ? joined.split("+") : [];
		if (base.length === 0 || base.includes("Shift") || base.includes("Alt"))
			return;
		const unregisterCoarse = registerKeyBindings(
			["Shift", ...base],
			(evt) => nudge(edge, direction, "coarse", evt),
			true,
		);
		const unregisterFine = registerKeyBindings(
			["Alt", ...base],
			(evt) => nudge(edge, direction, "fine", evt),
			true,
		);
		return () => {
			unregisterCoarse();
			unregisterFine();
		};
	}, [joined, edge, direction, nudge]);
}
