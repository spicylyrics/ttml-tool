/**
 * Loader for the vendored Signalsmith Stretch WASM (see vendor/NOTICE.md).
 *
 * The binary is the Emscripten build shipped inside the `signalsmith-stretch`
 * npm package. Its export names are minified, so they are mapped here for that
 * exact build; replacing the binary means re-checking this table.
 */
interface StretchExports {
	/** memory */
	e: WebAssembly.Memory;
	/** static constructors */
	f(): void;
	/** setBuffers(channels, length) -> pointer to input then output buffers */
	h(channels: number, length: number): number;
	/** inputLatency() */
	k(): number;
	/** outputLatency() */
	l(): number;
	/** reset() */
	m(): void;
	/** presetDefault(channels, sampleRate) */
	n(channels: number, sampleRate: number): void;
	/** seek(inputSamples, playbackRate) */
	v(inputSamples: number, rate: number): void;
	/** process(inputSamples, outputSamples) */
	w(inputSamples: number, outputSamples: number): void;
	/** main() */
	y(argc: number, argv: number): number;
}

/** The library's own Web Audio node processes in 128-frame steps; match it. */
const STEP = 128;

/**
 * Pitch-preserving stretch addressed by source position instead of a pushed
 * input stream. Each step hands the library the source window that should be
 * heard next and lets it re-seek, the way the library's own player works, so a
 * seek or speed change needs no draining and the output stays on the frame
 * clock (measured within ~2 ms at 0.5x to 1.5x).
 */
export class SignalsmithStretcher {
	private readonly exports: StretchExports;
	private readonly inputLatency: number;
	private readonly outputLatency: number;
	private readonly windowLength: number;
	private readonly pointer: number;

	constructor(
		module: WebAssembly.Module,
		private readonly source: Float32Array[],
		sampleRate: number,
	) {
		let memory: WebAssembly.Memory | null = null;
		const heap = () => new Uint8Array((memory as WebAssembly.Memory).buffer);
		// The library seeds a small random wobble in its time factor (less phasiness
		// at big slowdowns). A fixed seed keeps the same song rendering the same way.
		let seed = 0x9e3779b9;
		const instance = new WebAssembly.Instance(module, {
			a: {
				a: (pointer: number, size: number) => {
					const bytes = heap();
					for (let i = 0; i < size; i++) {
						seed ^= seed << 13;
						seed ^= seed >>> 17;
						seed ^= seed << 5;
						bytes[pointer + i] = seed & 0xff;
					}
					return 0;
				},
				b: (requested: number) => {
					const current = (memory as WebAssembly.Memory).buffer.byteLength;
					try {
						(memory as WebAssembly.Memory).grow(
							Math.ceil((requested - current) / 65536),
						);
						return 1;
					} catch {
						return 0;
					}
				},
				c: (dest: number, src: number, count: number) => {
					heap().copyWithin(dest, src, src + count);
				},
				d: () => {
					throw new Error("Signalsmith Stretch aborted");
				},
			},
		});
		this.exports = instance.exports as unknown as StretchExports;
		memory = this.exports.e;
		this.exports.f();
		this.exports.y(0, 0);
		this.exports.n(source.length, sampleRate);
		this.inputLatency = this.exports.k();
		this.outputLatency = this.exports.l();
		this.windowLength = this.inputLatency + this.outputLatency;
		this.pointer = this.exports.h(source.length, this.windowLength);
	}

	/**
	 * Clears the stretcher and renders the audio leading up to `position`
	 * without keeping it. Without this the first ~50 ms after a seek fade in.
	 */
	reset(position: number, rate: number, end: number) {
		this.exports.m();
		const frames = Math.ceil((this.outputLatency * 1.5) / STEP) * STEP;
		const scratch = this.source.map(() => new Float32Array(frames));
		this.render(position - frames * rate, rate, end, scratch, frames);
	}

	/**
	 * Writes `frames` output frames to `output`, the first one heard at source
	 * frame `position`, advancing `rate` source frames per output frame.
	 * Source frames at or past `end`, or before 0, are silence.
	 */
	render(
		position: number,
		rate: number,
		end: number,
		output: Float32Array[],
		frames: number,
	) {
		const bytes = this.windowLength * 4;
		const channels = this.source.length;
		for (let offset = 0; offset < frames; offset += STEP) {
			const count = Math.min(STEP, frames - offset);
			const at = position + offset * rate;
			// The library hears its input's tail inputLatency late and emits it
			// outputLatency (in output frames) later still.
			const windowEnd = Math.round(
				at + this.inputLatency + this.outputLatency * rate,
			);
			const windowStart = windowEnd - this.windowLength;
			const from = Math.max(0, windowStart);
			const to = Math.max(from, Math.min(end, windowEnd));
			const buffer = this.exports.e.buffer;
			for (let c = 0; c < channels; c++) {
				const input = new Float32Array(
					buffer,
					this.pointer + bytes * c,
					this.windowLength,
				);
				input.fill(0);
				if (to > from)
					input.set(this.source[c].subarray(from, to), from - windowStart);
			}
			this.exports.v(this.windowLength, rate);
			this.exports.w(0, count);
			const after = this.exports.e.buffer;
			for (let c = 0; c < output.length; c++)
				output[c].set(
					new Float32Array(after, this.pointer + bytes * (c + channels), count),
					offset,
				);
		}
	}
}
