import { atom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

export const audioBufferAtom = atom<AudioBuffer | null>(null);
export const volumeAtom = atomWithStorage("volume", 0.5);
export const playbackRateAtom = atomWithStorage("playbackRate", 1);
export const audioPlayingAtom = atom(false);
export const loadedAudioAtom = atom(new Blob([]));
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
export const equalizerGainsAtom = atomWithStorage<number[]>("equalizerGains", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
export const equalizerPresetAtom = atomWithStorage("equalizerPreset", "Flat");

export const EQ_FREQUENCIES = [31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
	"Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
	"Bass Boost": [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
	"Treble Boost": [0, 0, 0, 0, 0, 0, 2, 4, 5, 6],
	"Vocal Boost": [-2, -2, -1, 0, 3, 4, 3, 0, -1, -2],
	"Electronic": [5, 4, 1, 0, -2, 0, 1, 1, 4, 5],
	"Acoustic": [4, 3, 2, 1, 2, 2, 3, 3, 2, 1],
	"Jazz": [4, 3, 1, 2, -2, -2, 0, 1, 3, 4],
	"Pop": [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2],
	"Rock": [5, 3, 1, 0, -1, -1, 1, 2, 4, 5],
};

export const customEqualizerPresetsAtom = atomWithStorage<Record<string, number[]>>("customEqualizerPresets", {});
