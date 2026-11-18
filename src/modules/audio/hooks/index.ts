import { clampZoom as clampSpectrogramZoom } from "$/modules/spectrogram/utils/zoom";

export * from "./useAudioRegion";
export * from "./useHoverGuide";

export const clampZoom = (
	z: number,
	durationSeconds: number,
	viewWidthPx: number,
) => clampSpectrogramZoom(z, durationSeconds, viewWidthPx, 1000);
export const clampScroll = (
	s: number,
	currentZoom: number,
	totalDurationMs: number,
	containerWidthPx: number,
) => {
	if (totalDurationMs <= 0) return 0;
	const durationS = totalDurationMs / 1000;
	const totalWidth = durationS * currentZoom;
	const maxScroll = Math.max(0, totalWidth - containerWidthPx);
	return Math.max(0, Math.min(s, maxScroll));
};
