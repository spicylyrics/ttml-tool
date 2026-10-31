export interface PlaybackTimeSource extends EventTarget {
	readonly interpolatedCurrentTime: number;
	readonly musicPlaying: boolean;
}

export type PlaybackClockListener = (
	positionSeconds: number,
	now: number,
	seeked: boolean,
) => void;

/** One engine sample per frame, shared by React and imperative renderers. */
export function createPlaybackClock(
	source: PlaybackTimeSource,
	frames: {
		request: (callback: FrameRequestCallback) => number;
		cancel: (id: number) => void;
		now: () => number;
	},
) {
	let position = source.interpolatedCurrentTime;
	let playing = source.musicPlaying;
	let frame: number | null = null;
	let disposed = false;
	const listeners = new Set<PlaybackClockListener>();
	const publish = (now: number, seeked = false, skipUnchanged = false) => {
		const nextPosition = source.interpolatedCurrentTime;
		const nextPlaying = source.musicPlaying;
		if (
			skipUnchanged &&
			Object.is(position, nextPosition) &&
			playing === nextPlaying
		)
			return;
		position = nextPosition;
		playing = nextPlaying;
		for (const listener of listeners) listener(position, now, seeked);
	};
	const schedule = () => {
		if (!disposed && frame === null && source.musicPlaying) {
			frame = frames.request((now) => {
				frame = null;
				publish(now);
				schedule();
			});
		}
	};
	const stop = () => {
		if (frame !== null) frames.cancel(frame);
		frame = null;
	};
	const onChange = (event: Event) => {
		if (event.type !== "music-timeupdate" || !source.musicPlaying) {
			const seeked = event.type === "music-seeked";
			publish(
				frames.now(),
				seeked,
				!seeked && event.type !== "music-load" && event.type !== "music-unload",
			);
		}
		if (source.musicPlaying) schedule();
		else stop();
	};
	const events = [
		"music-resume",
		"music-pause",
		"music-seeked",
		"music-timeupdate",
		"music-load",
		"music-unload",
	];
	for (const event of events) source.addEventListener(event, onChange);
	schedule();
	return {
		getSnapshot: () => position,
		subscribe: (listener: PlaybackClockListener) => {
			listeners.add(listener);
			schedule();
			return () => {
				listeners.delete(listener);
			};
		},
		dispose: () => {
			disposed = true;
			stop();
			for (const event of events) source.removeEventListener(event, onChange);
			listeners.clear();
		},
	};
}
