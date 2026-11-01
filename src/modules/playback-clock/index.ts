import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states";
import { globalStore } from "$/states/store";
import { createPlaybackClock } from "./clock";

/** Public position is in seconds, suitable for an Animate(positionSeconds) API. */
export const playbackClock = createPlaybackClock(audioEngine, {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (id) => cancelAnimationFrame(id),
	now: () => performance.now(),
});

// Keep the existing millisecond atom/API for editor highlights, the overview,
// the playback label and spectrogram. They now receive the very same sample.
globalStore.set(currentTimeAtom, playbackClock.getSnapshot() * 1000);
playbackClock.subscribe((seconds) => {
	globalStore.set(currentTimeAtom, seconds * 1000);
});

if (import.meta.hot) import.meta.hot.dispose(() => playbackClock.dispose());
