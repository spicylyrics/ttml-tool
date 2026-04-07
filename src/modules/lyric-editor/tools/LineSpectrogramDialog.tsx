import { Slider, Button, Dialog, Flex, Text, Box } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioBufferAtom } from "$/modules/audio/states/index.ts";
import { lineSpectrogramDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";

import { audioEngine } from "$/modules/audio/audio-engine.ts";
import { useSpectrogramWorker } from "$/modules/spectrogram/hooks/useSpectrogramWorker.ts";
import { currentPaletteAtom, spectrogramGainAtom } from "$/modules/spectrogram/states/index.ts";
import { TileComponent } from "$/modules/spectrogram/components/TileComponent.tsx";

const TILE_DURATION_S = 5;

export const LineSpectrogramDialog = () => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(lineSpectrogramDialogAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const lineObjs = useAtomValue(lyricLinesAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);
	const containerRef = useRef<HTMLDivElement>(null);
	const palette = useAtomValue(currentPaletteAtom);
	const gain = useAtomValue(spectrogramGainAtom);
	const { tileCache, requestTileIfNeeded, lastTileTimestamp } = useSpectrogramWorker(audioBuffer, palette.data);
	
	const [regionStart, setRegionStart] = useState(0);
	const [regionEnd, setRegionEnd] = useState(0);
	const [viewStart, setViewStart] = useState(0);
	const [viewDuration, setViewDuration] = useState(5);
	const [clientWidth, setClientWidth] = useState(800);
	
	const targetLine = useMemo(() => {
		if (!dialogState.lineId) return null;
		return lineObjs.lyricLines.find((l) => l.id === dialogState.lineId);
	}, [dialogState.lineId, lineObjs]);

	useEffect(() => {
		if (!targetLine) return;
		const s = targetLine.startTime / 1000;
		const e = targetLine.endTime / 1000;
		setRegionStart(s);
		setRegionEnd(e);
		
		const dur = Math.max(0.5, e - s);
		setViewDuration(dur + 4);
		setViewStart(Math.max(0, s - 2));
	}, [targetLine]);

	const isOpen = dialogState.open;
	// biome-ignore lint/correctness/useExhaustiveDependencies: isOpen is used as a trigger to re-measure container width when the dialog opens
	useEffect(() => {
		if (containerRef.current) {
			setClientWidth(containerRef.current.clientWidth || 800);
		}
	}, [isOpen]);

	const zoom = clientWidth / viewDuration;

	const tilesInfo = useMemo(() => {
		if (!audioBuffer || clientWidth === 0 || lastTileTimestamp === -1) return [];
		
		const totalTiles = Math.ceil(audioBuffer.duration / TILE_DURATION_S);
		const viewEnd = viewStart + viewDuration;
		
		const firstVisibleIndex = Math.floor(viewStart / TILE_DURATION_S);
		const lastVisibleIndex = Math.ceil(viewEnd / TILE_DURATION_S);
		
		const visibleTiles = [];
		const currentPaletteId = palette.id;
		
		const tileDisplayWidthPx = TILE_DURATION_S * zoom;
		
		for (let i = Math.max(0, firstVisibleIndex - 1); i <= lastVisibleIndex + 1; i++) {
			if (i >= totalTiles) continue;
			const cacheId = `tile-${i}`;
			
			// We only need ~512-1024 lodge width for the mini dialog
			const targetLodWidth = tileDisplayWidthPx > 512 ? 1024 : 512;
			
			requestTileIfNeeded({
				tileIndex: i,
				startTime: i * TILE_DURATION_S,
				endTime: i * TILE_DURATION_S + TILE_DURATION_S,
				gain,
				height: 260,
				tileWidthPx: targetLodWidth,
				paletteId: currentPaletteId,
			});
			
			const cacheEntry = tileCache.current.get(cacheId);
			visibleTiles.push({
				tileId: cacheId,
				left: (i * TILE_DURATION_S - viewStart) * zoom,
				width: tileDisplayWidthPx,
				height: 260,
				canvasWidth: cacheEntry?.bitmap?.width || targetLodWidth,
				bitmap: cacheEntry?.bitmap,
			});
		}
		
		return visibleTiles;
	}, [audioBuffer, clientWidth, lastTileTimestamp, viewStart, viewDuration, zoom, palette.id, gain, requestTileIfNeeded, tileCache]);

	const handlePlayPause = () => {
		if (audioEngine.musicPlaying) {
			audioEngine.pauseMusic();
		} else if (audioBuffer) {
			audioEngine.auditionRange(regionStart, regionEnd);
		}
	};

	const handleApply = () => {
		if (!targetLine) return;
		
		editLyricLines((state) => {
			const line = state.lyricLines.find((l) => l.id === targetLine.id);
			if (!line) return;

			line.startTime = Math.round(regionStart * 1000);
			line.endTime = Math.round(regionEnd * 1000);

			let totalChars = 0;
			for (const word of line.words) {
				totalChars += word.word.length;
			}
			
			if (totalChars > 0) {
				const durationMs = line.endTime - line.startTime;
				let currentWordTime = line.startTime;
				
				for (const word of line.words) {
					const wordDuration = Math.round((word.word.length / totalChars) * durationMs);
					word.startTime = currentWordTime;
					word.endTime = currentWordTime + wordDuration;
					currentWordTime += wordDuration;
					
					// If there is ruby, adjust ruby too just in case
					if (word.ruby && word.ruby.length > 0) {
						let totalRubyChars = 0;
						for (const ruby of word.ruby) totalRubyChars += ruby.word.length;
						let currentRubyTime = word.startTime;
						for (const ruby of word.ruby) {
							const rubyDur = totalRubyChars > 0 ? Math.round((ruby.word.length / totalRubyChars) * wordDuration) : 0;
							ruby.startTime = currentRubyTime;
							ruby.endTime = currentRubyTime + rubyDur;
							currentRubyTime += rubyDur;
						}
					}
				}
				
				// Fix any rounding error on the last word
				if (line.words.length > 0) {
					const lastWord = line.words[line.words.length - 1];
					lastWord.endTime = line.endTime;
					if (lastWord.ruby && lastWord.ruby.length > 0) {
						lastWord.ruby[lastWord.ruby.length - 1].endTime = line.endTime;
					}
				}
			}
		});

		setDialogState({ open: false });
	};

	const handleClose = () => {
		setDialogState({ open: false });
	};

	return (
		<Dialog.Root open={dialogState.open} onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}>
			<Dialog.Content maxWidth="900px" style={{ zIndex: 10000 }}>
				<Dialog.Title>{t("lyricEditor.lineSpectrogram.title", "Line Spectrogram Alignment")}</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{t("lyricEditor.lineSpectrogram.desc", "Adjust the start and end points of this line using the spectrogram. The line duration will be split proportionally into its words based on character count.")}
				</Dialog.Description>
				
				{targetLine && (
					<Box mb="4" p="3" style={{ background: "var(--gray-3)", borderRadius: "var(--radius-3)" }}>
						<Text weight="bold" size="4">
							{targetLine.words.map(w => w.word).join("")}
						</Text>
					</Box>
				)}

				{!audioBuffer && (
					<Box mb="4" p="3" style={{ background: "var(--red-3)", color: "var(--red-11)", borderRadius: "var(--radius-3)" }}>
						<Text size="3">{t("error.audioNotLoaded", "Audio not loaded. Please ensure an audio file is playing.")}</Text>
					</Box>
				)}

				<Box ref={containerRef} style={{ position: "relative", width: "100%", height: "260px", marginBottom: "32px", background: "var(--gray-2)", borderRadius: "var(--radius-2)", overflow: "hidden" }}>
					{tilesInfo.map(tile => (
						<div key={tile.tileId} style={{ position: "absolute", top: 0, left: tile.left, width: tile.width, height: tile.height }}>
							<TileComponent {...tile} />
						</div>
					))}
					
					{audioBuffer && (
						<Box style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}>
							<Box style={{
								position: "absolute", 
								top: 0, 
								bottom: 0, 
								left: Math.max(0, (regionStart - viewStart) * zoom), 
								width: Math.max(0, (regionEnd - regionStart) * zoom), 
								background: "rgba(0, 160, 255, 0.4)",
								borderLeft: "2px solid rgba(0, 200, 255, 0.9)",
								borderRight: "2px solid rgba(0, 200, 255, 0.9)",
								pointerEvents: "none"
							}} />
							
							<Flex align="center" style={{ position: "absolute", bottom: -20, left: 0, right: 0 }}>
								<Slider 
									min={viewStart} 
									max={viewStart + viewDuration} 
									step={0.001}
									value={[regionStart, regionEnd]} 
									onValueChange={([s, e]) => {
										setRegionStart(Math.min(s, e - 0.05));
										setRegionEnd(Math.max(e, s + 0.05));
									}}
								/>
							</Flex>
						</Box>
					)}
				</Box>

				<Flex gap="3" align="center" justify="between" mb="4">
					<Flex gap="4">
						<Text size="2">
							<Text weight="bold">{t("lyricEditor.lineSpectrogram.startTime", "Start:")} </Text>
							{regionStart.toFixed(3)}s
						</Text>
						<Text size="2">
							<Text weight="bold">{t("lyricEditor.lineSpectrogram.endTime", "End:")} </Text>
							{regionEnd.toFixed(3)}s
						</Text>
						<Text size="2">
							<Text weight="bold">{t("lyricEditor.lineSpectrogram.duration", "Duration:")} </Text>
							{(regionEnd - regionStart).toFixed(3)}s
						</Text>
					</Flex>
					<Flex gap="2">
						<Button variant="surface" onClick={handlePlayPause}>
							{t("lyricEditor.lineSpectrogram.playPause", "Play/Pause")}
						</Button>
					</Flex>
				</Flex>

				<Flex gap="3" justify="end">
					<Button variant="soft" color="gray" onClick={handleClose}>
						{t("common.cancel", "Cancel")}
					</Button>
					<Button onClick={handleApply}>
						{t("common.apply", "Apply")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
