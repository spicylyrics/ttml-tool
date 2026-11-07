import { BufferedPcmVoice } from "./buffered-voice";
import type {
	PcmPacket,
	PlayerCommand,
	PlayerEvent,
	RendererEvent,
} from "./protocol";
import { ScrubVoice } from "./scrub-voice";
import { SignalsmithStretcher } from "./signalsmith";

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
	private rendererPort: MessagePort | null = null;
	private destroyed = false;
	private scrub: ScrubVoice | null = null;
	private voices = {
		music: new BufferedPcmVoice((packet) => this.recycle(packet)),
		audition: new BufferedPcmVoice((packet) => this.recycle(packet)),
	};

	constructor() {
		super();
		this.port.onmessage = (event: MessageEvent<PlayerCommand>) => {
			const command = event.data;
			if (command.type === "init") {
				if (command.scrub) {
					const { channels, sampleRate, signalsmithWasm } = command.scrub;
					try {
						this.scrub = new ScrubVoice(
							channels,
							sampleRate,
							new SignalsmithStretcher(
								new WebAssembly.Module(signalsmithWasm),
								channels,
								sampleRate,
							),
						);
					} catch {
						// Scrubbing just stays silent; playback doesn't depend on it.
						this.scrub = null;
					}
				}
				this.rendererPort = command.port;
				command.port.onmessage = (event: MessageEvent<RendererEvent>) => {
					const message = event.data;
					if (message.type === "pcm")
						this.voices[message.voice].accept(message);
					else this.post(message);
				};
				command.port.start();
			} else if (command.type === "voice") {
				this.rendererPort?.postMessage(command);
				this.voices[command.voice].setState(command.state);
			} else if (command.type === "scrub") {
				this.scrub?.set(command.state);
			} else {
				this.scrub = null;
				this.voices.music.clear();
				this.voices.audition.clear();
				this.rendererPort?.close();
				this.rendererPort = null;
				this.destroyed = true;
			}
		};
		this.port.start();
	}

	private recycle(packet: PcmPacket) {
		this.rendererPort?.postMessage(
			{
				type: "recycle",
				voice: packet.voice,
				generation: packet.report.generation,
				channels: packet.channels,
			},
			packet.channels.map((channel) => channel.buffer),
		);
	}

	private post(event: PlayerEvent) {
		this.port.postMessage(event);
	}

	process(_inputs: Float32Array[][], outputs: Float32Array[][]) {
		if (this.destroyed) return false;
		const output = outputs[0];
		if (!output?.[0]) return true;
		for (const channel of output) channel.fill(0);
		const music = this.voices.music.render(output, currentTime);
		if (music) this.post({ type: "render", voice: "music", report: music });
		const audition = this.voices.audition.render(output, currentTime);
		if (audition)
			this.post({ type: "render", voice: "audition", report: audition });
		this.scrub?.render(output);
		return true;
	}
}

registerProcessor("pcm-player", PcmPlayer);
