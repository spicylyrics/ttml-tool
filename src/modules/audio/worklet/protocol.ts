export type VoiceId = "music" | "audition";

export interface VoiceState {
	generation: number;
	frame: number;
	endFrame: number;
	playing: boolean;
	rate: number;
	preservesPitch: boolean;
}

export interface ScrubState {
	active: boolean;
	frame: number;
	preservesPitch: boolean;
}

/** The decoded song in shared memory, so the worklet can scrub it directly. */
export interface ScrubSource {
	channels: Float32Array[];
	sampleRate: number;
	signalsmithWasm: ArrayBuffer;
}

export type PlayerCommand =
	| { type: "init"; port: MessagePort; scrub: ScrubSource | null }
	| { type: "voice"; voice: VoiceId; state: VoiceState }
	| { type: "scrub"; state: ScrubState }
	| { type: "destroy" };

export interface RenderReport {
	generation: number;
	startFrame: number;
	endFrame: number;
	contextTime: number;
	renderedFrames: number;
	ended: boolean;
}

export type PlayerEvent =
	| { type: "ready" }
	| { type: "error"; message: string }
	| { type: "render"; voice: VoiceId; report: RenderReport };

export interface PcmPacket {
	type: "pcm";
	voice: VoiceId;
	channels: Float32Array[];
	report: RenderReport;
}

export type RendererCommand =
	| {
			type: "init";
			channels: Float32Array[];
			wasm: ArrayBuffer;
			sampleRate: number;
			port: MessagePort;
	  }
	| Extract<PlayerCommand, { type: "voice" }>
	| {
			type: "recycle";
			voice: VoiceId;
			generation: number;
			channels: Float32Array[];
	  };

export type RendererEvent =
	| PcmPacket
	| Extract<PlayerEvent, { type: "ready" | "error" }>;
