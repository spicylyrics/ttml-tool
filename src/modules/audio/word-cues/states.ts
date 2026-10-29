import { atomWithMigratedStorage } from "$/modules/settings/states/migrated-storage";

export const showWordTimingCueAtom = atomWithMigratedStorage<boolean>(
	"showWordTimingCue",
	false,
);
export const wordTimingClicksAtom = atomWithMigratedStorage<boolean>(
	"wordTimingClicks",
	false,
);
export type WordTimingCueMode = "word" | "syllable";
export const wordTimingCueModeAtom = atomWithMigratedStorage<WordTimingCueMode>(
	"wordTimingCueMode",
	"syllable",
	{
		normalize: (value) => (value === "word" ? "word" : "syllable"),
	},
);
export const wordTimingClickVolumeAtom = atomWithMigratedStorage<number>(
	"wordTimingClickVolume",
	0.6,
	{
		normalize: (value) =>
			Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.6,
	},
);
