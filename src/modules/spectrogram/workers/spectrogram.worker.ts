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

			try {
				let pixelData: Uint8Array;
				if (useSerialRenderer) {
					const config = new SerialSpectrogramConfig(
						audioSampleRate,
						FFT_SIZE,
						HOP_LENGTH,
						tileWidthPx,
						height,
						gain,
					);
					pixelData = generateSerialSpectrogramImage(
						audioSlice,
						currentPalette,
						config,
					);
					config.free();
				} else {
					const config = new ThreadedSpectrogramConfig(
						audioSampleRate,
						FFT_SIZE,
						HOP_LENGTH,
						tileWidthPx,
						height,
						gain,
					);
					pixelData = generateThreadedSpectrogramImage(
						audioSlice,
						currentPalette,
						config,
					);
					config.free();
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
