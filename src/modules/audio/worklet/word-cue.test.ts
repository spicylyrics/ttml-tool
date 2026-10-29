import { describe, expect, it } from "vitest";
import type { RenderReport } from "./protocol";
import { WordCueSynth } from "./word-cue";

const rate = 48000;
const block = (
	startFrame: number,
	endFrame: number,
	renderedFrames = 128,
): RenderReport => ({
	generation: 1,
	startFrame,
	endFrame,
	renderedFrames,
	contextTime: 0,
	ended: false,
});
const energy = (samples: Float32Array) =>
	samples.reduce((total, v) => total + Math.abs(v), 0);
function render(synth: WordCueSynth, report: RenderReport | null, time = 0) {
	const output = [new Float32Array(128), new Float32Array(128)];
	synth.render(output, report, time);
	expect(output[0]).toEqual(output[1]);
	return output[0];
}

describe("word cue worklet synthesis", () => {
	it("places a boundary in the music block at normal and double speed", () => {
		for (const speed of [1, 2]) {
			const synth = new WordCueSynth(rate);
			synth.configure([{ timeMs: 1, kind: "start" }], 1); // frame 48
			const samples = render(synth, block(0, 128 * speed));
			const onset = 48 / speed;
			expect(energy(samples.slice(0, onset + 1))).toBe(0); // attack begins at zero
			expect(energy(samples.slice(onset + 1))).toBeGreaterThan(0);
		}
	});
	it("does not replay skipped boundaries after a seek or make clicks during underrun", () => {
		const synth = new WordCueSynth(rate);
		synth.configure([{ timeMs: 1, kind: "start" }], 1);
		expect(energy(render(synth, block(1000, 1128)))).toBe(0);
		expect(energy(render(synth, block(0, 0, 0)))).toBe(0);
		expect(energy(render(synth, block(0, 128)))).toBeGreaterThan(0);
	});
	it("retains boundaries in the fractional final sample interval and emits the EOF end", () => {
		const synth = new WordCueSynth(rate);
		synth.configure([{ timeMs: (127.8 / rate) * 1000, kind: "start" }], 1);
		render(synth, block(0, 128));
		expect(energy(render(synth, block(128, 256), 128 / rate))).toBeGreaterThan(
			0,
		);
		synth.configure([{ timeMs: (128 / rate) * 1000, kind: "end" }], 1);
		render(synth, { ...block(0, 128), ended: true });
		expect(energy(render(synth, null, 128 / rate))).toBeGreaterThan(0);
	});
	it("coalesces duplicate same-kind clicks and honors independent volume and mute", () => {
		const one = new WordCueSynth(rate);
		const duplicate = new WordCueSynth(rate);
		const quiet = new WordCueSynth(rate);
		const boundary = { timeMs: 0, kind: "start" as const };
		one.configure([boundary], 1);
		duplicate.configure([boundary, boundary], 1);
		quiet.configure([boundary], 0.25);
		const full = render(one, block(0, 128));
		expect(render(duplicate, block(0, 128))).toEqual(full);
		expect(energy(render(quiet, block(0, 128)))).toBeCloseTo(
			energy(full) * 0.25,
		);
		one.configure([boundary], 0);
		expect(energy(render(one, block(0, 128)))).toBe(0);
	});
	it("lets a ringing click finish through edits and drops it when muted", () => {
		const synth = new WordCueSynth(rate);
		const boundary = { timeMs: 0, kind: "start" as const };
		synth.configure([boundary], 1);
		render(synth, block(0, 128));
		synth.configure([boundary, { timeMs: 500, kind: "end" }], 1);
		expect(energy(render(synth, null, 128 / rate))).toBeGreaterThan(0);
		synth.configure([boundary], 0);
		render(synth, null, 256 / rate);
		synth.configure([boundary], 1);
		expect(energy(render(synth, null, 384 / rate))).toBe(0);
	});
});
