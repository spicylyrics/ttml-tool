/**
 * Tempo estimation from decoded PCM.
 *
 * 1. Downmix to mono and cut the signal into short hops (about 5 ms).
 * 2. Onset strength: the positive change in log energy from one hop to the next.
 * 3. Autocorrelate that envelope over the lags for 60-200 BPM.
 * 4. Weight the lags towards a typical tempo so the octave lands where people
 *    tap along (a 75 BPM half-time feel next to a 150 BPM peak picks 150).
 * 5. Refine the winning lag with a parabola through its neighbours.
 *
 * Pure and synchronous: callers run it in a worker.
 */

export interface BpmEstimate {
	/** Tempo in beats per minute, unrounded. */
	bpm: number;
	/** 0 (no beat found) to 1 (perfectly periodic onsets). */
	confidence: number;
}

export interface EstimateBpmOptions {
	minBpm?: number;
	maxBpm?: number;
	/** Envelope rate in hops per second. */
	envelopeRate?: number;
}

const DEFAULT_MIN_BPM = 60;
const DEFAULT_MAX_BPM = 200;
const DEFAULT_ENVELOPE_RATE = 200;
/** Centre of the octave preference, in BPM. */
const PREFERRED_BPM = 120;
/** Width of the octave preference, in octaves. */
const PREFERENCE_WIDTH = 1.2;

/** Average the channels into one mono signal. */
export function downmix(channels: readonly Float32Array[]): Float32Array {
	if (channels.length === 0) return new Float32Array(0);
	if (channels.length === 1) return channels[0];
	const length = Math.min(...channels.map((c) => c.length));
	const mono = new Float32Array(length);
	const scale = 1 / channels.length;
	for (const channel of channels) {
		for (let i = 0; i < length; i++) mono[i] += channel[i] * scale;
	}
	return mono;
}

/**
 * Onset strength envelope: half-wave rectified difference of log RMS energy
 * per hop. Returns the envelope and its actual rate (hops per second).
 */
export function onsetEnvelope(
	mono: Float32Array,
	sampleRate: number,
	envelopeRate = DEFAULT_ENVELOPE_RATE,
): { envelope: Float32Array; rate: number } {
	const hop = Math.max(1, Math.floor(sampleRate / envelopeRate));
	const frames = Math.floor(mono.length / hop);
	const envelope = new Float32Array(frames);
	let previous = 0;
	for (let f = 0; f < frames; f++) {
		let sum = 0;
		const start = f * hop;
		for (let i = start; i < start + hop; i++) sum += mono[i] * mono[i];
		const level = Math.log1p(1000 * Math.sqrt(sum / hop));
		envelope[f] = f === 0 ? 0 : Math.max(0, level - previous);
		previous = level;
	}
	return { envelope, rate: sampleRate / hop };
}

function autocorrelation(signal: Float32Array, lag: number): number {
	let sum = 0;
	for (let i = lag; i < signal.length; i++) sum += signal[i] * signal[i - lag];
	return sum;
}

/** Estimate the tempo of an onset envelope sampled at `rate` hops per second. */
export function estimateBpmFromEnvelope(
	envelope: Float32Array,
	rate: number,
	options: EstimateBpmOptions = {},
): BpmEstimate | null {
	const minBpm = options.minBpm ?? DEFAULT_MIN_BPM;
	const maxBpm = options.maxBpm ?? DEFAULT_MAX_BPM;
	const minLag = Math.max(1, Math.floor((60 * rate) / maxBpm));
	const maxLag = Math.ceil((60 * rate) / minBpm);
	// Need a few beats at the slowest tempo to say anything.
	if (envelope.length < maxLag * 4) return null;

	let mean = 0;
	for (const v of envelope) mean += v;
	mean /= envelope.length;
	const centred = new Float32Array(envelope.length);
	for (let i = 0; i < envelope.length; i++) centred[i] = envelope[i] - mean;

	const energy = autocorrelation(centred, 0);
	if (!(energy > 0)) return null;

	// One extra lag on each side for the parabolic refinement.
	const first = Math.max(1, minLag - 1);
	const last = maxLag + 1;
	const acf = new Float64Array(last + 1);
	for (let lag = first; lag <= last; lag++) {
		// Normalise for the shrinking overlap so long lags aren't penalised.
		const overlap = centred.length - lag;
		acf[lag] =
			(autocorrelation(centred, lag) / energy) * (centred.length / overlap);
	}

	let bestLag = -1;
	let bestScore = Number.NEGATIVE_INFINITY;
	for (let lag = minLag; lag <= maxLag; lag++) {
		const bpm = (60 * rate) / lag;
		const octaves = Math.log2(bpm / PREFERRED_BPM) / PREFERENCE_WIDTH;
		const score = acf[lag] * Math.exp(-0.5 * octaves * octaves);
		if (score > bestScore) {
			bestScore = score;
			bestLag = lag;
		}
	}
	if (bestLag < 0) return null;

	const a = acf[bestLag - 1];
	const b = acf[bestLag];
	const c = acf[bestLag + 1];
	const curvature = a - 2 * b + c;
	const offset =
		curvature < 0
			? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / curvature))
			: 0;
	const lag = bestLag + offset;

	return {
		bpm: (60 * rate) / lag,
		confidence: Math.max(0, Math.min(1, b)),
	};
}

/** Estimate the tempo of decoded audio channels. */
export function estimateBpm(
	channels: readonly Float32Array[],
	sampleRate: number,
	options: EstimateBpmOptions = {},
): BpmEstimate | null {
	if (!(sampleRate > 0)) return null;
	const mono = downmix(channels);
	const { envelope, rate } = onsetEnvelope(
		mono,
		sampleRate,
		options.envelopeRate,
	);
	return estimateBpmFromEnvelope(envelope, rate, options);
}
