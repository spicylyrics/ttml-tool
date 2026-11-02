import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type FC,
	type KeyboardEvent,
	type MouseEvent,
	memo,
	useContext,
} from "react";
import { audioEngine } from "$/modules/audio/audio-engine.ts";
import type { WordSegment } from "$/modules/segmentation/utils/segment-processing.ts";
import { displayRomanizationInSyncAtom } from "$/modules/settings/states/index.ts";
import { spectrogramScrollLeftAtom } from "$/modules/spectrogram/states";
import {
	selectedWordIdAtom,
	timelineDragAtom,
} from "$/modules/spectrogram/states/dnd.ts";
import { editingTimeFieldAtom } from "$/states/main.ts";
import styles from "./LyricWordSegment.module.css";
import { SpectrogramContext } from "./SpectrogramContext.ts";

interface LyricWordSegmentProps {
	lineId: string;
	segment: WordSegment;
	lineStartTime: number;
	isGhost?: boolean;
	offset?: number;
}

const LyricWordSegmentImpl: FC<LyricWordSegmentProps> = ({
	lineId,
	segment,
	lineStartTime,
	isGhost = false,
	offset = 0,
}) => {
	const [selectedWordId, setSelectedWordId] = useAtom(selectedWordIdAtom);
	const setTimelineDrag = useSetAtom(timelineDragAtom);
	const { zoom, scrollContainerRef } = useContext(SpectrogramContext);
	const store = useStore();
	const showPerWordRomanization = useAtomValue(displayRomanizationInSyncAtom);
	const editingTimeField = useAtomValue(editingTimeFieldAtom);

	const { startTime, endTime, word, romanWord } = segment;

	if (startTime == null || endTime == null || endTime <= startTime) {
		return null;
	}

	const left =
		((startTime + (isGhost ? offset : 0) - lineStartTime) / 1000) * zoom;
	const width = ((endTime - startTime) / 1000) * zoom;

	const isSelected = !isGhost && selectedWordId === segment.id;

	const handleClick = (e: MouseEvent<HTMLDivElement>) => {
		if (isGhost) return;
		if (editingTimeField) return;
		e.stopPropagation();
		setSelectedWordId(segment.id);
	};

	const handleAudition = (e: MouseEvent<HTMLDivElement>) => {
		if (isGhost) return;
		if (editingTimeField) return;
		e.preventDefault();
		e.stopPropagation();
		setSelectedWordId(segment.id);
		if (startTime != null && endTime != null) {
			audioEngine.auditionRange(startTime / 1000, endTime / 1000);
		}
	};

	const handlePanStart = (e: MouseEvent<HTMLDivElement>) => {
		if (isGhost) return;
		if (editingTimeField) return;
		if (e.button !== 0) return;

		e.preventDefault();
		e.stopPropagation();

		const scrollContainer = scrollContainerRef.current;
		if (!scrollContainer) return;
		const rect = scrollContainer.getBoundingClientRect();

		const mouseXPx = e.clientX - rect.left;
		const scrollLeft = store.get(spectrogramScrollLeftAtom);
		const initialMouseTimeMS = ((scrollLeft + mouseXPx) / zoom) * 1000;

		setTimelineDrag({
			type: "word-pan",
			lineId: lineId,
			wordId: segment.id,
			initialMouseTimeMS,
			initialWordStartMS: segment.startTime,
		});

		setSelectedWordId(segment.id);
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
		if (isGhost) return;
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			setSelectedWordId(segment.id);
			if (startTime != null && endTime != null) {
				audioEngine.auditionRange(startTime / 1000, endTime / 1000);
			}
		}
	};

	const dynamicStyles = {
		left: `${left}px`,
		width: `${width}px`,
		backgroundColor: isSelected ? "var(--accent-a6)" : "transparent",
	};

	const hasRoman =
		showPerWordRomanization && romanWord && romanWord.trim() !== "";

	return (
		<div
			className={styles.wordSegment}
			style={dynamicStyles}
			onClick={handleClick}
			onMouseDown={handlePanStart}
			onContextMenu={handleAudition}
			role={isGhost ? "presentation" : "button"}
			tabIndex={isGhost ? -1 : 0}
			onKeyDown={handleKeyDown}
		>
			{hasRoman ? (
				<>
					<span className={styles.romanText}>{romanWord}</span>
					<span className={styles.originText}>{word}</span>
				</>
			) : (
				word
			)}
		</div>
	);
};

export const LyricWordSegment = memo(LyricWordSegmentImpl);
