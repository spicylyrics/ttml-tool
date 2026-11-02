export function getLatencyStatistics(samples: number[], appliedOffset: number) {
	if (samples.length === 0) return null;
	const corrected = samples.map((sample) => sample - appliedOffset / 1000);
	const sorted = [...corrected].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 0
			? (sorted[middle - 1] + sorted[middle]) / 2
			: sorted[middle];
	return {
		current: Math.round(corrected[corrected.length - 1] * 1000),
		min: Math.round(sorted[0] * 1000),
		max: Math.round(sorted[sorted.length - 1] * 1000),
		count: samples.length,
		meanAbsoluteError: Math.round(
			(corrected.reduce((total, value) => total + Math.abs(value), 0) /
				samples.length) *
				1000,
		),
		recommendedOffset:
			samples.length >= 20 ? Math.round(median * 1000 + appliedOffset) : null,
	};
}

export function subscribeLatencyTestTaps<Event>(
	active: boolean,
	subscribe: (callback: (event: Event) => void) => () => void,
	onTap: (event: Event) => void,
): (() => void) | undefined {
	if (!active) return;
	let closed = false;
	const unsubscribe = subscribe((event) => {
		if (!closed) onTap(event);
	});
	return () => {
		closed = true;
		unsubscribe();
	};
}
