import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLoadAudio } from "$/hooks/useLoadAudio.ts";
import {
	audioBufferAtom,
	auditionTimeAtom,
} from "$/modules/audio/states/index.ts";
import { useScrubbing } from "$/modules/spectrogram/hooks/useScrubbing.ts";
import { useSpectrogramInteraction } from "$/modules/spectrogram/hooks/useSpectrogramInteraction.ts";
import { useSpectrogramResize } from "$/modules/spectrogram/hooks/useSpectrogramResize.ts";
import { useSpectrogramSelection } from "$/modules/spectrogram/hooks/useSpectrogramSelection.ts";
import { useSpectrogramWorker } from "$/modules/spectrogram/hooks/useSpectrogramWorker.ts";
import { useTimelineEditing } from "$/modules/spectrogram/hooks/useTimelineEditing.ts";
import {
	currentPaletteAtom,
	spectrogramContainerWidthAtom,
	spectrogramFftSizeAtom,
	spectrogramGainAtom,
	spectrogramHeightAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverPyAtom,
	spectrogramIsHoveringAtom,
} from "$/modules/spectrogram/states";
import { isDraggingAtom } from "$/modules/spectrogram/states/dnd.ts";
import { timeShiftPreviewActiveAtom } from "$/states/dialogs.ts";
import { selectedLinesAtom, showUnselectedLinesAtom } from "$/states/main.ts";
import type { ISpectrogramContext } from "../components/SpectrogramContext.ts";
import type { TileComponentProps } from "../components/TileComponent.tsx";
import type { TimelineRulerHandle } from "../components/TimelineRuler.tsx";

import { updateVisibleSpectrogramTiles } from "../utils/visible-tiles";
import { useSpectrogramTransfers } from "./useSpectrogramTransfers";

export function useAudioSpectrogram() {
	const audioBuffer = useAtomValue(audioBufferAtom);
	const auditionTime = useAtomValue(auditionTimeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const store = useStore();

	const [gain, setGain] = useAtom(spectrogramGainAtom);
	const [dataHeight, setDataHeight] = useAtom(spectrogramHeightAtom);
	const [fftSize, setFftSize] = useAtom(spectrogramFftSizeAtom);
	const [showUnselectedLines, setShowUnselectedLines] = useAtom(
		showUnselectedLinesAtom,
	);
	const setPreviewActive = useSetAtom(timeShiftPreviewActiveAtom);

	const { handleDragOver, handleDrop } = useSpectrogramTransfers(store);

	const {
		height: uiHeight,
		maxHeight: dynamicMaxHeight,
		resizeHandleProps,
	} = useSpectrogramResize({
		initialHeight: dataHeight,
		onCommit: setDataHeight,
	});
	const palette = useAtomValue(currentPaletteAtom);
	const [visibleTiles, setVisibleTiles] = useState<TileComponentProps[]>([]);

	const scrollContainerRef = useRef<HTMLDivElement | null>(null);
	const [containerWidth, setContainerWidth] = useAtom(
		spectrogramContainerWidthAtom,
	);

	const { zoom, scrollLeft, isZooming } = useSpectrogramInteraction(
		scrollContainerRef,
		containerWidth,
	);

	const [isHovering, setIsHovering] = useState(false);
	const setSpectrogramIsHovering = useSetAtom(spectrogramIsHoveringAtom);
	// Pointer position is only written here; HoverIndicators read it, so mouse
	// movement does not re-render the whole panel.
	const setHoverPx = useSetAtom(spectrogramHoverPxAtom);
	const setHoverPy = useSetAtom(spectrogramHoverPyAtom);
	const isDragging = useAtomValue(isDraggingAtom);

	const rulerRef = useRef<TimelineRulerHandle>(null);

	const { loadAudio: handleLoadMusic } = useLoadAudio();

	const { t } = useTranslation();

	const { tileCache, requestTileIfNeeded, lastTileTimestamp } =
		useSpectrogramWorker(audioBuffer, palette.data);

	const {
		handleContainerMouseDown: handleTimelineMouseDown,
		isInvalidEndTime,
		pendingCursorPosition,
		showRangePreview,
		previewStyle,
		editingTimeField,
	} = useTimelineEditing(scrollLeft, zoom);

	const { handleSelectionMouseDown, selectionStyle } = useSpectrogramSelection(
		scrollLeft,
		zoom,
	);

	const handleCompositeMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			handleTimelineMouseDown(e);
			handleSelectionMouseDown(e);
		},
		[handleTimelineMouseDown, handleSelectionMouseDown],
	);

	const contextValue = useMemo<ISpectrogramContext>(
		() => ({
			scrollContainerRef,
			zoom,
		}),
		[zoom],
	);

	const updateVisibleTiles = useCallback(() => {
		updateVisibleSpectrogramTiles({
			audioBuffer,
			scrollContainerRef,
			containerWidth,
			gain,
			dataHeight,
			requestTileIfNeeded,
			tileCache,
			palette: { id: palette.id },
			zoom,
			scrollLeft,
			fftSize,
			setVisibleTiles,
		});
	}, [
		audioBuffer,
		containerWidth,
		gain,
		dataHeight,
		requestTileIfNeeded,
		tileCache,
		palette.id,
		zoom,
		scrollLeft,
		fftSize,
	]);

	const { handleScrubStart: handleRulerScrubStart } = useScrubbing(
		scrollContainerRef,
		scrollLeft,
		zoom,
	);

	// One refresh per view/tile change, before paint. Separate effects here used
	// to repeat the same tile preparation and ruler drawing up to three times.
	// biome-ignore lint/correctness/useExhaustiveDependencies: a tile-cache notification must refresh bitmaps even when the viewport is unchanged.
	useLayoutEffect(() => {
		if (!audioBuffer) return;
		rulerRef.current?.draw(scrollLeft);
		updateVisibleTiles();
	}, [scrollLeft, lastTileTimestamp, audioBuffer, updateVisibleTiles]);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!audioBuffer || !container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setContainerWidth(entries[0].contentRect.width);
			}
		});

		observer.observe(container);
		setContainerWidth(container.clientWidth);

		return () => observer.disconnect();
	}, [setContainerWidth, audioBuffer]);

	useEffect(() => {
		return () => {
			setSpectrogramIsHovering(false);
		};
	}, [setSpectrogramIsHovering]);

	const handleMouseEnter = () => {
		setIsHovering(true);
		setSpectrogramIsHovering(true);
	};
	const handleMouseLeave = () => {
		setIsHovering(false);
		setSpectrogramIsHovering(false);
	};
	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		setHoverPx(x);
		setHoverPy(y);
	};

	const totalWidth = audioBuffer ? audioBuffer.duration * zoom : 0;
	const auditionCursorPosition = auditionTime ? auditionTime * zoom : null;

	const transformX = isZooming ? scrollLeft : Math.round(scrollLeft);

	const minGain = 0.5;
	const maxGain = 8;
	const gainPercent = ((gain - minGain) / (maxGain - minGain)) * 100;
	const THUMB_HEIGHT_PX = 13;
	const thumbOffsetPx = (0.5 - gainPercent / 100) * THUMB_HEIGHT_PX;

	return {
		audioBuffer,
		handleLoadMusic,
		t,
		uiHeight,
		resizeHandleProps,
		gain,
		setGain,
		minGain,
		maxGain,
		gainPercent,
		thumbOffsetPx,
		rulerRef,
		zoom,
		containerWidth,
		handleRulerScrubStart,
		isDragging,
		isHovering,
		isInvalidEndTime,
		editingTimeField,
		scrollContainerRef,
		scrollLeft,
		handleMouseEnter,
		handleMouseLeave,
		handleMouseMove,
		handleCompositeMouseDown,
		handleDragOver,
		handleDrop,
		totalWidth,
		transformX,
		visibleTiles,
		pendingCursorPosition,
		auditionCursorPosition,
		showRangePreview,
		previewStyle,
		selectionStyle,
		contextValue,
		selectedLines,
		showUnselectedLines,
		setShowUnselectedLines,
		setPreviewActive,
		fftSize,
		setFftSize,
		dynamicMaxHeight,
		dataHeight,
		setDataHeight,
	};
}
