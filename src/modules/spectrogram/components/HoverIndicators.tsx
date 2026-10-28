import { type ExtractAtomValue, useAtomValue } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { editingTimeFieldAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import {
	spectrogramHoverFrequencyAtom,
	spectrogramHoverPxAtom,
	spectrogramHoverTimeMsAtom,
	spectrogramScrollLeftAtom,
} from "../states";
import { getNoteFromFreq } from "../utils/frequency-note";
import styles from "./AudioSpectrogram.module.css";
import { RULER_HEIGHT } from "./TimelineRuler.tsx";

// Only these small components subscribe to the pointer position, so moving the
// mouse over the spectrogram does not re-render the whole panel.

type EditingTimeField = ExtractAtomValue<typeof editingTimeFieldAtom>;

interface HoverIndicatorProps {
	isHovering: boolean;
	isInvalidEndTime: boolean;
	editingTimeField: EditingTimeField;
}

export const HoverTimeTooltip = memo(
	({ isHovering, isInvalidEndTime, editingTimeField }: HoverIndicatorProps) => {
		const { t } = useTranslation();
		const hoverPx = useAtomValue(spectrogramHoverPxAtom);
		const hoverTimeMs = useAtomValue(spectrogramHoverTimeMsAtom);
		const hoverFrequency = useAtomValue(spectrogramHoverFrequencyAtom);

		let label = msToTimestamp(hoverTimeMs);
		if (hoverFrequency > 0) {
			const freqFormatted =
				hoverFrequency >= 1000
					? `${(hoverFrequency / 1000).toFixed(2)} kHz`
					: `${Math.round(hoverFrequency)} Hz`;
			const noteFormatted = getNoteFromFreq(hoverFrequency);
			label = `${label} (${freqFormatted}${noteFormatted ? ` / ${noteFormatted}` : ""})`;
		}
		let backgroundColor: string | undefined;
		if (isInvalidEndTime) {
			label = t("spectrogram.invalidEndTime", "不能选择此结束时间");
			backgroundColor = "var(--red-9)";
		} else if (editingTimeField && !editingTimeField.isWord) {
			const fieldName =
				editingTimeField.field === "startTime"
					? t("ribbonBar.editMode.startTime", "起始时间")
					: t("ribbonBar.editMode.endTime", "结束时间");
			label = `${t("common.clickToSet", "Click to set")}${fieldName}: ${label}`;
			backgroundColor = "var(--accent-9)";
		}
		const opacity = isHovering ? 1 : 0;

		return (
			<>
				<div
					className={styles.hoverTimeTooltip}
					style={{ left: `${hoverPx}px`, opacity, backgroundColor }}
				>
					{label}
				</div>
				<div
					className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeLeft}`}
					style={{
						width: `${hoverPx}px`,
						height: `${RULER_HEIGHT}px`,
						opacity,
					}}
				/>
				<div
					className={`${styles.rulerHoverFade} ${styles.rulerHoverFadeRight}`}
					style={{ left: `${hoverPx}px`, height: `${RULER_HEIGHT}px`, opacity }}
				/>
			</>
		);
	},
);

export const HoverCursor = memo(
	({
		isHovering,
		isInvalidEndTime,
	}: Pick<HoverIndicatorProps, "isHovering" | "isInvalidEndTime">) => {
		const hoverPx = useAtomValue(spectrogramHoverPxAtom);
		const scrollLeft = useAtomValue(spectrogramScrollLeftAtom);
		return (
			<div
				className={styles.hoverCursorContainer}
				style={{
					left: `${scrollLeft + hoverPx}px`,
					opacity: isHovering ? 1 : 0,
				}}
			>
				<div
					className={styles.hoverCursorLine}
					style={{
						backgroundColor: isInvalidEndTime ? "var(--red-9)" : undefined,
					}}
				/>
			</div>
		);
	},
);
