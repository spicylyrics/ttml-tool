import classNames from "classnames";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import React, { type FC, memo, useCallback, useContext } from "react";
import { useTranslation } from "react-i18next";
import type { ProcessedLyricLine } from "$/modules/segmentation/utils/segment-processing.ts";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import {
	previewLineAtom,
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import { spectrogramLineEndHandlesAtom } from "$/modules/spectrogram/states/line-end-handles.ts";
import { getLineEndDividers } from "$/modules/spectrogram/utils/line-end-handles.ts";
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

interface LyricLineSegmentProps {
	line: ProcessedLyricLine;
	isTouchingStart: boolean;
	isTouchingEnd: boolean;
	isGhost?: boolean;
	offset?: number;
}

const LyricLineSegmentImpl: FC<LyricLineSegmentProps> = ({
	line,
	isTouchingStart,
	isTouchingEnd,
	isGhost = false,
	offset = 0,
}) => {
	const previewLine = useAtomValue(previewLineAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setSelectedWordId = useSetAtom(selectedWordIdAtom);
	const { scrollContainerRef, zoom } = useContext(SpectrogramContext);
	const store = useStore();
	const editingTimeField = useAtomValue(editingTimeFieldAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);
	const lineEndHandlesEnabled = useAtomValue(spectrogramLineEndHandlesAtom);
	const { t } = useTranslation();

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

	const lineEndDividers =
		lineEndHandlesEnabled && !isGhost
			? getLineEndDividers(segments, displayLine.endTime, zoom, isTouchingEnd)
			: null;
	const lineEndLabel = (role: LineEndRole) =>
		role === "merged"
			? t(
					"spectrogramLineEnds.mergedHandle",
					"Line and last word end. Alt-drag to move only one.",
				)
			: role === "word"
				? t("spectrogramLineEnds.wordEndHandle", "Last word end")
				: t("spectrogramLineEnds.lineEndHandle", "Line end");
	const lineEnd = lineEndDividers && {
		hidden: lineEndDividers.hidden,
		props: new Map(
			[...lineEndDividers.props].map(([index, props]) => [
				index,
				{ ...props, ariaLabel: lineEndLabel(props.lineEndRole) },
			]),
		),
	};

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
							{...lineEnd?.props.get(index)}
						/>
					)}
				</React.Fragment>
			))}
		</div>
	);
};

export const LyricLineSegment = memo(LyricLineSegmentImpl);
