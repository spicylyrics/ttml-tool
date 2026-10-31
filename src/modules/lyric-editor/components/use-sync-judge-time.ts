import { useStore } from "jotai";
import { useCallback } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { calculateSyncTime } from "$/modules/lyric-editor/utils/sync-timing";
import { syncJudgeModeAtom } from "$/modules/settings/states";
import {
	spectrogramHoverSyncEnabledAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	spectrogramHoverTimeMsAtom,
	spectrogramIsHoveringAtom,
} from "$/modules/spectrogram/states";
import type { KeyBindingEvent } from "$/utils/keybindings";

/**
 * The time a sync key press records: the time under the mouse when syncing at
 * the mouse position over the spectrogram, otherwise the playback time at the
 * press, corrected for the judge mode and offsets.
 */
export function useSyncJudgeTime() {
	const store = useStore();
	return useCallback(
		(evt: KeyBindingEvent, actionOffset = 0) => {
			if (
				store.get(spectrogramHoverSyncEnabledAtom) &&
				store.get(spectrogramIsHoveringAtom)
			) {
				const hoverTimeMs = Math.round(store.get(spectrogramHoverTimeMsAtom));
				if (hoverTimeMs >= 0) return hoverTimeMs;
			}

			return calculateSyncTime({
				audioTimeSeconds: audioEngine.interpolatedCurrentTime,
				playbackRate: audioEngine.musicPlayBackRate,
				isPlaying: audioEngine.musicPlaying,
				event: evt,
				judgeMode: store.get(syncJudgeModeAtom),
				syncTimeOffset: store.get(syncTimeOffsetAtom),
				actionOffset,
				performanceTime: performance.now(),
				performanceTimeOrigin: performance.timeOrigin,
			});
		},
		[store],
	);
}
