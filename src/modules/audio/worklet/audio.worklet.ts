import "./text-decoder";
import { PcmVoice } from "./pcm-voice";
import type { PlayerCommand, PlayerEvent, VoiceId } from "./protocol";
import {
	initSync,
	SoundTouchProcessor,
	StretchAlgorithm,
} from "./vendor/soundtouch";
import { WordCueSynth } from "./word-cue";

// AudioWorklet globals are absent from TypeScript's DOM/WebWorker declarations.
declare const sampleRate: number;
declare const currentTime: number;
declare abstract class AudioWorkletProcessor {
	readonly port: MessagePort;
	abstract process(
		inputs: Float32Array[][],
		outputs: Float32Array[][],
	): boolean;
}
declare function registerProcessor(
	name: string,
	processor: typeof AudioWorkletProcessor,
): void;

class PcmPlayer extends AudioWorkletProcessor {
	private voices: Partial<Record<VoiceId, PcmVoice>> = {};
	private auditionOutput: Float32Array[] = [];
	private destroyed = false;
	private wordCues = new WordCueSynth(sampleRate);

	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent<PlayerCommand>) => {
			try {
				const command = event.data;
				if (command.type === "init") {
					const { memory } = initSync({ module: command.wasm });
					const channels = command.channels;
					for (const id of ["music", "audition"] as const) {
						this.voices[id] = new PcmVoice(
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
					this.auditionOutput = channels.map(() => new Float32Array(128));
					this.post({ type: "ready" });
				} else if (command.type === "voice") {
					this.voices[command.voice]?.setState(command.state);
				} else if (command.type === "word-cues") {
					this.wordCues.configure(command.boundaries, command.volume);
				} else {
					this.destroy();
				}
			} catch (error) {
				this.fail(error);
			}
		};
		this.port.start();
	}

	private post(event: PlayerEvent) {
		this.port.postMessage(event);
	}
	private destroy() {
		for (const voice of Object.values(this.voices)) voice.destroy();
		this.voices = {};
		this.auditionOutput = [];
		this.destroyed = true;
	}
	private fail(error: unknown) {
		this.destroy();
		this.post({
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	}

	process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
		if (this.destroyed) return false;
		const output = outputs[0];
		const cueOutput = outputs[1];
		if (!output?.[0] || !this.voices.music) return true;
		try {
			if (this.auditionOutput[0].length !== output[0].length) {
				this.auditionOutput = output.map(
					(channel) => new Float32Array(channel.length),
				);
			}
			for (const id of ["music", "audition"] as const) {
				const report = this.voices[id]?.render(
					id === "music" ? output : this.auditionOutput,
					currentTime,
				);
				if (report) this.post({ type: "render", voice: id, report });
				if (id === "music" && cueOutput?.[0])
					this.wordCues.render(cueOutput, report ?? null, currentTime);
			}
			for (let c = 0; c < output.length; c++) {
				for (let i = 0; i < output[c].length; i++)
					output[c][i] += this.auditionOutput[c][i];
			}
		} catch (error) {
			for (const channel of output) channel.fill(0);
			for (const channel of cueOutput ?? []) channel.fill(0);
			this.fail(error);
		}
		return !this.destroyed;
	}
}

registerProcessor("pcm-player", PcmPlayer);
