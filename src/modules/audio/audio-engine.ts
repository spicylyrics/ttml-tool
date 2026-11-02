import i18next from "i18next";
import {
	type AudioTaskType,
	audioBufferAtom,
	audioCoverArtAtom,
	audioErrorAtom,
	audioTaskStateAtom,
	auditionTimeAtom,
	EQ_FREQUENCIES,
	equalizerEnabledAtom,
	equalizerGainsAtom,
	loadedAudioAtom,
} from "$/modules/audio/states/index.ts";
import { AudioWorkerClient } from "$/modules/audio/workers/audio-worker-client";
import { globalStore } from "$/states/store.ts";
import { log } from "$/utils/logging";
import { PcmClock, replayFrame, seekFrame } from "./utils/pcm-clock";
import { clampPlaybackRate } from "./utils/playback-rate";
import type { AudioMetadata } from "./workers/types";
import playerUrl from "./worklet/audio.worklet.ts?worker&url";
import type {
	PlayerCommand,
	PlayerEvent,
	RendererCommand,
	RenderReport,
	VoiceId,
} from "./worklet/protocol";
import wasmUrl from "./worklet/vendor/soundtouch_bg.wasm?url";

interface PendingStart {
	generation: number;
	resolve: () => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

const AUDIO_ERRORS = {
	noAudio: "Please load an audio file first.",
	contextStart: "Audio could not start. Try pressing Play again.",
	workletInit: "The audio player could not initialize.",
	workletStart: "The audio player did not start playback.",
} as const;

function audioErrorMessage(key: keyof typeof AUDIO_ERRORS) {
	return (
		i18next.t(`audio.error.${key}`, AUDIO_ERRORS[key]) || AUDIO_ERRORS[key]
	);
}

export class AudioEngine extends EventTarget {
	public workerClient: AudioWorkerClient;
	//#region Audio context basics
	private _ctx: AudioContext | null = null;
	get ctx() {
		if (this._ctx) return this._ctx;
		this._ctx = new AudioContext({
			latencyHint: "interactive",
		});
		log(
			"AudioContext created with latency",
			this._ctx.baseLatency,
			this._ctx.outputLatency,
		);
		return this._ctx;
	}

	private _volume = 0.5;
	private gainNode: GainNode | null = null;
	private get gain() {
		if (this.gainNode) return this.gainNode;
		this.gainNode = this.ctx.createGain();
		this.gainNode.gain.value = this._volume;
		this.gainNode.connect(this.ctx.destination);
		return this.gainNode;
	}

	private _eqNodes: BiquadFilterNode[] = [];
	private get eqNodes() {
		if (this._eqNodes.length > 0) return this._eqNodes;

		const nodes: BiquadFilterNode[] = [];
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);

		EQ_FREQUENCIES.forEach((freq, i) => {
			const node = this.ctx.createBiquadFilter();
			node.type =
				i === 0
					? "lowshelf"
					: i === EQ_FREQUENCIES.length - 1
						? "highshelf"
						: "peaking";
			node.frequency.value = freq;
			node.gain.value = enabled ? gains[i] : 0;
			node.Q.value = 1;
			nodes.push(node);
		});

		// Connect chain
		for (let i = 0; i < nodes.length - 1; i++) {
			nodes[i].connect(nodes[i + 1]);
		}

		// Final node connects to gain
		nodes[nodes.length - 1].connect(this.gain);

		this._eqNodes = nodes;
		return nodes;
	}

	public updateEqGains() {
		const gains = globalStore.get(equalizerGainsAtom);
		const enabled = globalStore.get(equalizerEnabledAtom);
		this.eqNodes.forEach((node, i) => {
			node.gain.setTargetAtTime(
				enabled ? gains[i] : 0,
				this.ctx.currentTime,
				0.05,
			);
		});
	}

	private _analyserNode: AnalyserNode | null = null;
	/** A read-only analysis tap for visualizers. It is connected in parallel and never changes playback output. */
	get analyserNode() {
		if (this._analyserNode) return this._analyserNode;
		const analyser = this.ctx.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.78;
		this.eqNodes[this.eqNodes.length - 1].connect(analyser);
		this._analyserNode = analyser;
		return analyser;
	}

	public get eqEntryPoint() {
		return this.eqNodes[0];
	}
	//#endregion

	constructor() {
		super();
		this.workerClient = new AudioWorkerClient({
			onTaskStart: (type: AudioTaskType) =>
				globalStore.set(audioTaskStateAtom, { type, progress: 0 }),
			onTaskProgress: (progress: number) => {
				const current = globalStore.get(audioTaskStateAtom);
				if (current)
					globalStore.set(audioTaskStateAtom, { ...current, progress });
			},
			onTaskEnd: () => globalStore.set(audioTaskStateAtom, null),
			onError: (message: string) => globalStore.set(audioErrorAtom, message),
		});
	}

	public musicBuffer: AudioBuffer | null = null;
	/** Raw parsed tags (title/artist/album included when present); music-metadata signals availability. */
	public musicMetadata: AudioMetadata | null = null;
	private node: AudioWorkletNode | null = null;
	private renderer: Worker | null = null;
	private playerReady: Promise<void> | null = null;
	private loadGeneration = 0;
	private loadAbort: AbortController | null = null;
	private workletReady: Promise<void> | null = null;
	private wasmBytes: Promise<ArrayBuffer> | null = null;
	private musicClock = new PcmClock();
	private auditionClock = new PcmClock();
	private musicGeneration = 0;
	private auditionGeneration = 0;
	private playing = false;
	private auditionPlaying = false;
	private auditionEnd = 0;
	private musicEndReport: RenderReport | null = null;
	private auditionEndReport: RenderReport | null = null;
	private updateTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingStarts = new Map<VoiceId, PendingStart>();
	private _musicPlayBackRate = 1;
	private _preservesPitch = true;

	get musicLoaded() {
		return this.musicBuffer !== null;
	}
	get musicPlaying() {
		return this.playing && this.ctx.state === "running";
	}
	get musicDuration() {
		return this.musicBuffer?.duration ?? 0;
	}
	get musicCurrentTime() {
		if (!this.musicBuffer) return 0;
		return (
			this.musicClock.frameAt(
				this.audibleContextTime,
				this.musicBuffer.sampleRate,
			) / this.musicBuffer.sampleRate
		);
	}
	/** Compatibility name: interpolation occurs only inside confirmed rendered blocks. */
	get interpolatedCurrentTime() {
		return this.musicCurrentTime;
	}
	get musicPlayBackRate() {
		return this._musicPlayBackRate;
	}
	set musicPlayBackRate(value: number) {
		const rate = clampPlaybackRate(value);
		if (rate === this._musicPlayBackRate) return;
		this._musicPlayBackRate = rate;
		this.refreshVoices();
		this.dispatchEvent(new Event("music-playback-rate-change"));
	}
	get preservesPitch() {
		return this._preservesPitch;
	}
	set preservesPitch(value: boolean) {
		if (value === this._preservesPitch) return;
		this._preservesPitch = value;
		this.refreshVoices();
		this.dispatchEvent(new Event("music-preserves-pitch-change"));
	}
	get volume() {
		return this._volume;
	}
	set volume(value: number) {
		if (!Number.isFinite(value)) return;
		this._volume = Math.max(0, Math.min(1, value));
		this.gain.gain.value = this._volume;
		this.dispatchEvent(new Event("volume-change"));
	}
	get ctxCurrentTime() {
		return this.ctx.currentTime;
	}
	get ctxBaseLatency() {
		return this.ctx.baseLatency;
	}
	get ctxOutputLatency() {
		return this.ctx.outputLatency ?? 0;
	}
	/** Context time of the sample being heard now, the clock sync stamps use. */
	get audibleContextTime() {
		// getOutputTimestamp supplies the device's audible context time, including graph/device latency.
		const stamp = this.ctx.getOutputTimestamp?.();
		if (stamp?.performanceTime && stamp.contextTime !== undefined) {
			return Math.min(
				this.ctx.currentTime,
				stamp.contextTime +
					Math.max(0, performance.now() - stamp.performanceTime) / 1000,
			);
		}
		return Math.max(
			0,
			this.ctx.currentTime - this.ctxBaseLatency - this.ctxOutputLatency,
		);
	}

	private post(command: PlayerCommand) {
		this.node?.port.postMessage(command);
	}
	private clock(voice: VoiceId) {
		return voice === "music" ? this.musicClock : this.auditionClock;
	}
	private setVoice(
		voice: VoiceId,
		frame: number,
		playing: boolean,
		endFrame = this.musicBuffer?.length ?? 0,
		continuous = false,
	) {
		const generation =
			voice === "music" ? ++this.musicGeneration : ++this.auditionGeneration;
		this.cancelStart(voice);
		if (continuous) this.clock(voice).continueAs(generation);
		else this.clock(voice).reset(generation, frame);
		if (voice === "music") this.musicEndReport = null;
		else this.auditionEndReport = null;
		this.post({
			type: "voice",
			voice,
			state: {
				generation,
				frame,
				endFrame,
				playing,
				rate: this._musicPlayBackRate,
				preservesPitch: this._preservesPitch,
			},
		});
		return generation;
	}
	/**
	 * Speed or pitch mode changed. While playing, carry on from the last frame
	 * already sent to the device and keep the clock's history, so the audio in
	 * flight is neither replayed nor skipped.
	 */
	private refreshVoices() {
		if (!this.musicBuffer) return;
		const frame = this.playing
			? Math.round(this.musicClock.renderedFrame)
			: seekFrame(
					this.musicCurrentTime,
					this.musicBuffer.sampleRate,
					this.musicBuffer.length,
				);
		this.setVoice("music", frame, this.playing, undefined, this.playing);
		if (this.auditionPlaying) {
			this.setVoice(
				"audition",
				Math.round(this.auditionClock.renderedFrame),
				true,
				this.auditionEnd,
				true,
			);
		}
	}
	seekMusic(offset: number) {
		if (!this.musicBuffer) return;
		const frame = seekFrame(
			offset,
			this.musicBuffer.sampleRate,
			this.musicBuffer.length,
		);
		this.setVoice("music", frame, this.playing);
		this.dispatchEvent(new Event("music-seeked"));
	}

	private async resumeContext() {
		if (this.ctx.state !== "running") {
			await this.withTimeout(
				this.ctx.resume(),
				audioErrorMessage("contextStart"),
			);
		}
		if (this.ctx.state !== "running")
			throw new Error(audioErrorMessage("contextStart"));
	}
	resumeOrSeekMusic(offset = this.musicCurrentTime) {
		return this.observePlayback(this.startMusic(offset), "music");
	}
	private async startMusic(offset: number) {
		if (!this.musicBuffer || !this.node)
			throw new Error(audioErrorMessage("noAudio"));
		const load = this.loadGeneration;
		const request = this.musicGeneration;
		await this.resumeContext();
		if (this.playerReady)
			await this.withTimeout(
				this.playerReady,
				audioErrorMessage("workletInit"),
			);
		if (load !== this.loadGeneration || request !== this.musicGeneration)
			throw new DOMException("Playback replaced", "AbortError");
		const frame = replayFrame(
			seekFrame(offset, this.musicBuffer.sampleRate, this.musicBuffer.length),
			this.musicBuffer.sampleRate,
			this.musicBuffer.length,
		);
		const generation = this.setVoice("music", frame, true);
		this.dispatchEvent(new Event("music-seeked"));
		await this.waitForStart("music", generation);
	}
	play() {
		return this.resumeOrSeekMusic();
	}
	private observePlayback(operation: Promise<void>, voice: VoiceId) {
		const generation = this.loadGeneration;
		// UI event handlers can discard the promise; callers that await it still see rejection.
		void operation.catch((error: unknown) => {
			if (
				generation !== this.loadGeneration ||
				(error instanceof Error && error.name === "AbortError")
			)
				return;
			if (voice === "music") this.pauseMusic();
			else this.stopAudition();
			globalStore.set(
				audioErrorAtom,
				error instanceof Error ? error.message : String(error),
			);
		});
		return operation;
	}
	private waitForStart(voice: VoiceId, generation: number) {
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pendingStarts.delete(voice);
				if (voice === "music") this.pauseMusic();
				else this.stopAudition();
				reject(new Error(audioErrorMessage("workletStart")));
			}, 10000);
			this.pendingStarts.set(voice, { generation, resolve, reject, timer });
		});
	}
	private cancelStart(
		voice: VoiceId,
		error: Error = new DOMException("Playback cancelled", "AbortError"),
	) {
		const pending = this.pendingStarts.get(voice);
		if (!pending) return;
		clearTimeout(pending.timer);
		this.pendingStarts.delete(voice);
		pending.reject(error);
	}
	pauseMusic() {
		if (this.musicBuffer) {
			const frame = seekFrame(
				this.musicCurrentTime,
				this.musicBuffer.sampleRate,
				this.musicBuffer.length,
			);
			this.setVoice("music", frame, false);
		} else this.cancelStart("music");
		this.playing = false;
		this.stopAudition();
		this.stopUpdates();
		this.dispatchEvent(new Event("music-timeupdate"));
		this.dispatchEvent(new Event("music-pause"));
	}
	stopAudition() {
		this.setVoice("audition", 0, false);
		this.auditionPlaying = false;
		globalStore.set(auditionTimeAtom, null);
		if (!this.playing) this.stopUpdates();
	}
	auditionRange(start: number, end: number) {
		return this.observePlayback(this.startAudition(start, end), "audition");
	}
	private async startAudition(start: number, end: number) {
		if (!this.musicBuffer || !this.node)
			throw new Error(audioErrorMessage("noAudio"));
		const load = this.loadGeneration;
		this.stopAudition();
		const request = this.auditionGeneration;
		const startFrame = seekFrame(
			start,
			this.musicBuffer.sampleRate,
			this.musicBuffer.length,
		);
		const endFrame = seekFrame(
			end,
			this.musicBuffer.sampleRate,
			this.musicBuffer.length,
		);
		if (endFrame <= startFrame) return;
		await this.resumeContext();
		if (this.playerReady)
			await this.withTimeout(
				this.playerReady,
				audioErrorMessage("workletInit"),
			);
		if (load !== this.loadGeneration || request !== this.auditionGeneration)
			throw new DOMException("Audition replaced", "AbortError");
		this.auditionEnd = endFrame;
		const generation = this.setVoice("audition", startFrame, true, endFrame);
		await this.waitForStart("audition", generation);
	}

	private receiveReport(voice: VoiceId, report: RenderReport) {
		if (!this.clock(voice).push(report)) return;
		const pending = this.pendingStarts.get(voice);
		if (
			pending &&
			pending.generation === report.generation &&
			report.renderedFrames > 0
		) {
			clearTimeout(pending.timer);
			this.pendingStarts.delete(voice);
			if (voice === "music") {
				this.playing = true;
				this.dispatchEvent(new Event("music-resume"));
			} else this.auditionPlaying = true;
			pending.resolve();
			this.startUpdates();
		}
		if (report.ended) {
			if (voice === "music") this.musicEndReport = report;
			else this.auditionEndReport = report;
			this.startUpdates();
		}
	}
	private startUpdates() {
		if (this.updateTimer !== null) return;
		const tick = () => {
			this.updateTimer = null;
			const sampleRate = this.musicBuffer?.sampleRate ?? this.ctx.sampleRate;
			const audible = this.audibleContextTime;
			const hasEnded = (report: RenderReport | null) =>
				report &&
				audible >= report.contextTime + report.renderedFrames / sampleRate;
			if (hasEnded(this.musicEndReport)) {
				const report = this.musicEndReport;
				if (report)
					this.musicClock.reset(this.musicGeneration, report.endFrame);
				this.musicEndReport = null;
				this.playing = false;
				this.dispatchEvent(new Event("music-timeupdate"));
				this.dispatchEvent(new Event("music-pause"));
			}
			if (hasEnded(this.auditionEndReport)) this.stopAudition();
			else if (this.auditionPlaying) {
				globalStore.set(
					auditionTimeAtom,
					this.auditionClock.frameAt(audible, sampleRate) / sampleRate,
				);
			}
			if (
				this.auditionPlaying ||
				this.musicEndReport ||
				this.auditionEndReport
			) {
				this.updateTimer = setTimeout(tick, 16);
			}
		};
		this.updateTimer = setTimeout(tick, 0);
	}
	private stopUpdates() {
		if (this.updateTimer !== null) clearTimeout(this.updateTimer);
		this.updateTimer = null;
	}

	private setEmbeddedCoverArt(coverUrl: string | null) {
		const previous = globalStore.get(audioCoverArtAtom);
		if (previous && previous !== coverUrl) URL.revokeObjectURL(previous);
		globalStore.set(audioCoverArtAtom, coverUrl);
	}
	unloadMusic() {
		++this.loadGeneration;
		this.loadAbort?.abort();
		this.loadAbort = null;
		this.workerClient.cancelPending();
		this.pauseMusic();
		this.post({ type: "destroy" });
		this.node?.disconnect();
		if (this.node) this.node.port.close();
		this.node = null;
		this.renderer?.terminate();
		this.renderer = null;
		this.playerReady = null;
		this.musicBuffer = null;
		this.musicMetadata = null;
		this.musicClock.reset(++this.musicGeneration, 0);
		globalStore.set(audioBufferAtom, null);
		globalStore.set(loadedAudioAtom, new Blob([]));
		globalStore.set(audioTaskStateAtom, null);
		this.setEmbeddedCoverArt(null);
		this.dispatchEvent(new Event("music-unload"));
	}
	private withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(message)), 10000);
			operation.then(
				(value) => {
					clearTimeout(timer);
					resolve(value);
				},
				(error) => {
					clearTimeout(timer);
					reject(error);
				},
			);
		});
	}
	private async prepareWorklet() {
		this.workletReady ??= this.ctx.audioWorklet
			.addModule(playerUrl)
			.catch((error) => {
				this.workletReady = null;
				throw error;
			});
		this.wasmBytes ??= fetch(wasmUrl)
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`SoundTouch download failed: ${response.status}`);
				const bytes = await response.arrayBuffer();
				await WebAssembly.compile(bytes);
				return bytes;
			})
			.catch((error) => {
				this.wasmBytes = null;
				throw error;
			});
		const [, wasm] = await Promise.all([this.workletReady, this.wasmBytes]);
		return wasm;
	}
	async loadMusic(src: Blob): Promise<AudioBuffer> {
		this.unloadMusic();
		const generation = this.loadGeneration;
		const abort = new AbortController();
		this.loadAbort = abort;
		const current = () =>
			generation === this.loadGeneration && !abort.signal.aborted;
		const assertCurrent = () => {
			if (!current())
				throw new DOMException("Audio load replaced", "AbortError");
		};
		globalStore.set(audioErrorAtom, null);
		globalStore.set(audioTaskStateAtom, { type: "LOADING", progress: 0 });
		this.dispatchEvent(new Event("music-loading"));
		void this.workerClient
			.readMetadata(src)
			.then((metadata) => {
				if (!current()) {
					if (metadata.coverUrl) URL.revokeObjectURL(metadata.coverUrl);
					return;
				}
				this.musicMetadata = metadata;
				this.setEmbeddedCoverArt(metadata.coverUrl ?? null);
				this.dispatchEvent(new Event("music-metadata"));
			})
			.catch(() => {
				/* Tag-less files remain playable. */
			});
		let node: AudioWorkletNode | null = null;
		let renderer: Worker | null = null;
		let rejectInit: ((error: Error) => void) | null = null;
		const operation = async () => {
			let buffer: AudioBuffer;
			const bytes = await src.arrayBuffer();
			assertCurrent();
			try {
				buffer = await this.ctx.decodeAudioData(bytes);
			} catch {
				assertCurrent();
				const wav = await this.workerClient.transcodeToWav(src, current);
				assertCurrent();
				const wavBytes = await wav.arrayBuffer();
				assertCurrent();
				buffer = await this.ctx.decodeAudioData(wavBytes);
			}
			assertCurrent();
			const wasm = await this.withTimeout(
				this.prepareWorklet(),
				audioErrorMessage("workletInit"),
			);
			assertCurrent();
			node = new AudioWorkletNode(this.ctx, "pcm-player", {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [buffer.numberOfChannels],
			});
			const ownedNode = node;
			const ready = new Promise<void>((resolve, reject) => {
				rejectInit = reject;
				ownedNode.onprocessorerror = () => {
					const error = new Error("Audio worklet processor failed");
					reject(error);
					if (current() && this.node === ownedNode) this.failPlayback(error);
				};
				ownedNode.port.onmessage = (event: MessageEvent<PlayerEvent>) => {
					if (!current()) return;
					const message = event.data;
					if (message.type === "ready") resolve();
					else if (message.type === "error") {
						const error = new Error(message.message);
						reject(error);
						if (this.node === ownedNode) this.failPlayback(error);
					} else this.receiveReport(message.voice, message.report);
				};
			});
			// Chromium services worklet control messages only while the context runs.
			// Prepare a suspended song now; acknowledge DSP initialization on its first play.
			const cancelReady = () =>
				rejectInit?.(new DOMException("Audio load replaced", "AbortError"));
			abort.signal.addEventListener("abort", cancelReady, { once: true });
			void ready.then(
				() => abort.signal.removeEventListener("abort", cancelReady),
				() => abort.signal.removeEventListener("abort", cancelReady),
			);
			ownedNode.connect(this.eqEntryPoint);
			const channels = Array.from(
				{ length: buffer.numberOfChannels },
				(_, channel) => buffer.getChannelData(channel).slice(),
			);
			renderer = new Worker(
				new URL("./workers/pcm-render.worker.ts", import.meta.url),
				{ type: "module" },
			);
			renderer.onerror = (event) => {
				const error = new Error(event.message || "Audio renderer failed");
				rejectInit?.(error);
				if (current() && this.node === ownedNode) this.failPlayback(error);
			};
			const channel = new MessageChannel();
			const command: RendererCommand = {
				type: "init",
				channels,
				wasm,
				sampleRate: buffer.sampleRate,
				port: channel.port1,
			};
			renderer.postMessage(command, [
				channel.port1,
				...channels.map((channel) => channel.buffer),
			]);
			ownedNode.port.postMessage(
				{ type: "init", port: channel.port2 } satisfies PlayerCommand,
				[channel.port2],
			);
			if (this.ctx.state === "running") {
				await this.withTimeout(ready, audioErrorMessage("workletInit"));
			}
			assertCurrent();
			this.node = ownedNode;
			this.renderer = renderer;
			this.playerReady = ready;
			this.musicBuffer = buffer;
			globalStore.set(audioBufferAtom, buffer);
			globalStore.set(loadedAudioAtom, src);
			globalStore.set(audioTaskStateAtom, null);
			this.dispatchEvent(new Event("music-load"));
			return buffer;
		};
		return new Promise<AudioBuffer>((resolve, reject) => {
			const cancel = () => {
				const error = new DOMException("Audio load replaced", "AbortError");
				rejectInit?.(error);
				renderer?.terminate();
				if (node) {
					node.port.postMessage({ type: "destroy" });
					node.disconnect();
					node.port.close();
				}
				reject(error);
			};
			abort.signal.addEventListener("abort", cancel, { once: true });
			operation()
				.then(resolve, (error) => {
					renderer?.terminate();
					if (node) {
						node.port.postMessage({ type: "destroy" });
						node.disconnect();
						node.port.close();
					}
					if (current()) {
						this.node = null;
						globalStore.set(audioTaskStateAtom, null);
						globalStore.set(
							audioErrorAtom,
							error instanceof Error ? error.message : String(error),
						);
						this.dispatchEvent(new Event("music-load-error"));
						// Failed sessions no longer own pending metadata/fallback callbacks.
						abort.signal.removeEventListener("abort", cancel);
						abort.abort();
					}
					reject(error);
				})
				.finally(() => abort.signal.removeEventListener("abort", cancel));
		});
	}
	private failPlayback(error: Error) {
		this.cancelStart("music", error);
		this.cancelStart("audition", error);
		this.unloadMusic();
		globalStore.set(audioErrorAtom, error.message);
		this.dispatchEvent(new Event("music-load-error"));
	}
	async playSound(
		audioBuffer: AudioBuffer,
		when?: number,
		offset?: number,
		duration?: number,
	) {
		await this.resumeContext();
		const source = this.ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(this.eqEntryPoint);
		source.start(when, offset, duration);
		source.addEventListener("ended", () => source.disconnect());
	}
	async playNode(node: AudioScheduledSourceNode, when?: number, stop?: number) {
		await this.resumeContext();
		node.connect(this.eqEntryPoint);
		node.start(when);
		node.addEventListener("ended", () => node.disconnect());
		if (stop) node.stop(stop);
	}
	decodeAudioData(
		audioData: ArrayBuffer,
		successCallback?: DecodeSuccessCallback | null,
		errorCallback?: DecodeErrorCallback | null,
	): Promise<AudioBuffer> {
		return this.ctx.decodeAudioData(audioData, successCallback, errorCallback);
	}
}

export const audioEngine = new AudioEngine();
