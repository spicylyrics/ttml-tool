// @vitest-environment jsdom

import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TileComponentProps } from "../components/TileComponent";
import type { TileEntry } from "../hooks/useSpectrogramWorker";
import { SpectrogramWorkerClient } from "../hooks/useSpectrogramWorker";
import type { WorkerRequest, WorkerResponse } from "../workers/types";
import { LRUCache } from "./lru-cache";
import { updateVisibleSpectrogramTiles } from "./visible-tiles";

function setup() {
	const tileCache = { current: new LRUCache<string, TileEntry>(70) };
	const requestTileIfNeeded = vi.fn();
	let tiles: TileComponentProps[] = [];
	const setVisibleTiles = vi.fn<Dispatch<SetStateAction<TileComponentProps[]>>>(
		(update) => {
			tiles = typeof update === "function" ? update(tiles) : update;
		},
	);
	const context = {
		audioBuffer: { duration: 14 } as AudioBuffer,
		scrollContainerRef: { current: document.createElement("div") },
		containerWidth: 600,
		gain: 2,
		dataHeight: 300,
		requestTileIfNeeded,
		tileCache,
		palette: { id: "test" },
		zoom: 200,
		scrollLeft: 0,
		fftSize: 1024,
		setVisibleTiles,
	};
	return {
		context,
		requestTileIfNeeded,
		setVisibleTiles,
		tileCache,
		getTiles: () => tiles,
	};
}

describe("spectrogram tile preparation", () => {
	it("does not request tiles for a hidden viewport and clears unloaded tiles", () => {
		const { context, requestTileIfNeeded, getTiles } = setup();
		updateVisibleSpectrogramTiles({ ...context, containerWidth: 0 });
		expect(requestTileIfNeeded).not.toHaveBeenCalled();
		updateVisibleSpectrogramTiles(context);
		expect(getTiles().length).toBeGreaterThan(0);
		updateVisibleSpectrogramTiles({ ...context, audioBuffer: null });
		expect(getTiles()).toEqual([]);
	});

	it("keeps the same tile list while scrolling within the prefetched range", () => {
		const { context, getTiles } = setup();
		updateVisibleSpectrogramTiles(context);
		const before = getTiles();
		updateVisibleSpectrogramTiles({ ...context, scrollLeft: 10 });
		expect(getTiles()).toBe(before);
	});

	it("updates the list when bitmaps arrive, are replaced, or dimensions change", () => {
		const { context, getTiles, tileCache } = setup();
		updateVisibleSpectrogramTiles(context);
		const initial = getTiles();
		const bitmap = { width: 1024, height: 300 } as ImageBitmap;
		tileCache.current.set("tile-0", {
			bitmap,
			width: 1024,
			height: 300,
			gain: 2,
			paletteId: "test",
			fftSize: 1024,
		});
		updateVisibleSpectrogramTiles(context);
		expect(getTiles()).not.toBe(initial);
		expect(getTiles()[0].bitmap).toBe(bitmap);
		const loaded = getTiles();
		const replacement = { width: 1024, height: 300 } as ImageBitmap;
		tileCache.current.set("tile-0", {
			bitmap: replacement,
			width: 1024,
			height: 300,
			gain: 2,
			paletteId: "test",
			fftSize: 1024,
		});
		updateVisibleSpectrogramTiles(context);
		expect(getTiles()).not.toBe(loaded);
		expect(getTiles()[0].bitmap).toBe(replacement);
		const replaced = getTiles();
		updateVisibleSpectrogramTiles({ ...context, zoom: 201 });
		expect(getTiles()).not.toBe(replaced);
		expect(getTiles()[0].width).toBe(1005);
		const zoomed = getTiles();
		updateVisibleSpectrogramTiles({ ...context, zoom: 201, dataHeight: 320 });
		expect(getTiles()).not.toBe(zoomed);
		expect(getTiles()[0].height).toBe(320);
	});

	it("changes tile membership when scrolling to a different range", () => {
		const { context, getTiles } = setup();
		const audioBuffer = { duration: 120 } as AudioBuffer;
		updateVisibleSpectrogramTiles({ ...context, audioBuffer });
		const before = getTiles();
		updateVisibleSpectrogramTiles({
			...context,
			audioBuffer,
			scrollLeft: 10000,
		});
		expect(getTiles()).not.toBe(before);
		expect(getTiles()[0].tileId).toBe("tile-8");
	});
	it("bounds prefetch to the audio, keeps five-second tiles and chooses sufficient resolution", () => {
		const { context, requestTileIfNeeded, getTiles } = setup();
		updateVisibleSpectrogramTiles(context);
		expect(
			requestTileIfNeeded.mock.calls.map(([request]) => request.tileIndex),
		).toEqual([0, 1, 2]);
		expect(requestTileIfNeeded.mock.calls[2][0]).toEqual({
			tileIndex: 2,
			startTime: 10,
			endTime: 15,
			gain: 2,
			height: 300,
			tileWidthPx: 1024,
			paletteId: "test",
			fftSize: 1024,
		});
		expect(getTiles().map((tile) => [tile.left, tile.width])).toEqual([
			[0, 1000],
			[1000, 1000],
			[2000, 1000],
		]);
	});
	it("reuses cached bitmaps and caps the requested resolution at the existing LOD maximum", () => {
		const { context, tileCache, requestTileIfNeeded, getTiles } = setup();
		const bitmap = { width: 512, height: 300 } as ImageBitmap;
		tileCache.current.set("tile-0", {
			bitmap,
			width: 512,
			height: 300,
			gain: 2,
			paletteId: "test",
		});
		updateVisibleSpectrogramTiles({ ...context, zoom: 2000 });
		expect(requestTileIfNeeded.mock.calls[0][0].tileWidthPx).toBe(8192);
		expect(getTiles()[0]).toMatchObject({
			bitmap,
			canvasWidth: 512,
			width: 10000,
		});
	});
	it("keeps tiles empty when the audio or mounted container is absent", () => {
		const { context, requestTileIfNeeded, getTiles } = setup();
		updateVisibleSpectrogramTiles({ ...context, audioBuffer: null });
		updateVisibleSpectrogramTiles({
			...context,
			scrollContainerRef: { current: null },
		});
		expect(requestTileIfNeeded).not.toHaveBeenCalled();
		expect(getTiles()).toEqual([]);
	});
});

describe("spectrogram worker requests", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});
	function setupClient() {
		const messages: WorkerRequest[] = [];
		class FakeWorker {
			onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
			onerror: ((event: { message: string }) => void) | null = null;
			onmessageerror: (() => void) | null = null;
			postMessage(message: WorkerRequest) {
				messages.push(message);
			}
			terminate = vi.fn();
		}
		let worker: FakeWorker;
		vi.stubGlobal(
			"Worker",
			class extends FakeWorker {
				constructor() {
					super();
					worker = this;
				}
			},
		);
		const client = new SpectrogramWorkerClient(new Float32Array(100), 48000);
		return {
			client,
			messages,
			getWorker: () => worker,
			params: {
				tileIndex: 0,
				startTime: 0,
				endTime: 5,
				gain: 1,
				height: 256,
				tileWidthPx: 512,
				paletteId: "test",
			},
		};
	}
	it("bounds dispatched jobs and settles every request on termination", async () => {
		const { client, messages, getWorker, params } = setupClient();
		const jobs = Array.from({ length: 50 }, (_, tileIndex) =>
			client.getTile({ ...params, tileIndex }).catch((error: Error) => error),
		);
		getWorker().onmessage?.({ data: { type: "INIT_COMPLETE", generation: 0 } });
		expect(
			messages.filter((message) => message.type === "GET_TILE"),
		).toHaveLength(2);
		client.terminate();
		expect(
			(await Promise.all(jobs)).every((result) => result instanceof Error),
		).toBe(true);
		expect(getWorker().terminate).toHaveBeenCalledOnce();
	});
	it("rejects queued jobs on initialization failure and timeout", async () => {
		vi.useFakeTimers();
		const { client, getWorker, params } = setupClient();
		const failed = client.getTile(params).catch((error: Error) => error);
		getWorker().onerror?.({ message: "WASM failed" });
		expect(await failed).toEqual(new Error("WASM failed"));
		const next = setupClient();
		const timedOut = next.client.getTile(params).catch((error: Error) => error);
		vi.advanceTimersByTime(60_000);
		expect(await timedOut).toEqual(
			new Error("Spectrogram initialization timed out"),
		);
	});
});
