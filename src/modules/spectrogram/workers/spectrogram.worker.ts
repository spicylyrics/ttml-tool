import { remapSpectrogramRows } from "$/modules/spectrogram/utils/frequency-scale";
import initThreaded, {
	generate_spectrogram_image as generateThreadedSpectrogramImage,
	initThreadPool,
	SpectrogramConfig as ThreadedSpectrogramConfig,
} from "$/modules/spectrogram/vendor";
import initSerial, {
	generate_spectrogram_image as generateSerialSpectrogramImage,
	SpectrogramConfig as SerialSpectrogramConfig,
} from "$/modules/spectrogram/vendor/serial/wasm_spectrogram";
import type { SpectrogramWorkerScope } from "$/modules/spectrogram/workers/types";

/** Tallest linear image drawn before resampling to log or mel. */
const MAX_RENDER_HEIGHT = 2048;
/** FFT for the low end of log and mel views (about 11 Hz bins at 44.1 kHz). */
const LOW_BAND_FFT = 4096;
/** Below `fromHz` the low-end image is used alone; up to `toHz` it fades out. */
const LOW_BAND_CROSSOVER = { fromHz: 500, toHz: 1000 };

const ctx: SpectrogramWorkerScope = self as SpectrogramWorkerScope;

let fullAudioData: Float32Array | null = null;
let audioSampleRate: number = 0;
let wasmInitialized: Promise<void> | null = null;
let currentPalette: Uint8Array | null = null;

let useSerialRenderer =
	Boolean(import.meta.env.TAURI_ENV_PLATFORM) ||
	!globalThis.crossOriginIsolated ||
	typeof SharedArrayBuffer === "undefined";
let scratchCanvas: OffscreenCanvas | null = null;

async function initializeWasm() {
	if (!wasmInitialized) {
		wasmInitialized = (async () => {
			if (useSerialRenderer) {
				await initSerial();
				return;
			}

			try {
				await initThreaded();
				await initThreadPool(
					Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 2)),
				);
			} catch {
				useSerialRenderer = true;
				await initSerial();
			}
		})();
	}
	await wasmInitialized;
}

ctx.onmessage = async (event) => {
	try {
		await initializeWasm();
	} catch (error) {
		ctx.postMessage({
			type: "FATAL_ERROR",
			message: error instanceof Error ? error.message : String(error),
		});
		return;
	}

	const msg = event.data;

	switch (msg.type) {
		case "INIT":
			fullAudioData = msg.audioData;
			audioSampleRate = msg.sampleRate;
			ctx.postMessage({ type: "INIT_COMPLETE", generation: msg.generation });
			break;
		case "SET_PALETTE":
			currentPalette = msg.palette;
			break;
		case "GET_TILE": {
			const { reqId, params } = msg;

			if (!fullAudioData || !audioSampleRate || !currentPalette) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Worker not ready",
				});
				return;
			}

			const { startTime, endTime, gain, tileWidthPx, height, fftSize } = params;
			const scale = params.frequencyScale ?? "linear";

			const startSample = Math.floor(startTime * audioSampleRate);
			const endSample = Math.ceil(endTime * audioSampleRate);

			if (startSample >= fullAudioData.length) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: "Out of bounds",
				});
				return;
			}
			const audioSlice = fullAudioData.subarray(
				startSample,
				Math.min(endSample, fullAudioData.length),
			);

			const FFT_SIZE = fftSize || 1024;
			const HOP_LENGTH = 64;
			const palette = currentPalette;
			const render = (fft: number, hop: number, rows: number) => {
				const Config = useSerialRenderer
					? SerialSpectrogramConfig
					: ThreadedSpectrogramConfig;
				const generate = useSerialRenderer
					? generateSerialSpectrogramImage
					: generateThreadedSpectrogramImage;
				const config = new Config(
					audioSampleRate,
					fft,
					hop,
					tileWidthPx,
					rows,
					gain,
				);
				try {
					return generate(audioSlice, palette, config);
				} finally {
					config.free();
				}
			};
			// The renderer draws a linear axis. For log or mel, draw it at least one
			// row per FFT bin, then resample the rows onto the chosen scale.
			const rowsFor = (fft: number) =>
				Math.max(height, Math.min(MAX_RENDER_HEIGHT, fft / 2));

			try {
				let pixelData: Uint8Array;
				if (scale === "linear") {
					pixelData = render(FFT_SIZE, HOP_LENGTH, height);
				} else {
					const nyquist = audioSampleRate / 2;
					const main = render(FFT_SIZE, HOP_LENGTH, rowsFor(FFT_SIZE));
					// Log and mel give the bottom octaves most of the height, where a
					// small FFT has only a few bins. Draw the low end again with a long
					// FFT (bass notes are slow, so its coarser timing doesn't show).
					const lowBand =
						FFT_SIZE < LOW_BAND_FFT
							? {
									source: render(
										LOW_BAND_FFT,
										LOW_BAND_FFT / 16,
										rowsFor(LOW_BAND_FFT),
									),
									height: rowsFor(LOW_BAND_FFT),
									...LOW_BAND_CROSSOVER,
								}
							: undefined;
					pixelData = remapSpectrogramRows(
						main,
						tileWidthPx,
						rowsFor(FFT_SIZE),
						height,
						scale,
						nyquist,
						lowBand,
					);
				}

				scratchCanvas ??= new OffscreenCanvas(tileWidthPx, height);
				const canvas = scratchCanvas;
				if (canvas.width !== tileWidthPx) canvas.width = tileWidthPx;
				if (canvas.height !== height) canvas.height = height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("OffscreenCanvas context 失败");

				const imageData = new ImageData(
					new Uint8ClampedArray(
						pixelData.buffer as ArrayBuffer,
						pixelData.byteOffset,
						pixelData.byteLength,
					),
					tileWidthPx,
					height,
				);
				context.putImageData(imageData, 0, 0);

				const imageBitmap = canvas.transferToImageBitmap();
				ctx.postMessage(
					{
						type: "TILE_READY",
						reqId,
						imageBitmap,
					},
					[imageBitmap],
				);
			} catch (e) {
				ctx.postMessage({
					type: "ERROR",
					reqId,
					message: (e as Error).message,
				});
			}
			break;
		}
	}
};
