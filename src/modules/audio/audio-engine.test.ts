import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	PlayerCommand,
	PlayerEvent,
	RenderReport,
} from "./worklet/protocol";

const worker = vi.hoisted(() => ({
	readMetadata: vi.fn(),
	transcodeToWav: vi.fn(),
}));
vi.mock("./workers/audio-worker-client", () => ({
	AudioWorkerClient: class {
		readMetadata = worker.readMetadata;
		transcodeToWav = worker.transcodeToWav;
		cancelPending = vi.fn();
	},
}));
vi.mock("$/utils/logging", () => ({ log: vi.fn() }));
vi.mock("$/modules/audio/states/index.ts", async () => {
	const { atom } = await import("jotai");
	return {
		audioBufferAtom: atom(null),
		audioCoverArtAtom: atom(null),
		audioErrorAtom: atom(null),
		audioTaskStateAtom: atom(null),
		auditionTimeAtom: atom(null),
		loadedAudioAtom: atom(new Blob()),
		EQ_FREQUENCIES: [100],
		equalizerEnabledAtom: atom(false),
		equalizerGainsAtom: atom([0]),
	};
});
vi.mock("$/states/store.ts", async () => {
	const { createStore } = await import("jotai");
	return { globalStore: createStore() };
});

import { globalStore } from "$/states/store";
import { AudioEngine } from "./audio-engine";
import {
	audioBufferAtom,
	audioCoverArtAtom,
	audioErrorAtom,
	audioTaskStateAtom,
} from "./states";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: Error) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}
const pcm = new Float32Array(1000).fill(0.25);
const buffer: AudioBuffer = {
	sampleRate: 1000,
	length: 1000,
	duration: 1,
	numberOfChannels: 1,
	getChannelData: () => pcm,
	copyFromChannel: (destination, _channel, start = 0) =>
		destination.set(pcm.subarray(start, start + destination.length)),
	copyToChannel: (source, _channel, start = 0) => pcm.set(source, start),
};

class FakeContext {
	state: AudioContextState = "running";
	currentTime = 10;
	sampleRate = 1000;
	baseLatency = 0.02;
	outputLatency = 0.03;
	audioWorklet = { addModule: vi.fn(async () => {}) };
	decodeAudioData = vi.fn(async () => buffer);
	resume = vi.fn(async () => {
		this.state = "running";
	});
	destination = {};
	createGain() {
		return { gain: { value: 1 }, connect: vi.fn() };
	}
	createBiquadFilter() {
		return { frequency: {}, gain: {}, Q: {}, connect: vi.fn() };
	}
}
class FakeNode {
	static nodes: FakeNode[] = [];
	static initError = false;
	static autoReady = true;
	onprocessorerror: (() => void) | null = null;
	commands: PlayerCommand[] = [];
	connect = vi.fn();
	disconnect = vi.fn();
	port = {
		onmessage: null as ((event: { data: PlayerEvent }) => void) | null,
		close: vi.fn(),
		postMessage: (command: PlayerCommand) => {
			this.commands.push(command);
			if (command.type === "init" && FakeNode.autoReady)
				queueMicrotask(() =>
					this.emit(
						FakeNode.initError
							? { type: "error", message: "WASM broken" }
							: { type: "ready" },
					),
				);
		},
	};
	constructor() {
		FakeNode.nodes.push(this);
	}
	emit(data: PlayerEvent) {
		this.port.onmessage?.({ data });
	}
	get lastState() {
		const command = [...this.commands]
			.reverse()
			.find((command) => command.type === "voice" && command.voice === "music");
		if (!command || command.type !== "voice")
			throw new Error("Missing voice command");
		return command.state;
	}
	report(overrides: Partial<RenderReport> = {}) {
		const state = this.lastState;
		this.emit({
			type: "render",
			voice: "music",
			report: {
				generation: state.generation,
				startFrame: state.frame,
				endFrame: state.frame + 128,
				renderedFrames: 128,
				contextTime: 10,
				ended: false,
				...overrides,
			},
		});
	}
}
let engine: AudioEngine;
let context: FakeContext;
beforeEach(() => {
	vi.useFakeTimers();
	FakeNode.nodes = [];
	FakeNode.initError = false;
	FakeNode.autoReady = true;
	worker.readMetadata
		.mockReset()
		.mockImplementation(() => new Promise(() => {}));
	worker.transcodeToWav.mockReset();
	vi.stubGlobal("AudioContext", FakeContext);
	vi.stubGlobal("AudioWorkletNode", FakeNode);
	vi.stubGlobal(
		"Worker",
		class {
			postMessage = vi.fn();
			terminate = vi.fn();
		},
	);
	vi.stubGlobal(
		"MessageChannel",
		class {
			port1 = {};
			port2 = {};
		},
	);
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({
			ok: true,
			arrayBuffer: async () => new ArrayBuffer(8),
		})),
	);
	vi.spyOn(WebAssembly, "compile").mockResolvedValue(
		new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])),
	);
	engine = new AudioEngine();
	context = engine.ctx as unknown as FakeContext;
});
afterEach(() => {
	engine.unloadMusic();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
const flush = async () => {
	for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("PCM engine lifecycle", () => {
	it("does not keep a redundant music update timer while playing", async () => {
		await engine.loadMusic(new Blob());
		const play = engine.play();
		await flush();
		FakeNode.nodes[0].report();
		await play;
		await vi.advanceTimersByTimeAsync(100);
		expect(engine.musicPlaying).toBe(true);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("loads a suspended song and waits for initialization before starting playback", async () => {
		context.state = "suspended";
		FakeNode.autoReady = false;
		await engine.loadMusic(new Blob());
		expect(engine.musicLoaded).toBe(true);
		expect(globalStore.get(audioTaskStateAtom)).toBeNull();
		const play = engine.play();
		await flush();
		const node = FakeNode.nodes[0];
		expect(node.commands.some((command) => command.type === "voice")).toBe(
			false,
		);
		node.emit({ type: "ready" });
		await flush();
		node.report();
		await play;
		expect(engine.musicPlaying).toBe(true);
	});
	it("unloads and stops update timers after a runtime worklet failure", async () => {
		await engine.loadMusic(new Blob());
		const play = engine.play();
		await flush();
		const node = FakeNode.nodes[0];
		node.report();
		await play;
		node.emit({ type: "error", message: "DSP failed" });
		expect(engine.musicLoaded).toBe(false);
		expect(engine.musicPlaying).toBe(false);
		expect(globalStore.get(audioErrorAtom)).toBe("DSP failed");
		expect(vi.getTimerCount()).toBe(0);
	});
	it("publishes only the newest decode and rejects the replaced load promptly", async () => {
		const old = deferred<AudioBuffer>();
		context.decodeAudioData.mockImplementationOnce(() => old.promise);
		const first = engine.loadMusic(new Blob(["old"]));
		const cancelled = expect(first).rejects.toMatchObject({
			name: "AbortError",
		});
		await flush();
		await engine.loadMusic(new Blob(["new"]));
		await cancelled;
		old.resolve({ ...buffer, duration: 2 } as AudioBuffer);
		await flush();
		expect(engine.musicDuration).toBe(1);
		expect(globalStore.get(audioBufferAtom)).toBe(buffer);
		expect(FakeNode.nodes).toHaveLength(1);
	});
	it("rejects initialization failure and clears loading state", async () => {
		FakeNode.initError = true;
		await expect(engine.loadMusic(new Blob())).rejects.toThrow("WASM broken");
		expect(globalStore.get(audioTaskStateAtom)).toBeNull();
		expect(globalStore.get(audioErrorAtom)).toBe("WASM broken");
		expect(engine.musicLoaded).toBe(false);
	});
	it("keeps transcode fallback and ignores stale metadata/artwork", async () => {
		const metadata =
			deferred<Awaited<ReturnType<typeof engine.workerClient.readMetadata>>>();
		worker.readMetadata.mockImplementationOnce(() => metadata.promise);
		context.decodeAudioData.mockRejectedValueOnce(new Error("Unsupported"));
		worker.transcodeToWav.mockResolvedValue(new Blob(["WAV"]));
		await engine.loadMusic(new Blob(["Opus"]));
		expect(worker.transcodeToWav).toHaveBeenCalledOnce();
		await engine.loadMusic(new Blob(["new"]));
		const revoke = vi
			.spyOn(URL, "revokeObjectURL")
			.mockImplementation(() => {});
		metadata.resolve({
			type: "METADATA",
			id: 0,
			sampleRate: 1000,
			channels: 1,
			duration: 1,
			metadata: { title: "Old" },
			encoding: "Opus",
			bitsPerSample: 16,
			coverUrl: "blob:old",
		});
		await flush();
		expect(engine.musicMetadata).toBeNull();
		expect(globalStore.get(audioCoverArtAtom)).toBeNull();
		expect(revoke).toHaveBeenCalledWith("blob:old");
	});
	it("resolves playback and emits resume only after the worklet renders", async () => {
		await engine.loadMusic(new Blob());
		const resume = vi.fn();
		engine.addEventListener("music-resume", resume);
		const play = engine.resumeOrSeekMusic(0.2);
		await flush();
		expect(resume).not.toHaveBeenCalled();
		expect(engine.musicPlaying).toBe(false);
		const node = FakeNode.nodes[0];
		node.report();
		await play;
		expect(resume).toHaveBeenCalledOnce();
		context.currentTime = 10.114;
		expect(engine.musicCurrentTime).toBeCloseTo(0.264);
		engine.pauseMusic();
		context.currentTime = 99;
		expect(engine.musicCurrentTime).toBeCloseTo(0.264);
	});
	it("does not revive playback after pause while AudioContext resume is pending", async () => {
		await engine.loadMusic(new Blob());
		const running = deferred<void>();
		context.state = "suspended";
		context.resume.mockImplementation(() => running.promise);
		const play = engine.play();
		const cancelled = expect(play).rejects.toMatchObject({
			name: "AbortError",
		});
		engine.pauseMusic();
		context.state = "running";
		running.resolve();
		await cancelled;
		expect(engine.musicPlaying).toBe(false);
	});
	it("rejects failed context resume truthfully", async () => {
		await engine.loadMusic(new Blob());
		context.state = "suspended";
		context.resume.mockRejectedValue(new Error("Autoplay blocked"));
		await expect(engine.play()).rejects.toThrow("Autoplay blocked");
		expect(engine.musicPlaying).toBe(false);
	});
	it("publishes final time after output latency and restarts from zero at EOF", async () => {
		await engine.loadMusic(new Blob());
		const play = engine.resumeOrSeekMusic(0.8);
		await flush();
		const node = FakeNode.nodes[0];
		node.report({ endFrame: 1000, renderedFrames: 200, ended: true });
		await play;
		expect(engine.musicPlaying).toBe(true);
		context.currentTime = 10.3;
		await vi.advanceTimersByTimeAsync(20);
		expect(engine.musicPlaying).toBe(false);
		expect(engine.musicCurrentTime).toBe(1);
		expect(vi.getTimerCount()).toBe(0);
		const replay = engine.play();
		await flush();
		expect(node.lastState.frame).toBe(0);
		node.report();
		await replay;
	});
});
