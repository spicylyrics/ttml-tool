import type { PcmPacket, RenderReport, VoiceState } from "./protocol";

export class BufferedPcmVoice {
	private state: VoiceState | null = null;
	private packets: PcmPacket[] = [];
	private offset = 0;
	private position = 0;
	private renderedSinceSeek = 0;
	private started = false;
	private report: RenderReport = {
		generation: 0,
		startFrame: 0,
		endFrame: 0,
		contextTime: 0,
		renderedFrames: 0,
		ended: false,
	};

	constructor(private recycle: (packet: PcmPacket) => void) {}

	setState(state: VoiceState) {
		if (this.state && state.generation <= this.state.generation) return;
		this.clear();
		this.state = state;
		this.position = state.frame;
	}

	accept(packet: PcmPacket) {
		if (
			!this.state?.playing ||
			packet.report.generation !== this.state.generation
		) {
			this.recycle(packet);
			return;
		}
		this.packets.push(packet);
	}

	clear() {
		for (const packet of this.packets) this.recycle(packet);
		this.packets.length = 0;
		this.offset = 0;
		this.started = false;
		this.renderedSinceSeek = 0;
	}

	render(output: Float32Array[], contextTime: number): RenderReport | null {
		if (!this.state?.playing || this.packets.length === 0) return null;
		if (!this.started) {
			if (
				this.packets.length < 3 &&
				!this.packets.some((packet) => packet.report.ended)
			)
				return null;
			this.started = true;
		}
		const report = this.report;
		report.generation = this.state.generation;
		report.startFrame = this.position;
		report.contextTime = contextTime;
		report.renderedFrames = 0;
		report.ended = false;
		while (
			this.packets.length > 0 &&
			report.renderedFrames < output[0].length
		) {
			const packet = this.packets[0];
			const count = Math.min(
				output[0].length - report.renderedFrames,
				packet.report.renderedFrames - this.offset,
			);
			for (let channel = 0; channel < output.length; channel++) {
				for (let frame = 0; frame < count; frame++)
					output[channel][report.renderedFrames + frame] +=
						packet.channels[channel][this.offset + frame];
			}
			this.offset += count;
			report.renderedFrames += count;
			this.position = Math.min(
				packet.report.endFrame,
				this.state.frame +
					(this.renderedSinceSeek + report.renderedFrames) * this.state.rate,
			);
			if (this.offset === packet.report.renderedFrames) {
				this.position = packet.report.endFrame;
				report.ended = packet.report.ended;
				this.packets.shift();
				this.offset = 0;
				this.recycle(packet);
				if (report.ended) {
					this.state.playing = false;
					break;
				}
			}
		}
		report.endFrame = this.position;
		this.renderedSinceSeek += report.renderedFrames;
		return report;
	}
}
