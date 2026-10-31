export type VoiceId = "music" | "audition";

export interface VoiceState {
	generation: number;
	frame: number;
	endFrame: number;
	playing: boolean;
	rate: number;
	preservesPitch: boolean;
}

export type PlayerCommand =
	| { type: "init"; port: MessagePort }
	| { type: "voice"; voice: VoiceId; state: VoiceState }
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
