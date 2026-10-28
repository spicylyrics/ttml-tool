import { estimateBpm } from "./estimate-bpm";

export interface BpmWorkerRequest {
	channels: Float32Array[];
	sampleRate: number;
}

self.onmessage = (event: MessageEvent<BpmWorkerRequest>) => {
	const { channels, sampleRate } = event.data;
	self.postMessage(estimateBpm(channels, sampleRate));
};
