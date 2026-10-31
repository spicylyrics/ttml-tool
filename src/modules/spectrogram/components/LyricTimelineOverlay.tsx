import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { FC, ReactNode } from "react";
import { memo, useContext, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import {
	type ProcessedLyricLine,
	processedLyricLinesAtom,
} from "$/modules/segmentation/utils/segment-processing.ts";
import {
	previewLineAtom,
	type TimelineDragOperation,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import {
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states/index.ts";
import {
	spectrogramHiddenLanesAtom,
	spectrogramLaneLayoutAtom,
} from "$/modules/spectrogram/states/lanes.ts";
import {
	buildLaneBoundaries,
	getLaneBands,
	isTouchingLaneEnd,
	isTouchingLaneStart,
	type SpectrogramLaneKind,
} from "$/modules/spectrogram/utils/lanes.ts";
import { getUpdatedLineForMergedEnd } from "$/modules/spectrogram/utils/line-end-handles.ts";
import {
	commitUpdatedLine,
	getUpdatedLineForDivider,
	getUpdatedLineForLinePan,
	getUpdatedLineForWordPan,
} from "$/modules/spectrogram/utils/timeline-mutations.ts";
import {
	timeShiftPreviewActiveAtom,
	timeShiftPreviewCustomRangeAtom,
	timeShiftPreviewOffsetAtom,
	timeShiftPreviewScopeAtom,
} from "$/states/dialogs.ts";
import { selectedLinesAtom, showUnselectedLinesAtom } from "$/states/main.ts";
import { globalStore } from "$/states/store.ts";
import { type LineEndLabels, LyricLineSegment } from "./LyricLineSegment";
import styles from "./LyricTimelineOverlay.module.css";
import { SpectrogramContext } from "./SpectrogramContext.ts";
import laneStyles from "./SpectrogramLanes.module.css";

interface LyricTimelineOverlayProps {
	clientWidth: number;
	hiddenLineIds?: Set<string> | null;
}

const SNAP_THRESHOLD_PX = 7;

const LyricTimelineOverlayImpl: FC<LyricTimelineOverlayProps> = ({
	clientWidth,
	hiddenLineIds,
}) => {
	const processedLines = useAtomValue(processedLyricLinesAtom);
	const previewLine = useAtomValue(previewLineAtom);
	const { t } = useTranslation();
	const lineEndLabels = useMemo<LineEndLabels>(
		() => ({
			merged: t(
				"spectrogramLineEnds.mergedHandle",
				"Line and last word end. Alt-drag to move only one.",
			),
			word: t("spectrogramLineEnds.wordEndHandle", "Last word end"),
			line: t("spectrogramLineEnds.lineEndHandle", "Line end"),
		}),
		[t],
	);
	const boundaries = useMemo(() => {
		const starts = new Map<number, number>();
		const ends = new Map<number, number>();
		const byId = new Map<string, ProcessedLyricLine>();
		for (const line of processedLines) {
			starts.set(line.startTime, (starts.get(line.startTime) ?? 0) + 1);
			ends.set(line.endTime, (ends.get(line.endTime) ?? 0) + 1);
			byId.set(line.id, line);
		}
		return { starts, ends, byId };
	}, [processedLines]);
	const touchingStart = (line: ProcessedLyricLine, offset = 0) =>
		(boundaries.ends.get(Math.max(0, line.startTime + offset)) ?? 0) >
		Number(
			boundaries.byId.get(line.id)?.endTime ===
				Math.max(0, line.startTime + offset),
		);
	const touchingEnd = (line: ProcessedLyricLine, offset = 0) =>
		(boundaries.starts.get(Math.max(0, line.endTime + offset)) ?? 0) >
		Number(
			boundaries.byId.get(line.id)?.startTime ===
				Math.max(0, line.endTime + offset),
		);
	const [timelineDrag, setTimelineDrag] = useAtom(timelineDragAtom);
	const setPreviewLine = useSetAtom(previewLineAtom);
	useEffect(() => () => setTimelineDrag(null), [setTimelineDrag]);
	const snapTargetsMs = useRef<number[]>([]);
	const { scrollContainerRef, zoom } = useContext(SpectrogramContext);
	const scrollLeft = useAtomValue(spectrogramScrollLeftAtom);

	const showUnselectedLines = useAtomValue(showUnselectedLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const previewActive = useAtomValue(timeShiftPreviewActiveAtom);
	const previewOffset = useAtomValue(timeShiftPreviewOffsetAtom);
	const previewScope = useAtomValue(timeShiftPreviewScopeAtom);
	const previewRange = useAtomValue(timeShiftPreviewCustomRangeAtom);
	const laneLayout = useAtomValue(spectrogramLaneLayoutAtom);
	const hiddenLanes = useAtomValue(spectrogramHiddenLanesAtom);
	const laneBands = useMemo(
		() => (laneLayout ? getLaneBands(laneLayout, hiddenLanes) : null),
		[laneLayout, hiddenLanes],
	);
	const laneBoundaries = useMemo(
		() =>
			laneLayout
				? buildLaneBoundaries(processedLines, laneLayout.laneOf)
				: null,
		[processedLines, laneLayout],
	);

	useEffect(() => {
		if (!timelineDrag) {
			return;
		}

		let lockedGapDirection: "left" | "right" | null = null;

		// Scroll and zoom are read live, not from the render, so wheeling mid-drag
		// keeps the dragged item under the cursor instead of restarting the drag.
		const mouseTimeMs = (
			clientX: number,
			zoom = globalStore.get(spectrogramZoomAtom),
		) => {
			const container = scrollContainerRef.current;
			if (!container) return null;
			const mouseXPx = clientX - container.getBoundingClientRect().left;
			return (
				((globalStore.get(spectrogramScrollLeftAtom) + mouseXPx) / zoom) * 1000
			);
		};

		const dividerStartMouseTimeMs =
			timelineDrag.type === "divider"
				? mouseTimeMs(timelineDrag.startX, timelineDrag.zoom)
				: null;

		let lastPointer: { clientX: number; shiftKey: boolean } | null = null;

		const updatePreview = (clientX: number, shiftKey: boolean) => {
			const zoom = globalStore.get(spectrogramZoomAtom);
			const currentMouseTimeMS = mouseTimeMs(clientX);
			if (currentMouseTimeMS === null) return;

			switch (timelineDrag.type) {
				case "divider": {
					const { lineId, segmentIndex, edge, isGapCreation } = timelineDrag;
					const lineBeingDragged = processedLines.find((l) => l.id === lineId);
					if (!lineBeingDragged || dividerStartMouseTimeMs === null) return;

					const deltaTimeMs = Math.round(
						currentMouseTimeMS - dividerStartMouseTimeMs,
					);
					const deltaX = (deltaTimeMs / 1000) * zoom;
					if (isGapCreation && !lockedGapDirection) {
						if (deltaX > 2) lockedGapDirection = "right";
						else if (deltaX < -2) lockedGapDirection = "left";
					}
					if (isGapCreation && !lockedGapDirection) return;
					const handleTime =
						segmentIndex === -1
							? lineBeingDragged.startTime
							: edge === "start"
								? lineBeingDragged.segments[segmentIndex + 1].startTime
								: lineBeingDragged.segments[segmentIndex].endTime;
					let newTime = handleTime + deltaTimeMs;

					if (!shiftKey) {
						let closestSnapTime: number | null = null;
						let minDistancePx = SNAP_THRESHOLD_PX;
						const newTimePx = (newTime / 1000) * zoom;

						for (const targetTime of snapTargetsMs.current) {
							const targetTimePx = (targetTime / 1000) * zoom;
							const distancePx = Math.abs(newTimePx - targetTimePx);
							if (distancePx < minDistancePx) {
								minDistancePx = distancePx;
								closestSnapTime = targetTime;
							}
						}
						if (closestSnapTime !== null) newTime = closestSnapTime;
					}

					const preview = timelineDrag.mergedLineEnd
						? getUpdatedLineForMergedEnd(
								lineBeingDragged,
								newTime,
								isGapCreation,
							)
						: getUpdatedLineForDivider(
								lineBeingDragged,
								segmentIndex,
								newTime,
								isGapCreation,
								zoom,
								lockedGapDirection,
								edge,
							);
					setPreviewLine(preview);
					break;
				}

				case "word-pan": {
					const { lineId, wordId, initialMouseTimeMS, initialWordStartMS } =
						timelineDrag;
					const processedLine = processedLines.find((l) => l.id === lineId);
					if (!processedLine) return;

					const timeDeltaMS = currentMouseTimeMS - initialMouseTimeMS;
					const desiredNewStartMS = initialWordStartMS + timeDeltaMS;

					const preview = getUpdatedLineForWordPan(
						processedLine,
						wordId,
						desiredNewStartMS,
						zoom,
					);
					setPreviewLine(preview);
					break;
				}
				case "line-pan": {
					const { lineId, initialMouseTimeMS, initialLineStartMS } =
						timelineDrag;
					const processedLine = processedLines.find((l) => l.id === lineId);
					if (!processedLine) return;

					const timeDeltaMS = currentMouseTimeMS - initialMouseTimeMS;
					const desiredNewStartMS = initialLineStartMS + timeDeltaMS;

					const preview = getUpdatedLineForLinePan(
						processedLine,
						desiredNewStartMS,
					);
					setPreviewLine(preview);
					break;
				}
			}
		};

		const handleGlobalMouseMove = (event: MouseEvent) => {
			event.preventDefault();
			lastPointer = { clientX: event.clientX, shiftKey: event.shiftKey };
			updatePreview(event.clientX, event.shiftKey);
		};

		const replayLastPointer = () => {
			if (lastPointer) updatePreview(lastPointer.clientX, lastPointer.shiftKey);
		};
		const unsubscribeScroll = globalStore.sub(
			spectrogramScrollLeftAtom,
			replayLastPointer,
		);
		const unsubscribeZoom = globalStore.sub(
			spectrogramZoomAtom,
			replayLastPointer,
		);

		const handleGlobalMouseUp = (event: MouseEvent) => {
			event.preventDefault();

			const lastSnappedLine = globalStore.get(previewLineAtom);
			if (lastSnappedLine) {
				commitUpdatedLine(lastSnappedLine);
			}

			setTimelineDrag(null);
			setPreviewLine(null);
		};

		let needsBoundarySnapping = false;

		if (timelineDrag.type === "divider") {
			const { segmentIndex } = timelineDrag;
			const lineBeingDragged = processedLines.find(
				(l) => l.id === timelineDrag.lineId,
			);
			if (lineBeingDragged) {
				needsBoundarySnapping =
					segmentIndex === -1 ||
					segmentIndex === lineBeingDragged.segments.length - 1;
			}
		}

		if (needsBoundarySnapping) {
			const lineId = (timelineDrag as TimelineDragOperation).lineId;
			const targets: number[] = [globalStore.get(currentTimeAtom)];
			const otherLineBoundaries = processedLines
				.filter((line) => line.id !== lineId)
				.flatMap((line) => [line.startTime, line.endTime]);
			targets.push(...otherLineBoundaries);
			snapTargetsMs.current = targets.filter(
				(time): time is number => time != null,
			);
		}

		window.addEventListener("mousemove", handleGlobalMouseMove);
		window.addEventListener("mouseup", handleGlobalMouseUp, { once: true });

		return () => {
			window.removeEventListener("mousemove", handleGlobalMouseMove);
			window.removeEventListener("mouseup", handleGlobalMouseUp);
			unsubscribeScroll();
			unsubscribeZoom();
			snapTargetsMs.current = [];
			setPreviewLine(null);
		};
	}, [
		timelineDrag,
		setTimelineDrag,
		setPreviewLine,
		scrollContainerRef,
		processedLines,
	]);

	const bufferPx = 500;
	const viewStartMs = ((scrollLeft - bufferPx) / zoom) * 1000;
	const viewEndMs = ((scrollLeft + clientWidth + bufferPx) / zoom) * 1000;

	const linesToRenderSet = new Set<ProcessedLyricLine>();
	let closestLeft: ProcessedLyricLine | null = null;
	let foundClosestRight = false;

	for (const line of processedLines) {
		if (line.startTime == null || line.endTime == null) continue;

		const inBufferedView =
			line.endTime > viewStartMs && line.startTime < viewEndMs;

		if (inBufferedView) {
			linesToRenderSet.add(line);
			continue;
		}

		if (line.endTime <= viewStartMs) {
			closestLeft = line;
		}

		if (line.startTime >= viewEndMs && !foundClosestRight) {
			linesToRenderSet.add(line);
			foundClosestRight = true;
		}
	}

	if (closestLeft) {
		linesToRenderSet.add(closestLeft);
	}

	const visibleLines = Array.from(linesToRenderSet);

	let linesToRender: ProcessedLyricLine[] = visibleLines;

	if (hiddenLineIds && hiddenLineIds.size > 0) {
		linesToRender = linesToRender.filter((line) => !hiddenLineIds.has(line.id));
	}

	if (!showUnselectedLines) {
		linesToRender = linesToRender.filter((line) => selectedLines.has(line.id));
	}

	const ghostLines: ProcessedLyricLine[] = [];
	if (previewActive && previewOffset !== 0) {
		for (const line of processedLines) {
			if (line.startTime == null || line.endTime == null) continue;

			// Calculate visibility based on SHIFTED position
			const shiftedStartMs = line.startTime + previewOffset;
			const shiftedEndMs = line.endTime + previewOffset;

			const inBufferedView =
				shiftedEndMs > viewStartMs && shiftedStartMs < viewEndMs;

			if (!inBufferedView) continue;

			let shouldShowGhost = false;
			if (previewScope === "all") {
				shouldShowGhost = true;
			} else if (previewScope === "selected") {
				shouldShowGhost = selectedLines.has(line.id);
			} else if (previewScope === "selected-following") {
				let firstSelectedIndex = -1;
				processedLines.forEach((l, index) => {
					if (selectedLines.has(l.id)) {
						if (firstSelectedIndex === -1 || index < firstSelectedIndex) {
							firstSelectedIndex = index;
						}
					}
				});
				const currentLineIndex = processedLines.findIndex(
					(l) => l.id === line.id,
				);
				shouldShowGhost =
					firstSelectedIndex !== -1 && currentLineIndex >= firstSelectedIndex;
			} else if (previewScope === "custom") {
				const currentLineIndex = processedLines.findIndex(
					(l) => l.id === line.id,
				);
				shouldShowGhost =
					currentLineIndex >= previewRange[0] - 1 &&
					currentLineIndex < previewRange[1];
			}

			if (shouldShowGhost) ghostLines.push(line);
		}
	}

	if (laneLayout && laneBands && laneBoundaries) {
		const laneChildren = new Map<SpectrogramLaneKind, ReactNode[]>(
			laneBands.map((band) => [band.kind, []]),
		);
		const laneOfLine = (line: ProcessedLyricLine) =>
			laneLayout.laneOf.get(line.id) ?? "main";
		for (const line of linesToRender) {
			const shown = previewLine?.id === line.id ? previewLine : line;
			const lane = laneBoundaries.get(laneOfLine(line));
			laneChildren
				.get(laneOfLine(line))
				?.push(
					<LyricLineSegment
						key={line.id}
						line={line}
						isTouchingStart={isTouchingLaneStart(lane, shown)}
						isTouchingEnd={isTouchingLaneEnd(lane, shown)}
						lineEndLabels={lineEndLabels}
					/>,
				);
		}
		for (const line of ghostLines) {
			const lane = laneBoundaries.get(laneOfLine(line));
			laneChildren
				.get(laneOfLine(line))
				?.push(
					<LyricLineSegment
						key={`ghost-${line.id}`}
						line={line}
						isTouchingStart={isTouchingLaneStart(lane, line, previewOffset)}
						isTouchingEnd={isTouchingLaneEnd(lane, line, previewOffset)}
						isGhost
						offset={previewOffset}
					/>,
				);
		}

		return (
			<div className={styles.overlay}>
				{laneBands.map((band) => (
					<div
						key={band.kind}
						className={laneStyles.lane}
						data-lane={band.kind}
						style={{ top: `${band.top}%`, height: `${band.height}%` }}
					>
						{laneChildren.get(band.kind)}
					</div>
				))}
			</div>
		);
	}

	return (
		<div className={styles.overlay}>
			{linesToRender.map((line) => (
				<LyricLineSegment
					key={line.id}
					line={line}
					isTouchingStart={touchingStart(
						previewLine?.id === line.id ? previewLine : line,
					)}
					isTouchingEnd={touchingEnd(
						previewLine?.id === line.id ? previewLine : line,
					)}
					lineEndLabels={lineEndLabels}
				/>
			))}
			{ghostLines.map((line) => (
				<LyricLineSegment
					key={`ghost-${line.id}`}
					line={line}
					isTouchingStart={touchingStart(line, previewOffset)}
					isTouchingEnd={touchingEnd(line, previewOffset)}
					isGhost
					offset={previewOffset}
				/>
			))}
		</div>
	);
};

export const LyricTimelineOverlay = memo(LyricTimelineOverlayImpl);
