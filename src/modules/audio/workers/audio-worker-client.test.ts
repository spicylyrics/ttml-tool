import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkerRequest, WorkerResponse } from "./types";

const { FakeWorker } = vi.hoisted(() => {
	class FakeWorker {
		static instance: FakeWorker;
		onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
		onerror: ((event: { message: string }) => void) | null = null;
		requests: WorkerRequest[] = [];
		constructor() {
			FakeWorker.instance = this;
		}
		postMessage(request: WorkerRequest) {
			this.requests.push(request);
		}
		terminate = vi.fn();
		emit(data: WorkerResponse) {
			this.onmessage?.({ data });
		}
	}
	return { FakeWorker };
});
vi.mock("./audio.worker.ts?worker", () => ({ default: FakeWorker }));

import { AudioWorkerClient } from "./audio-worker-client";

afterEach(() => vi.restoreAllMocks());
const handlers = () => ({
	onTaskStart: vi.fn(),
	onTaskProgress: vi.fn(),
	onTaskEnd: vi.fn(),
	onError: vi.fn(),
});

describe("audio worker ownership", () => {
	it("terminates obsolete decoding and recreates a usable worker", async () => {
		const client = new AudioWorkerClient(handlers());
		const operation = client.readMetadata(new Blob());
		const obsolete = FakeWorker.instance;
		const rejected = expect(operation).rejects.toMatchObject({
			name: "AbortError",
		});
		client.cancelPending();
		await rejected;
		expect(obsolete.terminate).toHaveBeenCalledOnce();
		expect(FakeWorker.instance).not.toBe(obsolete);
		const latest = client.readMetadata(new Blob());
		const id = FakeWorker.instance.requests[0].id;
		FakeWorker.instance.emit({
			type: "ERROR",
			id,
			error: "Latest request reached worker",
		});
		await expect(latest).rejects.toThrow("Latest request reached worker");
	});

	it("lets an obsolete transcode settle without mutating the replacement song's UI", async () => {
		const ui = handlers();
		const client = new AudioWorkerClient(ui);
		let current = true;
		const operation = client.transcodeToWav(new Blob(), () => current);
		const worker = FakeWorker.instance;
		const id = worker.requests[0].id;
		worker.emit({ type: "EXPORT_WAV_PROGRESS", id, progress: 0.2 });
		expect(ui.onTaskProgress).toHaveBeenCalledWith(0.2);
		current = false;
		worker.emit({ type: "EXPORT_WAV_PROGRESS", id, progress: 0.8 });
		const blob = new Blob(["WAV"]);
		worker.emit({ type: "EXPORT_WAV_DONE", id, blob });
		expect(await operation).toBe(blob);
		expect(ui.onTaskProgress).toHaveBeenCalledOnce();
		expect(ui.onTaskEnd).not.toHaveBeenCalled();
		expect(ui.onError).not.toHaveBeenCalled();
	});
	it("rejects pending and future requests when the worker crashes", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const client = new AudioWorkerClient(handlers());
		const pending = client.readMetadata(new Blob());
		const rejection = expect(pending).rejects.toThrow("worker crashed");
		FakeWorker.instance.onerror?.({ message: "worker crashed" });
		await rejection;
		await expect(client.readMetadata(new Blob())).rejects.toThrow(
			"worker crashed",
		);
	});
	it("rejects an obsolete fallback error without publishing its error or task completion", async () => {
		const ui = handlers();
		const client = new AudioWorkerClient(ui);
		let current = true;
		const pending = client.transcodeToWav(new Blob(), () => current);
		const rejection = expect(pending).rejects.toThrow("decode failed");
		current = false;
		FakeWorker.instance.emit({ type: "ERROR", id: 0, error: "decode failed" });
		await rejection;
		expect(ui.onError).not.toHaveBeenCalled();
		expect(ui.onTaskEnd).not.toHaveBeenCalled();
	});
});
