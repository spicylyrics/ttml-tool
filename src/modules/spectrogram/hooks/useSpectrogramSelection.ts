import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { spectrogramSelectionAtom, spectrogramHoverTimeMsAtom } from "../states";
import { editingTimeFieldAtom } from "$/states/main.ts";

export function useSpectrogramSelection(scrollLeft: number, zoom: number) {
	const [selection, setSelection] = useAtom(spectrogramSelectionAtom);
	const hoverTimeMs = useAtomValue(spectrogramHoverTimeMsAtom);
	const editingTimeField = useAtomValue(editingTimeFieldAtom);

	const [isSelecting, setIsSelecting] = useState(false);
	const [selectionStartMs, setSelectionStartMs] = useState<number | null>(null);

	const handleSelectionMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		// Only allow Shift+Drag to select, or just drag if not editing anything?
		// Wait, normal drag without Shift might just scrub or do nothing... let's say normal drag creates a selection when editingTimeField is NOT active
		if (editingTimeField) return;

		// Prevent scrubbing from interfering? The user can just drag.
		setIsSelecting(true);
		
		const rect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const clickX = scrollLeft + x;
		const timeMs = (clickX / zoom) * 1000;
		setSelectionStartMs(timeMs);
		setSelection(null); // Clear previous selection
	}, [editingTimeField, scrollLeft, zoom, setSelection]);

	useEffect(() => {
		const handleMouseUp = () => {
			if (isSelecting && selectionStartMs !== null) {
				setIsSelecting(false);
				const endMs = hoverTimeMs;
				if (Math.abs(endMs - selectionStartMs) > 10) { // minimum width
					setSelection({
						start: Math.min(selectionStartMs, endMs),
						end: Math.max(selectionStartMs, endMs)
					});
				} else {
					setSelection(null); // Clear if just clicked
				}
				setSelectionStartMs(null);
			}
		};

		window.addEventListener("mouseup", handleMouseUp);
		return () => window.removeEventListener("mouseup", handleMouseUp);
	}, [isSelecting, selectionStartMs, hoverTimeMs, setSelection]);

	// Render preview during selection drag, or render the completed selection
	let selectionStyle: React.CSSProperties | undefined;

	if (isSelecting && selectionStartMs !== null) {
		const startPx = (Math.min(selectionStartMs, hoverTimeMs) / 1000) * zoom;
		const endPx = (Math.max(selectionStartMs, hoverTimeMs) / 1000) * zoom;
		const width = endPx - startPx;

		selectionStyle = {
			left: `${startPx}px`,
			width: `${width}px`,
			backgroundColor: 'rgba(50, 150, 255, 0.3)',
			position: 'absolute',
			top: 0,
			height: '100%',
			pointerEvents: 'none'
		};
	} else if (selection) {
		const startPx = (selection.start / 1000) * zoom;
		const endPx = (selection.end / 1000) * zoom;
		const width = endPx - startPx;

		selectionStyle = {
			left: `${startPx}px`,
			width: `${width}px`,
			backgroundColor: 'rgba(50, 150, 255, 0.4)',
			position: 'absolute',
			top: 0,
			height: '100%',
			pointerEvents: 'none'
		};
	}

	return { handleSelectionMouseDown, selectionStyle };
}
