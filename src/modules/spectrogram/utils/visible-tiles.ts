import type { Dispatch, SetStateAction } from "react";
import type { useSpectrogramWorker } from "$/modules/spectrogram/hooks/useSpectrogramWorker.ts";
import type { TileComponentProps } from "../components/TileComponent.tsx";

const TILE_DURATION_S = 5;
const LOD_WIDTHS = [512, 1024, 2048, 4096, 8192];

export function updateVisibleSpectrogramTiles({
	audioBuffer,
	scrollContainerRef,
	containerWidth,
	gain,
	dataHeight,
	requestTileIfNeeded,
	tileCache,
	palette,
	zoom,
	scrollLeft,
	fftSize,
	setVisibleTiles,
}: {
	audioBuffer: AudioBuffer | null;
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	containerWidth: number;
	gain: number;
	dataHeight: number;
	requestTileIfNeeded: ReturnType<
		typeof useSpectrogramWorker
	>["requestTileIfNeeded"];
	tileCache: ReturnType<typeof useSpectrogramWorker>["tileCache"];
	palette: { id: string };
	zoom: number;
	scrollLeft: number;
	fftSize: number;
	setVisibleTiles: Dispatch<SetStateAction<TileComponentProps[]>>;
}) {
	if (!audioBuffer || !scrollContainerRef.current) return;

	const pixelsPerSecond = zoom;
	const tileDisplayWidthPx = TILE_DURATION_S * pixelsPerSecond;
	const totalTiles = Math.ceil(audioBuffer.duration / TILE_DURATION_S);

	const viewStart = scrollLeft;
	const viewEnd = viewStart + containerWidth;

	const firstVisibleIndex = Math.floor(viewStart / tileDisplayWidthPx);
	const lastVisibleIndex = Math.ceil(viewEnd / tileDisplayWidthPx);

	const newVisibleTiles: TileComponentProps[] = [];

	const currentPaletteId = palette.id;

	for (let i = firstVisibleIndex - 2; i <= lastVisibleIndex + 2; i++) {
		if (i < 0 || i >= totalTiles) continue;

		const cacheId = `tile-${i}`;
		const targetLodWidth =
			LOD_WIDTHS.find((w) => w >= tileDisplayWidthPx) ||
			LOD_WIDTHS[LOD_WIDTHS.length - 1];

		requestTileIfNeeded({
			tileIndex: i,
			startTime: i * TILE_DURATION_S,
			endTime: i * TILE_DURATION_S + TILE_DURATION_S,
			gain: gain,
			height: dataHeight,
			tileWidthPx: targetLodWidth,
			paletteId: currentPaletteId,
			fftSize: fftSize,
		});

		const cacheEntry = tileCache.current.get(cacheId);
		const currentBitmap = cacheEntry?.bitmap;

		newVisibleTiles.push({
			tileId: cacheId,
			left: i * tileDisplayWidthPx,
			width: tileDisplayWidthPx,
			height: dataHeight,
			canvasWidth: currentBitmap?.width || targetLodWidth,
			bitmap: currentBitmap,
		});
	}
	// Scrolling inside the same prefetched tile range only moves the outer
	// container. Keep the list identity so it does not schedule another render.
	setVisibleTiles((previous) =>
		previous.length === newVisibleTiles.length &&
		previous.every((tile, index) => {
			const next = newVisibleTiles[index];
			return (
				tile.tileId === next.tileId &&
				tile.left === next.left &&
				tile.width === next.width &&
				tile.height === next.height &&
				tile.canvasWidth === next.canvasWidth &&
				tile.bitmap === next.bitmap
			);
		})
			? previous
			: newVisibleTiles,
	);
}
