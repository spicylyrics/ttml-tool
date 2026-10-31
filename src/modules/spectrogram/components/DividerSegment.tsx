import classNames from "classnames";
import { useSetAtom, useStore } from "jotai";
import { type FC, memo, useCallback, useContext } from "react";
import { processedLyricLinesAtom } from "$/modules/segmentation/utils/segment-processing.ts";
import { timelineDragAtom } from "$/modules/spectrogram/states/dnd";
import { getUpdatedLineForMergedEnd } from "$/modules/spectrogram/utils/line-end-handles";
import {
	commitUpdatedLine,
	type DividerEdge,
	getUpdatedLineForDivider,
} from "$/modules/spectrogram/utils/timeline-mutations";
import styles from "./DividerSegment.module.css";
import { SpectrogramContext } from "./SpectrogramContext";

interface DividerSegmentProps {
	lineId: string;
	segmentIndex: number;
	timeMs: number;
	lineStartTime: number;
	segmentsLength: number;
	isTouching: boolean;
	edge?: DividerEdge;
	virtual?: boolean;
	/** Line-end handle kind while the line-end handles flag is on. */
	lineEndRole?: LineEndRole;
	/** Hit zone override, relative to `timeMs` in px. The 2px bar stays where it was. */
	hitOffsetPx?: number;
	hitWidthPx?: number;
	ariaLabel?: string;
}

export type LineEndRole = "merged" | "word" | "line";

const lineEndRoleClass: Record<LineEndRole, string | undefined> = {
	merged: styles.mergedEnd,
	word: styles.wordEnd,
	line: styles.lineEnd,
};

const DIVIDER_WIDTH_PX = 15;
const HALF_DIVIDER_WIDTH_PX = DIVIDER_WIDTH_PX / 2;
const NUDGE_MS = 10;
const SHIFT_NUDGE_MS = 50;

const DividerSegmentImpl: FC<DividerSegmentProps> = ({
	lineId,
	segmentIndex,
	timeMs,
	lineStartTime,
	segmentsLength,
	isTouching,
	edge = "shared",
	virtual = false,
	lineEndRole,
	hitOffsetPx,
	hitWidthPx,
	ariaLabel,
}) => {
	const mergedLineEnd = lineEndRole === "merged";
	const setTimelineDrag = useSetAtom(timelineDragAtom);
	const store = useStore();
	const { zoom } = useContext(SpectrogramContext);

	const startDrag = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0) return;
			e.preventDefault();
			e.stopPropagation();
			// preventDefault blocks mouse focus, which the arrow-key nudge needs.
			e.currentTarget.focus({ preventScroll: true });
			setTimelineDrag({
				type: "divider",
				lineId: lineId,
				segmentIndex: segmentIndex,
				edge,
				zoom: zoom,
				startX: e.clientX,
				isGapCreation: edge === "shared" && e.altKey,
				virtual: virtual,
				mergedLineEnd,
			});
		},
		[lineId, segmentIndex, edge, setTimelineDrag, zoom, virtual, mergedLineEnd],
	);

	// The timeline blocks mouse focus elsewhere, so drop it on any outside click
	// to give plain arrows back to audio seeking.
	const releaseFocusOnOutsideClick = useCallback(
		(event: React.FocusEvent<HTMLDivElement>) => {
			const divider = event.currentTarget;
			const onPointerDown = (pointerEvent: PointerEvent) => {
				if (!divider.contains(pointerEvent.target as Node)) divider.blur();
			};
			document.addEventListener("pointerdown", onPointerDown, true);
			divider.addEventListener(
				"blur",
				() => document.removeEventListener("pointerdown", onPointerDown, true),
				{ once: true },
			);
		},
		[],
	);

	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (event.key === "Escape") {
				event.currentTarget.blur();
				return;
			}
			if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			const lineBeingDragged = store
				.get(processedLyricLinesAtom)
				.find((l) => l.id === lineId);
			if (!lineBeingDragged) {
				return;
			}

			const nudgeAmount = event.shiftKey ? SHIFT_NUDGE_MS : NUDGE_MS;
			const newTime =
				event.key === "ArrowRight"
					? timeMs + nudgeAmount
					: timeMs - nudgeAmount;

			const updatedLine = mergedLineEnd
				? getUpdatedLineForMergedEnd(lineBeingDragged, newTime)
				: getUpdatedLineForDivider(
						lineBeingDragged,
						segmentIndex,
						newTime,
						false,
						zoom,
						null,
						edge,
					);

			commitUpdatedLine(updatedLine);
		},
		[lineId, store, segmentIndex, timeMs, zoom, edge, mergedLineEnd],
	);

	if (timeMs == null || timeMs < 0 || lineStartTime == null) return null;

	const timePx = ((timeMs - lineStartTime) / 1000) * zoom;
	const isLineStartHandle = segmentIndex === -1;
	const isLineEndHandle =
		edge === "shared" && segmentIndex === segmentsLength - 1;

	const handleWidthPx = DIVIDER_WIDTH_PX;
	let handleOffsetPx: number;

	if (isLineStartHandle && isTouching) {
		handleOffsetPx = 0;
	} else if (isLineEndHandle && isTouching) {
		handleOffsetPx = -DIVIDER_WIDTH_PX;
	} else {
		handleOffsetPx = -HALF_DIVIDER_WIDTH_PX;
	}

	let left = timePx + handleOffsetPx;
	let width = handleWidthPx;
	let barStyle: React.CSSProperties | undefined;

	if (hitOffsetPx !== undefined && hitWidthPx !== undefined) {
		// Widen the grab area only; keep the bar where the classic handle draws it.
		const barShiftPx =
			handleOffsetPx + handleWidthPx / 2 - (hitOffsetPx + hitWidthPx / 2);
		left = timePx + hitOffsetPx;
		width = hitWidthPx;
		barStyle = { transform: `translateX(${barShiftPx}px)` };
	}

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
	};

	return (
		<div
			className={classNames(
				styles.divider,
				isTouching && styles.touching,
				lineEndRole && lineEndRoleClass[lineEndRole],
			)}
			aria-label={ariaLabel}
			style={dynamicStyles}
			onMouseDown={startDrag}
			onContextMenu={(e) => e.preventDefault()}
			role="separator"
			tabIndex={0}
			aria-orientation="vertical"
			aria-valuenow={timeMs}
			onKeyDown={handleKeyDown}
			onFocus={releaseFocusOnOutsideClick}
		>
			<div className={styles.dividerLine} style={barStyle} />
		</div>
	);
};

export const DividerSegment = memo(DividerSegmentImpl);
