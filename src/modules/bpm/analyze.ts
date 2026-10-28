import type { BpmWorkerRequest } from "./bpm.worker";
import { type BpmEstimate, estimateBpm } from "./estimate-bpm";

/** Below this the readout stays hidden: the guess is no better than noise. */
export const MIN_BPM_CONFIDENCE = 0.3;

/** The rounded tempo to show, or null when the estimate isn't trustworthy. */
export function displayBpm(estimate: BpmEstimate | null): number | null {
	if (!estimate || estimate.confidence < MIN_BPM_CONFIDENCE) return null;
	return Math.round(estimate.bpm);
}

const cache = new WeakMap<AudioBuffer, Promise<BpmEstimate | null>>();

function runInWorker(request: BpmWorkerRequest): Promise<BpmEstimate | null> {
	return new Promise((resolve) => {
		const worker = new Worker(new URL("./bpm.worker.ts", import.meta.url), {
			type: "module",
		});
		const finish = (result: BpmEstimate | null) => {
			worker.terminate();
			resolve(result);
		};
		worker.onmessage = (event: MessageEvent<BpmEstimate | null>) =>
			finish(event.data);
		worker.onerror = () => finish(null);
		// The channels are already copies, so hand them over instead of cloning.
		worker.postMessage(
			request,
			request.channels.map((channel) => channel.buffer),
		);
	});
}

/**
 * Estimate the tempo of decoded audio off the main thread, once per buffer.
 * Falls back to an idle-time run where workers aren't available.
 */
export function analyzeBpm(buffer: AudioBuffer): Promise<BpmEstimate | null> {
	const cached = cache.get(buffer);
	if (cached) return cached;
	// Copies, so the buffer the player uses is never detached.
	const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
		buffer.getChannelData(i).slice(),
	);
	const request = { channels, sampleRate: buffer.sampleRate };
	const result =
		typeof Worker === "undefined"
			? new Promise<BpmEstimate | null>((resolve) =>
					setTimeout(() =>
						resolve(estimateBpm(request.channels, request.sampleRate)),
					),
				)
			: runInWorker(request);
	cache.set(buffer, result);
	return result;
}
