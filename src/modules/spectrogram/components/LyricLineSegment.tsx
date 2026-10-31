import classNames from "classnames";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import React, { type FC, memo, useCallback, useContext } from "react";
import type { ProcessedLyricLine } from "$/modules/segmentation/utils/segment-processing.ts";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import {
	previewLineAtom,
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import {
	getLineEndDividers,
	type LineEndDividerProps,
} from "$/modules/spectrogram/utils/line-end-handles.ts";
import {
	getDividerEdge,
	hasOverlappedStart,
} from "$/modules/spectrogram/utils/timeline-mutations.ts";
import { editingTimeFieldAtom, selectedLinesAtom } from "$/states/main.ts";
import { DividerSegment, type LineEndRole } from "./DividerSegment.tsx";
import { GapSegment } from "./GapSegment.tsx";
import styles from "./LyricLineSegment.module.css";
import { LyricWordSegment } from "./LyricWordSegment.tsx";
import { SpectrogramContext } from "./SpectrogramContext.ts";

/** Accessible names for the line-end handles, translated once by the overlay. */
export type LineEndLabels = Readonly<Record<LineEndRole, string>>;

interface LyricLineSegmentProps {
	line: ProcessedLyricLine;
	isTouchingStart: boolean;
	isTouchingEnd: boolean;
	isGhost?: boolean;
	offset?: number;
	lineEndLabels?: LineEndLabels;
}

const LyricLineSegmentImpl: FC<LyricLineSegmentProps> = ({
	line,
	isTouchingStart,
	isTouchingEnd,
	isGhost = false,
	offset = 0,
	lineEndLabels,
}) => {
	const previewLine = useAtomValue(previewLineAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setSelectedWordId = useSetAtom(selectedWordIdAtom);
	const { scrollContainerRef, zoom } = useContext(SpectrogramContext);
	const store = useStore();
	const editingTimeField = useAtomValue(editingTimeFieldAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);

	let displayLine: ProcessedLyricLine;
	if (!isGhost && previewLine && previewLine.id === line.id) {
		displayLine = previewLine;
	} else {
		displayLine = line;
	}

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (isGhost) return;
			if (e.button !== 0) return;
			if (editingTimeField) return;

			if (!displayLine) return;
			e.stopPropagation();
			// A whole-line drag only moves the segments, so the word still being
			// synced would stay behind. Select the line, but don't drag it.
			if (displayLine.syncInProgress) {
				setSelectedLines(new Set([displayLine.id]));
				setSelectedWordId(null);
				return;
			}

			const { id, startTime } = displayLine;

			const scrollContainer = scrollContainerRef.current;
			if (!scrollContainer) return;

			const rect = scrollContainer.getBoundingClientRect();
			const mouseXPx = e.clientX - rect.left;
			const scrollLeft = store.get(spectrogramScrollLeftAtom);
			const initialMouseTimeMS = ((scrollLeft + mouseXPx) / zoom) * 1000;

			setTimelineDrag({
				type: "line-pan",
				lineId: id,
				initialMouseTimeMS,
				initialLineStartMS: startTime,
			});

			setSelectedLines(new Set([id]));
			setSelectedWordId(null);
		},
		[
			isGhost,
			editingTimeField,
			displayLine,
			setSelectedLines,
			setSelectedWordId,
			scrollContainerRef,
			store,
			zoom,
			setTimelineDrag,
		],
	);

	if (!displayLine) {
		return null;
	}

	const startTime = Math.max(0, (displayLine.startTime ?? 0) + offset);
	const endTime = Math.max(0, (displayLine.endTime ?? 0) + offset);
	const segments = displayLine.segments;
	const segmentsLength = segments.length;

	if (startTime == null || endTime == null || endTime <= startTime) {
		return null;
	}

	const left = (startTime / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;

	if (width < 1) {
		return null;
	}

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
		cursor: isGhost ? "default" : "auto",
	};

	const lineEnd = isGhost
		? null
		: getLineEndDividers(segments, displayLine.endTime, zoom, isTouchingEnd);

	return (
		<div
			className={classNames(
				styles.lineSegment,
				isGhost && styles.ghost,
				isTouchingStart && styles.touchingStart,
				isTouchingEnd && styles.touchingEnd,
			)}
			style={dynamicStyles}
			onMouseDown={handleMouseDown}
			tabIndex={isGhost ? -1 : 0}
			role={isGhost ? "presentation" : "button"}
			aria-label={isGhost ? "Ghost Lyric Line" : "Lyric Line"}
		>
			{!isGhost && (
				<DividerSegment
					key="divider-start"
					lineId={displayLine.id}
					segmentIndex={-1}
					timeMs={startTime}
					lineStartTime={startTime}
					segmentsLength={segmentsLength}
					isTouching={isTouchingStart}
				/>
			)}

			{segments.map((segment, index) => (
				<React.Fragment key={segment.id}>
					{!isGhost && hasOverlappedStart(segments, index) && (
						<DividerSegment
							key={`divider-start-${segment.id}`}
							lineId={displayLine.id}
							segmentIndex={index - 1}
							timeMs={segment.startTime}
							lineStartTime={startTime}
							segmentsLength={segmentsLength}
							isTouching={false}
							edge="start"
						/>
					)}
					{segment.type === "word" ? (
						<LyricWordSegment
							lineId={displayLine.id}
							segment={segment}
							lineStartTime={startTime}
							offset={offset}
							isGhost={isGhost}
						/>
					) : (
						<GapSegment
							segment={segment}
							lineStartTime={startTime}
							offset={offset}
							isGhost={isGhost}
						/>
					)}
					{!isGhost && !lineEnd?.hidden.has(index) && (
						<DividerSegment
							key={`divider-${segment.id}`}
							lineId={displayLine.id}
							segmentIndex={index}
							timeMs={segment.endTime}
							lineStartTime={startTime}
							segmentsLength={segmentsLength}
							isTouching={index === segmentsLength - 1 ? isTouchingEnd : false}
							edge={getDividerEdge(segments, index, displayLine.endTime)}
							{...lineEndProps(lineEnd?.props.get(index), lineEndLabels)}
						/>
					)}
				</React.Fragment>
			))}
		</div>
	);
};

function lineEndProps(
	props: LineEndDividerProps | undefined,
	labels: LineEndLabels | undefined,
) {
	return props && { ...props, ariaLabel: labels?.[props.lineEndRole] };
}

export const LyricLineSegment = memo(LyricLineSegmentImpl);
