import { describe, expect, it, vi } from "vitest";
import { createPlaybackClock } from "./clock";

function setup(playing = false) {
	let seconds = 0;
	const read = vi.fn(() => seconds);
	class FakeEngine extends EventTarget {
		musicPlaying = playing;
		get interpolatedCurrentTime() {
			return read();
		}
	}
	const source = new FakeEngine();
	const pending = new Map<number, FrameRequestCallback>();
	let id = 0;
	let now = 0;
	const frames = {
		request: vi.fn((callback: FrameRequestCallback) => {
			pending.set(++id, callback);
			return id;
		}),
		cancel: vi.fn((frame: number) => pending.delete(frame)),
		now: () => now,
	};
	const clock = createPlaybackClock(source, frames);
	const tick = (position: number) => {
		seconds = position;
		now += 16;
		const callbacks = [...pending.values()];
		pending.clear();
		for (const callback of callbacks) callback(now);
	};
	const event = (name: string, position = seconds) => {
		seconds = position;
		source.dispatchEvent(new Event(name));
	};
	return { clock, source, read, pending, frames, tick, event };
}

describe("UI playback clock", () => {
	it("publishes the final paused state once for the engine's paired events", () => {
		const { clock, source, event, tick, pending } = setup(true);
		const listener = vi.fn();
		clock.subscribe(listener);
		tick(1);
		listener.mockClear();
		source.musicPlaying = false;
		event("music-timeupdate", 1.01);
		event("music-pause", 1.01);
		expect(listener).toHaveBeenCalledOnce();
		expect(clock.getSnapshot()).toBe(1.01);
		expect(pending.size).toBe(0);
		source.musicPlaying = true;
		event("music-resume", 1.01);
		event("music-resume", 1.01);
		expect(listener).toHaveBeenCalledTimes(2);
		expect(pending.size).toBe(1);
		clock.dispose();
	});

	it("still publishes explicit seeks and stalled playback frames at an unchanged position", () => {
		const { clock, source, event, tick } = setup();
		const listener = vi.fn();
		clock.subscribe(listener);
		event("music-seeked", 0);
		event("music-seeked", 0);
		expect(listener).toHaveBeenCalledTimes(2);
		source.musicPlaying = true;
		event("music-resume", 0);
		listener.mockClear();
		tick(0);
		tick(0);
		expect(listener).toHaveBeenCalledTimes(2);
		clock.dispose();
	});

	it("shares one frame and one engine read among all subscribers", () => {
		const { clock, source, read, pending, tick, event } = setup();
		const listeners = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
		for (const listener of listeners) clock.subscribe(listener);
		expect(pending.size).toBe(0);
		source.musicPlaying = true;
		event("music-resume");
		expect(pending.size).toBe(1);
		read.mockClear();
		event("music-timeupdate", 0.12);
		event("music-timeupdate", 0.13);
		expect(read).not.toHaveBeenCalled();
		tick(0.140125);
		expect(read).toHaveBeenCalledTimes(1);
		for (const listener of listeners)
			expect(listener).toHaveBeenLastCalledWith(0.140125, 16, false);
		expect(pending.size).toBe(1);
		clock.dispose();
		expect(pending.size).toBe(0);
	});

	it("publishes paused seeks synchronously and remains idle", () => {
		const { clock, pending, event } = setup();
		const listener = vi.fn();
		clock.subscribe(listener);
		event("music-seeked", 8.125);
		expect(clock.getSnapshot()).toBe(8.125);
		expect(listener).toHaveBeenLastCalledWith(8.125, 0, true);
		expect(pending.size).toBe(0);
		clock.dispose();
	});

	it("never extrapolates stalled engine time or adjusts it for playback rate", () => {
		const { clock, event, tick } = setup(true);
		const listener = vi.fn();
		clock.subscribe(listener);
		tick(0.5);
		for (let i = 0; i < 20; i++) tick(0.5);
		expect(clock.getSnapshot()).toBe(0.5);
		// A rate event requires neither another loop nor another time estimate.
		event("music-playback-rate-change");
		tick(0.508);
		expect(clock.getSnapshot()).toBe(0.508);
		clock.dispose();
	});

	it("cancels immediately on pause, restarts once, and resets on unload", () => {
		const { clock, source, event, tick, pending } = setup(true);
		tick(3);
		source.musicPlaying = false;
		event("music-pause", 3.01);
		expect(clock.getSnapshot()).toBe(3.01);
		expect(pending.size).toBe(0);
		source.musicPlaying = true;
		event("music-resume");
		event("music-resume");
		expect(pending.size).toBe(1);
		source.musicPlaying = false;
		event("music-unload", 0);
		expect(clock.getSnapshot()).toBe(0);
		expect(pending.size).toBe(0);
		clock.dispose();
	});

	it("unsubscribes cleanly and retains seeks made without a mounted view", () => {
		const { clock, event } = setup();
		const oldView = vi.fn();
		const unsubscribe = clock.subscribe(oldView);
		unsubscribe();
		event("music-seeked", 6);
		expect(oldView).not.toHaveBeenCalled();
		expect(clock.getSnapshot()).toBe(6);
		clock.dispose();
		event("music-seeked", 9);
		expect(clock.getSnapshot()).toBe(6);
	});
});
