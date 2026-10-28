import { atom } from "jotai/index";
import { atomWithStorage, selectAtom } from "jotai/utils";
import { atomWithMigratedStorage } from "$/modules/settings/states/migrated-storage";
import { lyricLinesAtom } from "$/states/main.ts";
import { clampPlaybackRate } from "../utils/playback-rate";

const activeLineIdsBaseAtom = atom((get) => {
	const currentTime = get(currentTimeAtom);
	const lyrics = get(lyricLinesAtom);
	return lyrics.lyricLines
		.filter((l) => currentTime >= l.startTime && currentTime <= l.endTime)
		.map((l) => l.id);
});

export const activeLineIdsAtom = selectAtom(
	activeLineIdsBaseAtom,
	(ids) => ids,
	(a, b) => {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	},
);

export const audioBufferAtom = atom<AudioBuffer | null>(null);
export const volumeAtom = atomWithStorage("volume", 0.5);
export const storedPlaybackRateAtom = atomWithMigratedStorage<number>(
	"playbackRate",
	1,
	{ normalize: clampPlaybackRate },
);
export const playbackRateAtom = atom(
	(get) => clampPlaybackRate(get(storedPlaybackRateAtom)),
	(get, set, next: number | ((previous: number) => number)) => {
		const value =
			typeof next === "function" ? next(get(playbackRateAtom)) : next;
		set(storedPlaybackRateAtom, clampPlaybackRate(value));
	},
);
export const preservesPitchAtom = atomWithStorage("preservesPitch", true);
export const audioPlayingAtom = atom(false);
export const loadedAudioAtom = atom(new Blob([]));
/** Object URL for artwork embedded in the currently loaded audio file. */
export const audioCoverArtAtom = atom<string | null>(null);
export const currentTimeAtom = atom(0);
export const currentDurationAtom = atom(0);
export const auditionTimeAtom = atom<number | null>(null);

export interface AudioTaskState {
	type: AudioTaskType;
	/**
	 * 转码进度，0 ~ 1 之间的浮点数
	 */
	progress: number;
}
export type AudioTaskType = "TRANSCODING" | "LOADING";
export const audioTaskStateAtom = atom<AudioTaskState | null>(null);
export const audioErrorAtom = atom<string | null>(null);

// Equalizer Settings
export const equalizerEnabledAtom = atomWithStorage("equalizerEnabled", false);
export const equalizerGainsAtom = atomWithStorage<number[]>(
	"equalizerGains",
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
);
export const equalizerPresetAtom = atomWithStorage("equalizerPreset", "Flat");

export const EQ_FREQUENCIES = [
	31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
];

export const EQ_PRESETS: Record<string, number[]> = {
	Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	"Bass Boost": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
	"Treble Boost": [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
	"Vocal Boost": [-2, -2, -1, 0, 3, 4, 3, 0, -1, -2],
	Electronic: [5, 4, 1, 0, -2, 0, 1, 1, 4, 5],
	Acoustic: [4, 3, 2, 1, 2, 2, 3, 3, 2, 1],
	Jazz: [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
	Pop: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
	Rock: [5, 3, 1, 0, -1, -1, 1, 2, 4, 5],
};

export const customEqualizerPresetsAtom = atomWithStorage<
	Record<string, number[]>
>("customEqualizerPresets", {});
