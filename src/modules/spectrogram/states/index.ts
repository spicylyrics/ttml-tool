import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { audioBufferAtom } from "$/modules/audio/states/index.ts";
import {
	type ColorStop,
	generateLutFromStops,
	generatePalette,
	getGrayscaleColor,
	getGreenColor,
	getIcyBlueColor,
} from "$/modules/spectrogram/utils/colors";
import {
	type FrequencyScale,
	frequencyAtRatio,
	isFrequencyScale,
	isTopFrequency,
	spectrogramTopFrequency,
	TOP_FREQUENCY_LIMITS,
	type TopFrequency,
} from "$/modules/spectrogram/utils/frequency-scale";

export const spectrogramGainAtom = atomWithStorage(
	"settings_spectrogramGain",
	3.0,
);
export const spectrogramZoomAtom = atomWithStorage(
	"settings_spectrogramZoom",
	200,
);
export const spectrogramHeightAtom = atomWithStorage(
	"settings_spectrogramHeight",
	256,
);
export const spectrogramScrollLeftAtom = atom(0);
export const pendingTimelineStartTimeAtom = atom<number | null>(null);
export const spectrogramContainerWidthAtom = atom(0);
export const spectrogramFftSizeAtom = atomWithStorage<number>(
	"settings_spectrogramFftSize",
	1024,
);
const storedFrequencyScaleAtom = atomWithStorage<FrequencyScale>(
	"settings_spectrogramFrequencyScale",
	"linear",
	undefined,
	{ getOnInit: true },
);
/** Linear, log or mel frequency axis; an unknown stored value reads as linear. */
export const spectrogramFrequencyScaleAtom = atom(
	(get) => {
		const value = get(storedFrequencyScaleAtom);
		return isFrequencyScale(value) ? value : "linear";
	},
	(_get, set, next: FrequencyScale) => set(storedFrequencyScaleAtom, next),
);
const storedTopFrequencyAtom = atomWithStorage<TopFrequency>(
	"settings_spectrogramTopFrequency",
	"full",
	undefined,
	{ getOnInit: true },
);
/** Full (20 kHz) or Voice (8 kHz) top; an unknown stored value reads as full. */
export const spectrogramTopFrequencyAtom = atom(
	(get) => {
		const value = get(storedTopFrequencyAtom);
		return isTopFrequency(value) ? value : "full";
	},
	(_get, set, next: TopFrequency) => set(storedTopFrequencyAtom, next),
);
/** The frequency at the top edge of the image, for the ruler and hover readout. */
export const spectrogramTopHzAtom = atom((get) => {
	const audioBuffer = get(audioBufferAtom);
	if (!audioBuffer) return 0;
	return spectrogramTopFrequency(
		audioBuffer.sampleRate,
		get(spectrogramFftSizeAtom),
		TOP_FREQUENCY_LIMITS[get(spectrogramTopFrequencyAtom)],
	);
});

const icyBluePalette = {
	id: "icy_blue",
	name: "Icy Blue",
	data: generatePalette(getIcyBlueColor),
};

const grayscalePalette = {
	id: "grayscale",
	name: "Gray Scale",
	data: generatePalette(getGrayscaleColor),
};

const aegisubGreenPalette = {
	id: "aegisub_green",
	name: "Green",
	data: generatePalette(getGreenColor),
};

export const predefinedPalettes = [
	icyBluePalette,
	aegisubGreenPalette,
	grayscalePalette,
];

export const selectedPaletteIdAtom = atomWithStorage<string>(
	"settings_selectedPaletteId",
	"icy_blue",
);

export const customPaletteStopsAtom = atomWithStorage<ColorStop[]>(
	"settings_customPaletteStops",
	[
		{ id: crypto.randomUUID(), pos: 0.0, color: "#000000" },
		{ id: crypto.randomUUID(), pos: 0.5, color: "#ff0000" },
		{ id: crypto.randomUUID(), pos: 1.0, color: "#ffff00" },
	],
);

export const currentPaletteAtom = atom((get) => {
	const selectedId = get(selectedPaletteIdAtom);

	if (selectedId === "custom") {
		const stops = get(customPaletteStopsAtom);

		const paletteId =
			"custom_" +
			stops.map((s) => `${s.pos.toFixed(2)}-${s.color.substring(1)}`).join("-");

		const paletteData = generateLutFromStops(stops);

		return { id: paletteId, name: "custom", data: paletteData };
	}

	const predefined = predefinedPalettes.find((p) => p.id === selectedId);
	if (predefined) {
		return predefined;
	}

	return icyBluePalette;
});

export const spectrogramHoverPxAtom = atom(0);
export const spectrogramHoverPyAtom = atom(0);
export const spectrogramIsHoveringAtom = atom(false);

export const spectrogramHoverTimeMsAtom = atom((get) => {
	const hoverPx = get(spectrogramHoverPxAtom);
	const scrollLeft = get(spectrogramScrollLeftAtom);
	const zoom = get(spectrogramZoomAtom);
	const containerWidth = get(spectrogramContainerWidthAtom);

	if (zoom <= 0) return 0;

	const clampedMouseX = Math.max(0, Math.min(hoverPx, containerWidth));
	const hoverX = scrollLeft + clampedMouseX;
	const hoverTimeS = hoverX / zoom;

	return hoverTimeS * 1000;
});

/** Stand-in for {@link spectrogramHoverTimeMsAtom} while a hook does not need the pointer. */
export const idleHoverTimeMsAtom = atom(0);

export const spectrogramHoverFrequencyAtom = atom((get) => {
	const hoverPy = get(spectrogramHoverPyAtom);
	const height = get(spectrogramHeightAtom);
	const top = get(spectrogramTopHzAtom);

	if (top <= 0 || height <= 0) return 0;

	const ratio = 1 - Math.max(0, Math.min(hoverPy, height)) / height;
	return frequencyAtRatio(get(spectrogramFrequencyScaleAtom), ratio, top);
});

export const spectrogramSelectionAtom = atom<{
	start: number;
	end: number;
} | null>(null);
