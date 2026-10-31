import { Delete16Regular } from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	IconButton,
	Popover,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { selectAtom } from "jotai/utils";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import WaveSurfer from "wavesurfer.js";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioBufferAtom, currentDurationAtom } from "$/modules/audio/states";
import { playbackClock } from "$/modules/playback-clock";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import type { Mark } from "$/types/ttml";
import { msToTimestamp } from "$/utils/timestamp";
import { useHoverGuide } from "../hooks";
import { AudioRegion } from "./AudioRegion";
import styles from "./AudioSlider.module.css";
import { HoverGuide } from "./HoverGuide";

const marksAtom = atom((get) => get(lyricLinesAtom).marks);
const selectedTimingsAtom = selectAtom(
	atom((get) => {
		const selected = get(selectedLinesAtom);
		return get(lyricLinesAtom)
			.lyricLines.filter((line) => selected.has(line.id))
			.map(({ id, startTime, endTime }) => ({ id, startTime, endTime }));
	}),
	(value) => value,
	(previous, next) =>
		previous.length === next.length &&
		previous.every(
			(line, index) =>
				line.id === next[index].id &&
				line.startTime === next[index].startTime &&
				line.endTime === next[index].endTime,
		),
);

const WaveformMarkers = memo(
	({
		markers,
		updateMark,
		toggleMark,
	}: {
		markers: (Mark & { left: number; timestamp: string })[];
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		return (
			<>
				{markers.map((marker) => (
					<MarkerItem
						key={marker.timeMs}
						marker={marker}
						updateMark={updateMark}
						toggleMark={toggleMark}
					/>
				))}
			</>
		);
	},
);

const InteractiveHoverOverlay = memo(
	({
		sliderWidthPx,
		isDraggingRef,
	}: {
		sliderWidthPx: number;
		isDraggingRef: React.RefObject<boolean>;
	}) => {
		const { hoverState, handleContainerMouseMove, handleContainerMouseLeave } =
			useHoverGuide(sliderWidthPx, isDraggingRef);

		return (
			<div
				className={styles.interactionOverlay}
				onMouseMove={handleContainerMouseMove}
				onMouseLeave={handleContainerMouseLeave}
			>
				<HoverGuide hoverState={hoverState} />
			</div>
		);
	},
);

const MarkerItem = memo(
	({
		marker,
		updateMark,
		toggleMark,
	}: {
		marker: Mark & { left: number; timestamp: string };
		updateMark: (timeMs: number, data: Partial<Mark>) => void;
		toggleMark: (timeMs: number) => void;
	}) => {
		const { t } = useTranslation();
		const [localLabel, setLocalLabel] = useState(marker.label || "");
		const [localDescription, setLocalDescription] = useState(
			marker.description || "",
		);

		// Sync with external state changes
		useEffect(() => {
			setLocalLabel(marker.label || "");
		}, [marker.label]);

		useEffect(() => {
			setLocalDescription(marker.description || "");
		}, [marker.description]);

		const commitChanges = useCallback(() => {
			if (
				localLabel !== (marker.label || "") ||
				localDescription !== (marker.description || "")
			) {
				updateMark(marker.timeMs, {
					label: localLabel,
					description: localDescription,
				});
			}
		}, [localLabel, localDescription, marker, updateMark]);

		return (
			<Popover.Root onOpenChange={(open) => !open && commitChanges()}>
				<Popover.Trigger>
					<div
						className={styles.markingLine}
						style={{ left: `${marker.left}px` }}
						onContextMenu={(e) => {
							e.preventDefault();
							if (e.shiftKey) toggleMark(marker.timeMs);
						}}
					>
						<div className={styles.markingLineTip}>
							{marker.label ? `${marker.label} ` : ""}
							{marker.timestamp}
						</div>
					</div>
				</Popover.Trigger>
				<Popover.Content
					size="1"
					style={{ width: 240, zIndex: 100 }}
					onOpenAutoFocus={(e) => e.preventDefault()}
				>
					<Flex direction="column" gap="2">
						<Box>
							<Text size="1" weight="bold" color="gray">
								{t("audio.marker", "Marker")} @ {marker.timestamp}
							</Text>
						</Box>
						<TextField.Root
							size="1"
							placeholder={t("audio.markerLabel", "Label (e.g. verse 1 start)")}
							value={localLabel}
							onChange={(e) => setLocalLabel(e.target.value)}
							onBlur={commitChanges}
						/>
						<TextArea
							size="1"
							placeholder={t("audio.markerDescription", "Description…")}
							value={localDescription}
							onChange={(e) => setLocalDescription(e.target.value)}
							onBlur={commitChanges}
							style={{ height: 60 }}
						/>
						<Flex justify="end" gap="2">
							<IconButton
								size="1"
								variant="ghost"
								color="red"
								onClick={() => toggleMark(marker.timeMs)}
								title={t("audio.deleteMarker", "Delete marker")}
							>
								<Delete16Regular />
							</IconButton>
						</Flex>
					</Flex>
				</Popover.Content>
			</Popover.Root>
		);
	},
);

export const AudioSlider = memo(() => {
	const { t } = useTranslation();
	const setCurrentDuration = useSetAtom(currentDurationAtom);

	const currentDuration = useAtomValue(currentDurationAtom);
	const setLyricLines = useSetAtom(lyricLinesAtom);
	const marks = useAtomValue(marksAtom);
	const selectedTimings = useAtomValue(selectedTimingsAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);

	const wsContainerRef = useRef<HTMLDivElement>(null);
	const waveSurferRef = useRef<WaveSurfer | null>(null);

	const [sliderWidthPx, setSliderWidthPx] = useState(0);
	const isDraggingRef = useRef(false);

	const toggleMark = useCallback(
		(timeMs: number) => {
			setLyricLines((prev) => {
				const marks = prev.marks || [];
				const existingIndex = marks.findIndex(
					(m) => Math.abs(m.timeMs - timeMs) < 150,
				);
				if (existingIndex !== -1) {
					return {
						...prev,
						marks: marks.filter((_, i) => i !== existingIndex),
					};
				}
				return {
					...prev,
					marks: [...marks, { timeMs }].sort((a, b) => a.timeMs - b.timeMs),
				};
			});
		},
		[setLyricLines],
	);

	const updateMark = useCallback(
		(timeMs: number, data: Partial<Mark>) => {
			setLyricLines((prev) => {
				const marks = (prev.marks || []).map((m) =>
					m.timeMs === timeMs ? { ...m, ...data } : m,
				);
				return { ...prev, marks };
			});
		},
		[setLyricLines],
	);

	const handleContainerMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.shiftKey) {
				const rect = wsContainerRef.current?.getBoundingClientRect();
				if (!rect || sliderWidthPx <= 0 || currentDuration <= 0) return;
				const x = e.clientX - rect.left;
				const timeMs = (x / sliderWidthPx) * currentDuration;
				toggleMark(timeMs);
				e.preventDefault();
				e.stopPropagation();
			}
		},
		[currentDuration, sliderWidthPx, toggleMark],
	);

	const destroyWaveSurfer = useCallback(() => {
		if (waveSurferRef.current) {
			waveSurferRef.current.destroy();
			waveSurferRef.current = null;
		}
	}, []);

	const createWaveSurfer = useCallback(() => {
		if (!wsContainerRef.current || !audioBuffer) {
			return null;
		}
		const height = wsContainerRef.current.clientHeight;
		const canvasStyles = getComputedStyle(wsContainerRef.current);
		const fontColor =
			canvasStyles.getPropertyValue("--adv-waveform-progress").trim() ||
			canvasStyles.getPropertyValue("--accent-a11").trim();
		const primaryFillColor =
			canvasStyles.getPropertyValue("--adv-waveform-color").trim() ||
			canvasStyles.getPropertyValue("--accent-a4").trim();

		const peaks = [audioBuffer.getChannelData(0)];
		const duration = audioBuffer.duration;

		const ws = WaveSurfer.create({
			container: wsContainerRef.current,
			height,
			hideScrollbar: true,
			waveColor: primaryFillColor,
			progressColor: fontColor,
			cursorColor: fontColor,
			dragToSeek: true,
			cursorWidth: 0,
			barHeight: 0.8,
			peaks: peaks,
			duration: duration,
			interact: true,
		});
		ws.on("interaction", (time) => audioEngine.seekMusic(time));
		waveSurferRef.current = ws;
		ws.setTime(playbackClock.getSnapshot());
		return ws;
	}, [audioBuffer]);

	useEffect(() => {
		const container = wsContainerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			if (entries[0]) {
				setSliderWidthPx(entries[0].contentRect.width);
			}
		});
		observer.observe(container);
		setSliderWidthPx(container.clientWidth);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (audioBuffer) {
			destroyWaveSurfer();
			setCurrentDuration((audioBuffer.duration * 1000) | 0);
			createWaveSurfer();
		}
	}, [audioBuffer, createWaveSurfer, destroyWaveSurfer, setCurrentDuration]);

	useEffect(() => {
		const syncClock = (seconds: number) => {
			waveSurferRef.current?.setTime(seconds);
		};
		const handleMusicUnload = () => {
			destroyWaveSurfer();
			setCurrentDuration(0);
		};
		const unsubscribe = playbackClock.subscribe(syncClock);
		syncClock(playbackClock.getSnapshot());
		audioEngine.addEventListener("music-unload", handleMusicUnload);
		return () => {
			unsubscribe();
			destroyWaveSurfer();
			audioEngine.removeEventListener("music-unload", handleMusicUnload);
		};
	}, [destroyWaveSurfer, setCurrentDuration]);

	const selectedRegions = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0) return [];

		const pixelsPerMs = sliderWidthPx / currentDuration;
		const regions: { id: string; left: number; width: number }[] = [];

		for (const line of selectedTimings) {
			const left = line.startTime * pixelsPerMs;
			const width = (line.endTime - line.startTime) * pixelsPerMs;
			regions.push({ id: line.id, left, width });
		}
		return regions;
	}, [selectedTimings, currentDuration, sliderWidthPx]);

	const markers = useMemo(() => {
		if (currentDuration <= 0 || sliderWidthPx <= 0 || !marks) return [];
		return marks.map((mark) => ({
			...mark,
			left: (mark.timeMs / currentDuration) * sliderWidthPx,
			timestamp: msToTimestamp(mark.timeMs),
		}));
	}, [marks, currentDuration, sliderWidthPx]);

	return (
		<Card
			style={{
				alignSelf: "center",
				width: "100%",
				height: "2.5em",
				padding: "0",
				backgroundColor: "var(--audio-bar-bg, var(--rt-color-panel-solid))",
			}}
		>
			<section
				className={styles.waveformContainer}
				aria-label={t("audio.waveform", "Audio waveform")}
				ref={wsContainerRef}
				style={{ width: "100%", height: "100%", overflow: "hidden" }}
				onMouseDown={handleContainerMouseDown}
			>
				<InteractiveHoverOverlay
					sliderWidthPx={sliderWidthPx}
					isDraggingRef={isDraggingRef}
				/>

				{selectedRegions.map((region) => (
					<div
						key={region.id}
						className={styles.selectedLyricRegion}
						style={{
							left: `${region.left}px`,
							width: `${region.width}px`,
						}}
					/>
				))}

				<WaveformMarkers
					markers={markers}
					updateMark={updateMark}
					toggleMark={toggleMark}
				/>

				<AudioRegion
					sliderWidthPx={sliderWidthPx}
					containerRef={wsContainerRef}
					isDraggingRef={isDraggingRef}
				/>
			</section>
		</Card>
	);
});
