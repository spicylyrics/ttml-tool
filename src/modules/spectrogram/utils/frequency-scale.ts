/**
 * How the spectrogram spreads frequencies over its height. Linear gives every
 * Hz the same room, so voices (roughly 80 Hz to 4 kHz) end up squeezed into
 * the bottom fifth. Log and mel stretch the low end out, like most audio
 * editors do.
 */
export type FrequencyScale = "linear" | "log" | "mel";

export const FREQUENCY_SCALES: readonly FrequencyScale[] = [
	"linear",
	"log",
	"mel",
];

/**
 * The bottom of the log scale (log can't start at 0 Hz). Nobody sings below
 * about 80 Hz, and starting lower hands a fifth of the height to a few
 * stretched-out FFT bins of rumble.
 */
export const LOG_MIN_FREQUENCY = 60;

export function isFrequencyScale(value: unknown): value is FrequencyScale {
	return FREQUENCY_SCALES.includes(value as FrequencyScale);
}

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);

/**
 * The frequency at height `ratio` (0 = bottom edge, 1 = top edge, which is
 * the Nyquist frequency).
 */
export function frequencyAtRatio(
	scale: FrequencyScale,
	ratio: number,
	nyquist: number,
): number {
	const r = Math.max(0, Math.min(1, ratio));
	switch (scale) {
		case "log": {
			const min = Math.min(LOG_MIN_FREQUENCY, nyquist);
			return min * (nyquist / min) ** r;
		}
		case "mel":
			return melToHz(r * hzToMel(nyquist));
		default:
			return r * nyquist;
	}
}

/** Where `frequency` sits on the height, the inverse of {@link frequencyAtRatio}. */
export function ratioAtFrequency(
	scale: FrequencyScale,
	frequency: number,
	nyquist: number,
): number {
	const f = Math.max(0, Math.min(nyquist, frequency));
	let ratio: number;
	switch (scale) {
		case "log": {
			const min = Math.min(LOG_MIN_FREQUENCY, nyquist);
			ratio = f <= min ? 0 : Math.log(f / min) / Math.log(nyquist / min);
			break;
		}
		case "mel":
			ratio = hzToMel(f) / hzToMel(nyquist);
			break;
		default:
			ratio = f / nyquist;
	}
	return Math.max(0, Math.min(1, ratio));
}

/** Ruler labels that stay readable on each scale. */
export function frequencyRulerLabels(
	scale: FrequencyScale,
	nyquist: number,
): number[] {
	const labels =
		scale === "log"
			? [100, 200, 500, 1000, 2000, 5000, 10000]
			: scale === "mel"
				? [200, 500, 1000, 2000, 4000, 8000, 16000]
				: [0, 500, 1000, 2000, 5000, 10000, 20000, nyquist];
	return [...new Set(labels.filter((f) => f <= nyquist))].sort((a, b) => b - a);
}

/**
 * Resamples a linear spectrogram image (RGBA rows, top row = Nyquist, bottom
 * row = 0 Hz) onto another scale. The source should be at least as tall as
 * the FFT has bins, so the stretched low end blends real bins instead of
 * repeating one row.
 */
export function remapSpectrogramRows(
	source: Uint8Array,
	width: number,
	sourceHeight: number,
	targetHeight: number,
	scale: FrequencyScale,
	nyquist: number,
): Uint8Array {
	const rowBytes = width * 4;
	const target = new Uint8Array(rowBytes * targetHeight);
	for (let y = 0; y < targetHeight; y++) {
		const ratio = 1 - (y + 0.5) / targetHeight;
		const frequency = frequencyAtRatio(scale, ratio, nyquist);
		const position = Math.max(
			0,
			Math.min(
				sourceHeight - 1,
				(1 - frequency / nyquist) * sourceHeight - 0.5,
			),
		);
		const upper = Math.floor(position);
		const lower = Math.min(sourceHeight - 1, upper + 1);
		const weight = position - upper;
		const upperOffset = upper * rowBytes;
		const lowerOffset = lower * rowBytes;
		const offset = y * rowBytes;
		for (let i = 0; i < rowBytes; i++) {
			target[offset + i] = Math.round(
				source[upperOffset + i] * (1 - weight) +
					source[lowerOffset + i] * weight,
			);
		}
	}
	return target;
}
