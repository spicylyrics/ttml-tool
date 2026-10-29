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
	| { type: "init"; channels: Float32Array[]; wasm: ArrayBuffer }
	| {
			type: "word-cues";
			boundaries: import("../word-cues/model").CueBoundary[];
			volume: number;
	  }
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
