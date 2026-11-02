import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { seekFrame } from "../utils/pcm-clock";
import { BufferedPcmVoice } from "./buffered-voice";
import { PcmVoice, renderPcmBlock, type StretchProcessor } from "./pcm-voice";
import type {
	PcmPacket,
	RendererCommand,
	RendererEvent,
	VoiceState,
} from "./protocol";
import {
	initSync,
	SoundTouchProcessor,
	StretchAlgorithm,
} from "./vendor/soundtouch";

let memory: WebAssembly.Memory;
beforeAll(() => {
	memory = initSync({
		module: readFileSync("src/modules/audio/worklet/vendor/soundtouch_bg.wasm"),
	}).memory;
});

function state(overrides: Partial<VoiceState> = {}): VoiceState {
	return {
		generation: 1,
		frame: 0,
		endFrame: 44100,
		playing: true,
		rate: 1,
		preservesPitch: true,
		...overrides,
	};
}
function realVoice(channels: Float32Array[], sampleRate = 44100) {
	return new PcmVoice(
		channels,
		sampleRate,
		memory,
		() =>
			new SoundTouchProcessor(
				channels.length,
				sampleRate,
				StretchAlgorithm.Spectral,
			),
	);
}

describe("decoded PCM playback", () => {
	it("bounds background rendering and stops refills after pause", async () => {
		vi.useFakeTimers();
		const scope = {
			onmessage: null as ((event: { data: RendererCommand }) => void) | null,
		};
		vi.stubGlobal("self", scope);
		try {
			await import("../workers/pcm-render.worker");
			const messages: RendererEvent[] = [];
			const port = {
				onmessage: null as ((event: { data: RendererCommand }) => void) | null,
				start() {},
				postMessage(message: RendererEvent, transfer: Transferable[]) {
					messages.push(structuredClone(message, { transfer }));
				},
			};
			scope.onmessage?.({
				data: {
					type: "init",
					channels: [new Float32Array(48000).fill(0.25)],
					sampleRate: 48000,
					wasm: new Uint8Array(
						readFileSync("src/modules/audio/worklet/vendor/soundtouch_bg.wasm"),
					).buffer,
					port: port as unknown as MessagePort,
				},
			});
			port.onmessage?.({
				data: {
					type: "voice",
					voice: "music",
					state: state({ endFrame: 48000 }),
				},
			});
			await vi.advanceTimersByTimeAsync(50);
			expect(messages.filter((message) => message.type === "pcm")).toHaveLength(
				4,
			);
			await vi.advanceTimersByTimeAsync(100);
			expect(messages.filter((message) => message.type === "pcm")).toHaveLength(
				4,
			);
			const first = messages.find((message) => message.type === "pcm");
			if (!first || first.type !== "pcm") throw new Error("Missing PCM packet");
			expect(first.report.renderedFrames).toBe(2048);
			port.onmessage?.({
				data: {
					type: "recycle",
					voice: "music",
					generation: 1,
					channels: first.channels,
				},
			});
			await vi.advanceTimersByTimeAsync(50);
			expect(messages.filter((message) => message.type === "pcm")).toHaveLength(
				5,
			);
			port.onmessage?.({
				data: {
					type: "voice",
					voice: "music",
					state: state({ generation: 2, playing: false }),
				},
			});
			await vi.advanceTimersByTimeAsync(100);
			expect(messages.filter((message) => message.type === "pcm")).toHaveLength(
				5,
			);
		} finally {
			vi.unstubAllGlobals();
			vi.useRealTimers();
		}
	});

	it.each([
		0.1, 0.5, 1, 1.5, 2,
	])("preserves exact samples and endpoint accounting through buffered %sx playback", (rate) => {
		const sampleRate = 48000;
		const source = Float32Array.from({ length: sampleRate }, (_, index) =>
			Math.sin(index * 0.05),
		);
		const configuration = state({ frame: 10000, endFrame: 14801, rate });
		const reference = realVoice([source, source], sampleRate);
		const producer = realVoice([source, source], sampleRate);
		reference.setState({ ...configuration });
		producer.setState({ ...configuration });
		const buffered = new BufferedPcmVoice(() => {});
		buffered.setState({ ...configuration });
		let produced = false;
		const scratch = [new Float32Array(128), new Float32Array(128)];
		while (!produced) {
			const channels = [new Float32Array(2048), new Float32Array(2048)];
			const report = renderPcmBlock(producer, channels, scratch);
			if (!report) throw new Error("Missing render report");
			buffered.accept({ type: "pcm", voice: "music", channels, report });
			produced = report.ended;
		}
		let ended = false;
		let rendered = 0;
		const output = [new Float32Array(128), new Float32Array(128)];
		const expected = [new Float32Array(128), new Float32Array(128)];
		for (let block = 0; block < 1000 && !ended; block++) {
			for (const channel of output) channel.fill(0);
			const actual = buffered.render(output, (block * 128) / sampleRate);
			const report = reference.render(expected, (block * 128) / sampleRate);
			expect(actual).toEqual(report);
			for (let channel = 0; channel < output.length; channel++) {
				let error = 0;
				for (let frame = 0; frame < 128; frame++)
					error = Math.max(
						error,
						Math.abs(output[channel][frame] - expected[channel][frame]),
					);
				expect(error).toBeLessThan(0.00001);
			}
			rendered += actual?.renderedFrames ?? 0;
			ended = actual?.ended ?? false;
		}
		expect(ended).toBe(true);
		expect(rendered).toBe(
			Math.ceil((configuration.endFrame - configuration.frame) / rate),
		);
		expect(buffered.render(output, 99)).toBeNull();
		reference.destroy();
		producer.destroy();
	});

	it("discards obsolete packets and does not count underrun silence", () => {
		const recycle = vi.fn();
		const buffered = new BufferedPcmVoice(recycle);
		const packet = (generation: number): PcmPacket => ({
			type: "pcm",
			voice: "music",
			channels: [new Float32Array(128).fill(0.5)],
			report: {
				generation,
				startFrame: 100,
				endFrame: 228,
				contextTime: 0,
				renderedFrames: 128,
				ended: true,
			},
		});
		buffered.setState(state({ generation: 1, frame: 100 }));
		buffered.accept(packet(1));
		buffered.setState(state({ generation: 2, frame: 100 }));
		buffered.accept(packet(1));
		expect(recycle).toHaveBeenCalledTimes(2);
		const output = [new Float32Array(128)];
		expect(buffered.render(output, 1)).toBeNull();
		buffered.accept(packet(2));
		expect(buffered.render(output, 2)).toMatchObject({
			startFrame: 100,
			endFrame: 228,
			contextTime: 2,
			renderedFrames: 128,
			ended: true,
		});
	});

	it.each([
		44100, 48000,
	])("seeks to the requested frame regardless of the original format at %i Hz", (sampleRate) => {
		// Once decoded, format/header/bitrate never enters the playback API. Give each
		// representative format the same deterministic PCM and inspect the first sample.
		for (const format of [
			"CBR MP3",
			"LAME VBR MP3",
			"VBR MP3 without Xing",
			"FLAC",
			"Opus",
		]) {
			const pcm = Float32Array.from(
				{ length: sampleRate * 151 },
				(_, index) => index / (sampleRate * 151),
			);
			const voice = realVoice([pcm], sampleRate);
			let generation = 0;
			for (const seconds of [20, 90, 150, 20.12345]) {
				const frame = seekFrame(seconds, sampleRate, pcm.length);
				voice.setState(
					state({ generation: ++generation, frame, endFrame: pcm.length }),
				);
				const output = [new Float32Array(128)];
				const report = voice.render(output, 0);
				expect(report?.startFrame, format).toBe(frame);
				expect(output[0][0], format).toBe(pcm[frame]);
			}
			voice.destroy();
		}
	});
	it("retains fractional rate accounting and zeroes samples beyond audition EOF", () => {
		const voice = realVoice([new Float32Array(100).fill(1)]);
		voice.setState(
			state({ frame: 10, endFrame: 13, rate: 0.3, preservesPitch: false }),
		);
		const output = [new Float32Array(128)];
		const report = voice.render(output, 0);
		expect(report?.endFrame).toBe(13);
		expect(report?.renderedFrames).toBe(10);
		expect(report?.ended).toBe(true);
		expect([...output[0].subarray(0, 10)]).toEqual(new Array(10).fill(1));
		expect([...output[0].subarray(10)]).toEqual(new Array(118).fill(0));
		expect(voice.render(output, 1)).toBeNull();
		voice.destroy();
	});
	it("flushes DSP once for the latest generation when multiple seeks arrive between callbacks", () => {
		const clear = vi.fn();
		const processor: StretchProcessor = {
			clear,
			free: vi.fn(),
			setTempo: vi.fn(),
			setRate: vi.fn(),
			setPitch: vi.fn(),
			getInputChunkSize: () => 128,
			getInputPtr: () => 0,
			getOutputPtr: () => 0,
			processInput: vi.fn(),
			numSamples: () => 128,
			extractOutput: () => 128,
		};
		const voice = new PcmVoice(
			[new Float32Array(44100)],
			44100,
			memory,
			() => processor,
		);
		voice.setState(state({ rate: 0.5 }));
		const output = [new Float32Array(128)];
		expect(voice.render(output, 0)?.endFrame).toBe(64);
		voice.setState(state({ generation: 2, frame: 1234, rate: 0.5 }));
		voice.setState(state({ generation: 3, frame: 5678, rate: 0.5 }));
		voice.setState(state({ generation: 2, frame: 9, rate: 0.5 }));
		const report = voice.render(output, 1);
		expect(clear).toHaveBeenCalledTimes(1);
		expect(report?.startFrame).toBe(5678);
		expect(report?.endFrame).toBe(5742);
		expect(report?.generation).toBe(3);
		voice.destroy();
	});
	it("does not advance the source clock when DSP extracts no output", () => {
		const processor: StretchProcessor = {
			clear: vi.fn(),
			free: vi.fn(),
			setTempo: vi.fn(),
			setRate: vi.fn(),
			setPitch: vi.fn(),
			getInputChunkSize: () => 128,
			getInputPtr: () => 0,
			getOutputPtr: () => 0,
			processInput: vi.fn(),
			numSamples: () => 128,
			extractOutput: () => 0,
		};
		const voice = new PcmVoice(
			[new Float32Array(44100)],
			44100,
			memory,
			() => processor,
		);
		voice.setState(state({ frame: 42, rate: 0.75 }));
		const report = voice.render([new Float32Array(128)], 0);
		expect(report?.endFrame).toBe(42);
		expect(report?.renderedFrames).toBe(0);
		voice.destroy();
	});
	it.each([
		0.1, 0.5, 0.75, 1.25, 2,
	])("drains real SoundTouch at %sx and reaches the exact range endpoint", (rate) => {
		const pcm = Float32Array.from({ length: 44100 }, (_, index) =>
			Math.sin(index * 0.062),
		);
		const voice = realVoice([pcm, pcm]);
		const start = 10000;
		const end = 16000;
		voice.setState(state({ frame: start, endFrame: end, rate }));
		const output = [new Float32Array(128), new Float32Array(128)];
		let rendered = 0;
		let nonzero = false;
		let finalFrame = start;
		let ended = false;
		for (let block = 0; block < 1000 && !ended; block++) {
			const report = voice.render(output, (block * 128) / 44100);
			rendered += report?.renderedFrames ?? 0;
			finalFrame = report?.endFrame ?? finalFrame;
			ended = report?.ended ?? false;
			nonzero ||= output[0].some((value) => Math.abs(value) > 0.01);
		}
		expect(nonzero).toBe(true);
		expect(ended).toBe(true);
		expect(finalFrame).toBe(end);
		expect(rendered).toBeCloseTo(Math.ceil((end - start) / rate), 0);
		voice.destroy();
	});
	it.each([
		[0.25, 0],
		[0.5, 0],
		[0.5, 3],
		[0.75, 3],
		[1.25, 3],
		[1.75, 3],
	])("keeps stretched audio aligned with the frame clock at %sx after a seek to %ss", (rate, seekSeconds) => {
		const sampleRate = 44100;
		const pcm = Float32Array.from(
			{ length: sampleRate * 6 },
			(_, i) => 0.05 * Math.sin((2 * Math.PI * 220 * i) / sampleRate),
		);
		// Slowed down, the first click sits 30 ms after the seek, inside the stretch
		// lead. Sped up, Spectral fades in over its first ~90 ms after a reset (quiet
		// but on time), so the first click goes past that.
		const first = rate < 1 ? 0.03 : 0.12;
		const clicks = [first, 0.41, 0.97, 1.6].map((t) =>
			Math.round((seekSeconds + t) * sampleRate),
		);
		for (const click of clicks) pcm.fill(0.9, click, click + 32);
		const voice = realVoice([pcm], sampleRate);
		const start = Math.round(seekSeconds * sampleRate);
		voice.setState(state({ frame: start, endFrame: pcm.length, rate }));
		const heard: number[] = [];
		const output = [new Float32Array(128)];
		for (let block = 0; heard.length < (1.8 / rate) * sampleRate; block++) {
			const report = voice.render(output, block);
			heard.push(...output[0].subarray(0, report?.renderedFrames ?? 0));
		}
		for (const click of clicks) {
			const expected = (click - start) / rate;
			const window = Math.round(0.1 * sampleRate);
			const onset = heard.findIndex(
				(value, i) => i > expected - window && Math.abs(value) > 0.4,
			);
			// Error in song time, as the lyric clock sees it.
			const errorMs = (((onset - expected) * rate) / sampleRate) * 1000;
			expect(Math.abs(errorMs), `click at ${click}`).toBeLessThan(3);
		}
		voice.destroy();
	});
	it.each([
		0.25, 0.5, 0.75, 1.25,
	])("starts stretched audio at full level after a reset at %sx", (rate) => {
		const sampleRate = 44100;
		const pcm = Float32Array.from(
			{ length: sampleRate * 3 },
			(_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate),
		);
		const voice = realVoice([pcm], sampleRate);
		voice.setState(state({ frame: sampleRate, endFrame: pcm.length, rate }));
		const heard: number[] = [];
		const output = [new Float32Array(128)];
		for (let block = 0; block < 80; block++) {
			voice.render(output, block);
			heard.push(...output[0]);
		}
		const rms = (from: number, to: number) =>
			Math.sqrt(
				heard.slice(from, to).reduce((sum, v) => sum + v * v, 0) / (to - from),
			);
		const steady = rms(sampleRate * 0.15, sampleRate * 0.2);
		// The first 10 ms used to be a fade-in from near silence.
		expect(rms(0, sampleRate * 0.01)).toBeGreaterThan(steady * 0.8);
		voice.destroy();
	});
	it("switches from buffered stretching to direct PCM at the audible seek frame", () => {
		const pcm = Float32Array.from({ length: 44100 }, (_, i) =>
			Math.sin(i * 0.062),
		);
		const voice = realVoice([pcm]);
		const output = [new Float32Array(128)];
		voice.setState(state({ rate: 0.5 }));
		const prior = voice.render(output, 0);
		voice.setState(state({ generation: 2, frame: prior?.endFrame ?? 0 }));
		const next = voice.render(output, 1);
		expect(next?.startFrame).toBe(64);
		expect(output[0][0]).toBe(pcm[64]);
		voice.destroy();
	});
});
