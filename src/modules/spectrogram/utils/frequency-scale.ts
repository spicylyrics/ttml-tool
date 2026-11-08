/**
 * How the spectrogram spreads frequencies over its height. Linear gives every
 * Hz the same room, so voices (roughly 80 Hz to 4 kHz) end up squeezed into
 * the bottom fifth. Log and mel stretch the low end out, like most audio
 * editors do. The renderer draws the chosen scale itself; this module holds
 * the same math for the ruler and the hover readout.
 */
export type FrequencyScale = "linear" | "log" | "mel";

export const FREQUENCY_SCALES: readonly FrequencyScale[] = [
	"linear",
	"log",
	"mel",
];

/** The renderer's code for each scale (its `frequency_scale` argument). */
export const FREQUENCY_SCALE_CODES: Record<FrequencyScale, number> = {
	linear: 0,
	log: 1,
	mel: 2,
};

/**
 * The bottom of the log scale (log can't start at 0 Hz). Nobody sings below
 * about 80 Hz, and starting lower hands a fifth of the height to a few
 * stretched-out FFT bins of rumble. Must match the renderer.
 */
export const LOG_MIN_FREQUENCY = 60;

/** The renderer stops at this frequency, whatever the sample rate. */
const RENDER_MAX_FREQUENCY = 20000;

export function isFrequencyScale(value: unknown): value is FrequencyScale {
	return FREQUENCY_SCALES.includes(value as FrequencyScale);
}

/**
 * How high the spectrogram reaches. Full goes to 20 kHz; Voice stops at
 * 8 kHz, so a singing voice gets nearly the whole height.
 */
export type TopFrequency = "full" | "voice";

export const TOP_FREQUENCIES: readonly TopFrequency[] = ["full", "voice"];

/** The renderer's `max_freq` argument for each setting, in Hz. */
export const TOP_FREQUENCY_LIMITS: Record<TopFrequency, number> = {
	full: RENDER_MAX_FREQUENCY,
	voice: 8000,
};

export function isTopFrequency(value: unknown): value is TopFrequency {
	return TOP_FREQUENCIES.includes(value as TopFrequency);
}

/**
 * The frequency at the top edge of the image: the renderer keeps whole FFT
 * bins up to `maxFrequency` (at most 20 kHz, and never past Nyquist).
 */
export function spectrogramTopFrequency(
	sampleRate: number,
	fftSize: number,
	maxFrequency: number = RENDER_MAX_FREQUENCY,
): number {
	const binWidth = sampleRate / fftSize;
	const limit = Math.max(0, Math.min(RENDER_MAX_FREQUENCY, maxFrequency));
	const bins = Math.min(Math.round(limit / binWidth), fftSize / 2);
	return bins * binWidth;
}

const hzToMel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel: number) => 700 * (10 ** (mel / 2595) - 1);

/**
 * The frequency at height `ratio` (0 = bottom edge, 1 = top edge, which is
 * `top`, see {@link spectrogramTopFrequency}).
 */
export function frequencyAtRatio(
	scale: FrequencyScale,
	ratio: number,
	top: number,
): number {
	const r = Math.max(0, Math.min(1, ratio));
	switch (scale) {
		case "log": {
			const min = Math.min(LOG_MIN_FREQUENCY, top);
			return min * (top / min) ** r;
		}
		case "mel":
			return melToHz(r * hzToMel(top));
		default:
			return r * top;
	}
}

/** Where `frequency` sits on the height, the inverse of {@link frequencyAtRatio}. */
export function ratioAtFrequency(
	scale: FrequencyScale,
	frequency: number,
	top: number,
): number {
	const f = Math.max(0, Math.min(top, frequency));
	let ratio: number;
	switch (scale) {
		case "log": {
			const min = Math.min(LOG_MIN_FREQUENCY, top);
			ratio = f <= min ? 0 : Math.log(f / min) / Math.log(top / min);
			break;
		}
		case "mel":
			ratio = hzToMel(f) / hzToMel(top);
			break;
		default:
			ratio = f / top;
	}
	return Math.max(0, Math.min(1, ratio));
}

const FULL_RULER_LABELS: Record<FrequencyScale, number[]> = {
	linear: [0, 500, 1000, 2000, 5000, 10000, 20000],
	log: [100, 200, 500, 1000, 2000, 5000, 10000],
	mel: [200, 500, 1000, 2000, 4000, 8000, 16000],
};

/** Evenly spaced labels for a top of about 8 kHz (the Voice range). */
const VOICE_RULER_LABELS: Record<FrequencyScale, number[]> = {
	linear: [0, 1000, 2000, 4000, 6000, 8000],
	log: [100, 200, 500, 1000, 2000, 4000, 8000],
	mel: [200, 500, 1000, 2000, 4000, 8000],
};

/** Ruler labels that stay readable on each scale, top first. */
export function frequencyRulerLabels(
	scale: FrequencyScale,
	top: number,
): number[] {
	const labels = (top <= 10000 ? VOICE_RULER_LABELS : FULL_RULER_LABELS)[scale];
	// The top is a whole number of bins, a hair off 20 or 8 kHz; keep that label.
	return labels.filter((f) => f <= top * 1.01).sort((a, b) => b - a);
}
