import { PcmVoice, renderPcmBlock } from "../worklet/pcm-voice";
import type {
	RendererCommand,
	RendererEvent,
	VoiceId,
	VoiceState,
} from "../worklet/protocol";
import {
	initSync,
	SoundTouchProcessor,
	StretchAlgorithm,
} from "../worklet/vendor/soundtouch";

const BLOCK_FRAMES = 2048;
const BUFFER_COUNT = 4;
type Voice = {
	renderer: PcmVoice;
	state: VoiceState | null;
	inFlight: number;
	pool: Float32Array[][];
	scratch: Float32Array[];
	timer: ReturnType<typeof setTimeout> | null;
	ended: boolean;
};
let port: MessagePort;
let voices: Record<VoiceId, Voice>;
let channelCount = 0;
let failed = false;

function post(message: RendererEvent, transfer: Transferable[] = []) {
	port.postMessage(message, transfer);
}

function schedule(id: VoiceId) {
	const voice = voices[id];
	if (
		failed ||
		voice.timer !== null ||
		!voice.state?.playing ||
		voice.ended ||
		voice.inFlight >= BUFFER_COUNT
	)
		return;
	voice.timer = setTimeout(() => {
		voice.timer = null;
		if (
			failed ||
			!voice.state?.playing ||
			voice.ended ||
			voice.inFlight >= BUFFER_COUNT
		)
			return;
		try {
			const channels =
				voice.pool.pop() ??
				Array.from(
					{ length: channelCount },
					() => new Float32Array(BLOCK_FRAMES),
				);
			const report = renderPcmBlock(voice.renderer, channels, voice.scratch);
			if (report && (report.renderedFrames > 0 || report.ended)) {
				voice.inFlight++;
				voice.ended = report.ended;
				post(
					{ type: "pcm", voice: id, channels, report },
					channels.map((channel) => channel.buffer),
				);
			} else voice.pool.push(channels);
			schedule(id);
		} catch (error) {
			failed = true;
			for (const entry of Object.values(voices)) entry.renderer.destroy();
			post({
				type: "error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}, 0);
}

self.onmessage = (event: MessageEvent<RendererCommand>) => {
	const command = event.data;
	if (command.type !== "init") return;
	port = command.port;
	channelCount = command.channels.length;
	try {
		const { memory } = initSync({ module: command.wasm });
		const createVoice = (): Voice => ({
			renderer: new PcmVoice(
				command.channels,
				command.sampleRate,
				memory,
				() =>
					new SoundTouchProcessor(
						channelCount,
						command.sampleRate,
						StretchAlgorithm.Spectral,
					),
			),
			state: null,
			inFlight: 0,
			pool: [],
			scratch: Array.from(
				{ length: channelCount },
				() => new Float32Array(128),
			),
			timer: null,
			ended: false,
		});
		voices = { music: createVoice(), audition: createVoice() };
		port.onmessage = (event: MessageEvent<RendererCommand>) => {
			const message = event.data;
			if (failed || message.type === "init") return;
			const voice = voices[message.voice];
			if (message.type === "voice") {
				if (voice.state && message.state.generation <= voice.state.generation)
					return;
				voice.state = message.state;
				voice.inFlight = 0;
				voice.ended = false;
				voice.renderer.setState(message.state);
			} else {
				if (voice.pool.length < BUFFER_COUNT) voice.pool.push(message.channels);
				if (message.generation === voice.state?.generation)
					voice.inFlight = Math.max(0, voice.inFlight - 1);
			}
			schedule(message.voice);
		};
		port.start();
		post({ type: "ready" });
	} catch (error) {
		failed = true;
		post({
			type: "error",
			message: error instanceof Error ? error.message : String(error),
		});
	}
};
