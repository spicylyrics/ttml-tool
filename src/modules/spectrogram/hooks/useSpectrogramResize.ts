import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpectrogramResizeProps {
	initialHeight: number;
	minHeight?: number;
	maxHeight?: number;
	onCommit: (newHeight: number) => void;
}

export const getAvailableSpectrogramMaxHeight = (
	fallbackMax = 800,
	minHeight = 100,
): number => {
	if (typeof window === "undefined") return fallbackMax;

	// 1. Determine top boundary (bottom edge of the top RibbonBar or TitleBar)
	let topBoundary = 0;
	const ribbonEl = document.querySelector('[data-guide-target="ribbon"]');
	if (ribbonEl) {
		const rect = ribbonEl.getBoundingClientRect();
		// If horizontal ribbon bar is positioned at the top of the window
		if (
			rect.width > window.innerWidth * 0.4 &&
			rect.top < window.innerHeight * 0.4
		) {
			topBoundary = rect.bottom;
		}
	}

	if (topBoundary === 0) {
		const titlebarEl =
			document.querySelector('[data-guide-target="titlebar"]') ||
			document.querySelector("header");
		if (titlebarEl) {
			topBoundary = titlebarEl.getBoundingClientRect().bottom;
		}
	}

	// Safety fallback: if titlebar was not detected, reserve minimum standard top bar height (38px)
	if (topBoundary === 0) {
		topBoundary = 38;
	}

	// 2. Determine bottom reservation (bottom playback bar and any lower panel)
	const playbackBarEl = document.querySelector(
		'[data-guide-target="audio-playback-bar"]',
	);
	const playbackBarHeight = playbackBarEl
		? playbackBarEl.getBoundingClientRect().height
		: 48;

	const touchSyncEl = document.querySelector(
		'[data-guide-target="touch-sync"]',
	);
	const touchSyncHeight =
		touchSyncEl && touchSyncEl.getBoundingClientRect().height > 0
			? touchSyncEl.getBoundingClientRect().height
			: 0;

	// If RibbonBar is docked at the bottom of the window, reserve its height
	let bottomRibbonHeight = 0;
	if (ribbonEl) {
		const rect = ribbonEl.getBoundingClientRect();
		if (rect.top > window.innerHeight * 0.5) {
			bottomRibbonHeight = rect.height;
		}
	}

	// Card border and safety margin
	const safetyMargin = 4;
	const bottomReserve =
		playbackBarHeight + touchSyncHeight + bottomRibbonHeight + safetyMargin;

	// Available height for the spectrogram before it touches the RibbonBar and pushes the playback bar
	const maxAllowed = Math.floor(
		window.innerHeight - topBoundary - bottomReserve,
	);

	return Math.max(minHeight, maxAllowed);
};

export const useSpectrogramResize = ({
	initialHeight,
	minHeight = 100,
	maxHeight = 800,
	onCommit,
}: UseSpectrogramResizeProps) => {
	const [dynamicMaxHeight, setDynamicMaxHeight] = useState(() =>
		getAvailableSpectrogramMaxHeight(maxHeight, minHeight),
	);
	const [height, setHeight] = useState(() =>
		Math.max(
			minHeight,
			Math.min(
				getAvailableSpectrogramMaxHeight(maxHeight, minHeight),
				initialHeight,
			),
		),
	);
	const [isResizing, setIsResizing] = useState(false);
	const heightRef = useRef(height);
	const dragCleanupRef = useRef<(() => void) | null>(null);

	const updateMaxHeight = useCallback(() => {
		const newMax = getAvailableSpectrogramMaxHeight(maxHeight, minHeight);
		setDynamicMaxHeight(newMax);
		return newMax;
	}, [maxHeight, minHeight]);

	useEffect(() => {
		const handleWindowResize = () => {
			const newMax = updateMaxHeight();
			setHeight((prev) => {
				if (prev > newMax) {
					onCommit(newMax);
					return newMax;
				}
				return prev;
			});
		};

		window.addEventListener("resize", handleWindowResize);
		return () => window.removeEventListener("resize", handleWindowResize);
	}, [updateMaxHeight, onCommit]);

	useEffect(() => {
		if (!isResizing) {
			const currentMax = updateMaxHeight();
			const clamped = Math.max(minHeight, Math.min(currentMax, initialHeight));
			setHeight(clamped);
			if (initialHeight > currentMax) {
				onCommit(clamped);
			}
		}
	}, [initialHeight, isResizing, minHeight, updateMaxHeight, onCommit]);

	useEffect(() => {
		heightRef.current = height;
	}, [height]);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			dragCleanupRef.current?.();

			setIsResizing(true);
			const startY = e.clientY;
			const startHeight = heightRef.current;
			const currentMax = updateMaxHeight();

			document.body.style.cursor = "ns-resize";
			document.body.style.userSelect = "none";

			const handleMouseMove = (ev: MouseEvent) => {
				const deltaY = startY - ev.clientY;
				const newHeight = Math.max(
					minHeight,
					Math.min(currentMax, startHeight + deltaY),
				);
				setHeight(newHeight);
			};

			const handleMouseUp = () => {
				setIsResizing(false);
				dragCleanupRef.current?.();
			};

			dragCleanupRef.current = () => {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";

				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
				dragCleanupRef.current = null;
				onCommit(heightRef.current);
			};

			window.addEventListener("mousemove", handleMouseMove);
			window.addEventListener("mouseup", handleMouseUp);
		},
		[minHeight, updateMaxHeight, onCommit],
	);

	useEffect(() => {
		return () => {
			dragCleanupRef.current?.();
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
	}, []);

	return {
		height,
		maxHeight: dynamicMaxHeight,
		isResizing,
		resizeHandleProps: {
			onMouseDown: handleMouseDown,
		},
	};
};
