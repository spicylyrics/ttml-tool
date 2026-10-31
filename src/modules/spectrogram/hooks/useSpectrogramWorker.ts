import { useCallback, useEffect, useRef, useState } from "react";
import { LRUCache } from "$/modules/spectrogram/utils/lru-cache";
import type {
	SpectrogramWorker,
	TileGenerationParams,
	WorkerResponse,
} from "$/modules/spectrogram/workers/types";

const MAX_CACHED_TILES = 70;
const MAX_CACHED_BYTES = 128 * 1024 * 1024;
const MAX_PENDING_TILES = 32;
const MAX_IN_FLIGHT_TILES = 2;
const REQUEST_TIMEOUT_MS = 60_000;

export type TileEntry = {
	bitmap: ImageBitmap;
	width: number;
	height: number;
	gain: number;
	paletteId: string;
	fftSize?: number;
};

type TileRequest = {
	params: TileGenerationParams;
	resolve: (bitmap: ImageBitmap) => void;
	reject: (error: Error) => void;
	timer?: ReturnType<typeof setTimeout>;
};

export class SpectrogramWorkerClient {
	private worker: SpectrogramWorker;
	private reqIdCounter = 0;
	private ready = false;
	private failure: Error | null = null;
	private pending = new Map<number, TileRequest>();
	private queued = new Map<number, TileRequest>();
	private initTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(audioData: Float32Array, sampleRate: number) {
		this.worker = new Worker(
			new URL("../workers/spectrogram.worker.ts", import.meta.url),
			{ type: "module" },
		);
		this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const msg = event.data;
			if (msg.type === "INIT_COMPLETE") {
				clearTimeout(this.initTimer);
				this.ready = true;
				this.drain();
			} else if (msg.type === "FATAL_ERROR") {
				this.terminate(new Error(msg.message));
			} else {
				const request = this.pending.get(msg.reqId);
				if (request) {
					clearTimeout(request.timer);
					this.pending.delete(msg.reqId);
					if (msg.type === "TILE_READY") request.resolve(msg.imageBitmap);
					else request.reject(new Error(msg.message));
				} else if (msg.type === "TILE_READY") msg.imageBitmap.close();
				this.drain();
			}
		};
		this.worker.onerror = (event) =>
			this.terminate(new Error(event.message || "Spectrogram worker failed"));
		this.worker.onmessageerror = () =>
			this.terminate(new Error("Invalid spectrogram worker response"));
		this.initTimer = setTimeout(
			() => this.terminate(new Error("Spectrogram initialization timed out")),
			REQUEST_TIMEOUT_MS,
		);
		this.worker.postMessage(
			{ type: "INIT", audioData, sampleRate, generation: 0 },
			[audioData.buffer],
		);
	}

	private drain() {
		if (!this.ready || this.failure) return;
		while (this.pending.size < MAX_IN_FLIGHT_TILES && this.queued.size > 0) {
			const entry = this.queued.entries().next().value;
			if (!entry) break;
			const [reqId, request] = entry;
			this.queued.delete(reqId);
			this.pending.set(reqId, request);
			request.timer = setTimeout(
				() => this.terminate(new Error("Spectrogram tile timed out")),
				REQUEST_TIMEOUT_MS,
			);
			this.worker.postMessage({
				type: "GET_TILE",
				reqId,
				params: request.params,
			});
		}
	}

	getTile(params: TileGenerationParams): Promise<ImageBitmap> {
		if (this.failure) return Promise.reject(this.failure);
		return new Promise((resolve, reject) => {
			for (const [id, request] of this.queued) {
				if (request.params.tileIndex === params.tileIndex) {
					request.reject(new Error("Spectrogram request superseded"));
					this.queued.delete(id);
				}
			}
			if (this.queued.size >= MAX_PENDING_TILES) {
				const oldest = this.queued.entries().next().value;
				if (oldest) {
					oldest[1].reject(new Error("Spectrogram request superseded"));
					this.queued.delete(oldest[0]);
				}
			}
			this.queued.set(this.reqIdCounter++, { params, resolve, reject });
			this.drain();
		});
	}

	cancelQueued() {
		for (const request of this.queued.values())
			request.reject(new Error("Spectrogram request superseded"));
		this.queued.clear();
	}

	setPalette(palette: Uint8Array) {
		if (!this.failure)
			this.worker.postMessage({ type: "SET_PALETTE", palette });
	}

	terminate(error = new Error("Spectrogram worker disposed")) {
		if (this.failure) return;
		this.failure = error;
		this.ready = false;
		clearTimeout(this.initTimer);
		this.worker.terminate();
		for (const request of [...this.pending.values(), ...this.queued.values()]) {
			clearTimeout(request.timer);
			request.reject(error);
		}
		this.pending.clear();
		this.queued.clear();
	}
}

export const useSpectrogramWorker = (
	audioBuffer: AudioBuffer | null,
	paletteData: Uint8Array,
) => {
	const clientRef = useRef<SpectrogramWorkerClient | null>(null);
	const tileCache = useRef(
		new LRUCache<string, TileEntry>(
			MAX_CACHED_TILES,
			(_key, entry) => entry.bitmap.close(),
			MAX_CACHED_BYTES,
			(entry) => entry.width * entry.height * 4,
		),
	);
	const activeRequests = useRef(new Map<string, object>());
	const configuration = useRef("");
	const revision = useRef(0);
	const [lastTileTimestamp, setLastTileTimestamp] = useState(0);
	const paletteDataRef = useRef(paletteData);

	useEffect(() => {
		paletteDataRef.current = paletteData;
		revision.current++;
		configuration.current = "";
		activeRequests.current.clear();
		tileCache.current.clear();
		clientRef.current?.cancelQueued();
		clientRef.current?.setPalette(paletteData);
		setLastTileTimestamp((value) => value + 1);
	}, [paletteData]);

	useEffect(() => {
		tileCache.current.clear();
		activeRequests.current.clear();
		revision.current++;
		configuration.current = "";
		setLastTileTimestamp((value) => value + 1);
		if (!audioBuffer) return;
		const client = new SpectrogramWorkerClient(
			audioBuffer.getChannelData(0).slice(),
			audioBuffer.sampleRate,
		);
		clientRef.current = client;
		client.setPalette(paletteDataRef.current);
		return () => {
			clientRef.current = null;
			revision.current++;
			client.terminate();
			tileCache.current.clear();
			activeRequests.current.clear();
		};
	}, [audioBuffer]);

	const requestTileIfNeeded = useCallback(
		async (params: TileGenerationParams) => {
			const client = clientRef.current;
			if (!client) return;
			const config = `${params.tileWidthPx}:${params.height}:${params.gain}:${params.paletteId}:${params.fftSize ?? 1024}`;
			if (configuration.current !== config) {
				configuration.current = config;
				revision.current++;
				client.cancelQueued();
				activeRequests.current.clear();
			}
			const currentRevision = revision.current;
			const cacheKey = `tile-${params.tileIndex}`;
			const entry = tileCache.current.get(cacheKey);
			if (
				entry &&
				entry.width >= params.tileWidthPx &&
				entry.height === params.height &&
				entry.gain === params.gain &&
				entry.paletteId === params.paletteId &&
				entry.fftSize === params.fftSize
			)
				return;
			if (activeRequests.current.has(cacheKey)) return;
			const identity = {};
			activeRequests.current.set(cacheKey, identity);
			try {
				const bitmap = await client.getTile(params);
				if (
					clientRef.current !== client ||
					revision.current !== currentRevision
				) {
					bitmap.close();
					return;
				}
				tileCache.current.set(cacheKey, {
					bitmap,
					width: params.tileWidthPx,
					height: params.height,
					gain: params.gain,
					paletteId: params.paletteId,
					fftSize: params.fftSize,
				});
				setLastTileTimestamp((value) => value + 1);
			} catch (error) {
				if (
					clientRef.current === client &&
					revision.current === currentRevision &&
					error instanceof Error &&
					error.message !== "Spectrogram request superseded"
				)
					console.error("Spectrogram tile failed", error);
			} finally {
				if (activeRequests.current.get(cacheKey) === identity)
					activeRequests.current.delete(cacheKey);
			}
		},
		[],
	);

	return { tileCache, requestTileIfNeeded, lastTileTimestamp };
};
