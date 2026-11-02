import { MusicNote2Filled } from "@fluentui/react-icons";
import { Button, Flex, Text, Theme } from "@radix-ui/themes";
import type { useAudioSpectrogram } from "../hooks/useAudioSpectrogram";
import styles from "./AudioSpectrogram.module.css";
import { HoverCursor, HoverTimeTooltip } from "./HoverIndicators.tsx";
import { LyricTimelineOverlay } from "./LyricTimelineOverlay.tsx";
import { PlayheadCursor, ScrubHandle } from "./Playhead";
import { SpectrogramContext } from "./SpectrogramContext.ts";
import { SpectrogramLaneLabels } from "./SpectrogramLaneLabels.tsx";
import {
	SpectrogramGainSidebar,
	SpectrogramSettingsSidebar,
} from "./SpectrogramSidebars";
import { TileComponent } from "./TileComponent.tsx";
import { TimelineRuler } from "./TimelineRuler.tsx";
import { TimeShiftToolbar } from "./TimeShiftToolbar.tsx";

export function SpectrogramView({
	audioBuffer,
	handleLoadMusic,
	t,
	uiHeight,
	resizeHandleProps,
	gain,
	setGain,
	minGain,
	maxGain,
	gainPercent,
	thumbOffsetPx,
	rulerRef,
	zoom,
	containerWidth,
	handleRulerScrubStart,
	isDragging,
	isHovering,
	isInvalidEndTime,
	editingTimeField,
	scrollContainerRef,
	scrollLeft,
	handleMouseEnter,
	handleMouseLeave,
	handleMouseMove,
	handleCompositeMouseDown,
	handleDragOver,
	handleDrop,
	totalWidth,
	transformX,
	visibleTiles,
	pendingCursorPosition,
	auditionCursorPosition,
	showRangePreview,
	previewStyle,
	selectionStyle,
	contextValue,
	selectedLines,
	showUnselectedLines,
	setShowUnselectedLines,
	setPreviewActive,
	fftSize,
	setFftSize,
	dynamicMaxHeight,
	dataHeight,
	setDataHeight,
}: ReturnType<typeof useAudioSpectrogram>) {
	return (
		<div
			className={styles.spectrogramContainer}
			style={{ height: `${uiHeight}px` }}
		>
			<div className={styles.resizeHandle} {...resizeHandleProps} />

			<div className={styles.innerContainer}>
				<SpectrogramGainSidebar
					gain={gain}
					setGain={setGain}
					minGain={minGain}
					maxGain={maxGain}
					gainPercent={gainPercent}
					thumbOffsetPx={thumbOffsetPx}
				/>
				<div className={styles.mainContent}>
					{!audioBuffer ? (
						<div className={styles.emptyState}>
							<Flex direction="column" align="center" gap="3">
								<MusicNote2Filled
									fontSize={48}
									color="var(--gray-8)"
									style={{ opacity: 0.5 }}
								/>
								<Text color="gray" size="3">
									{t(
										"spectrogram.noAudioLoaded",
										"Load an audio file to show the spectrogram",
									)}
								</Text>
								<Button variant="soft" onClick={handleLoadMusic}>
									{t("spectrogram.loadAudio", "加载音频文件")}
								</Button>
							</Flex>
						</div>
					) : (
						<>
							<TimelineRuler
								ref={rulerRef}
								zoom={zoom}
								duration={audioBuffer?.duration || 0}
								containerWidth={containerWidth}
								onScrubStart={handleRulerScrubStart}
							/>

							{!isDragging && (
								<HoverTimeTooltip
									isHovering={isHovering}
									isInvalidEndTime={isInvalidEndTime}
									editingTimeField={editingTimeField}
								/>
							)}

							<ScrubHandle
								scrollContainerRef={scrollContainerRef}
								scrollLeft={scrollLeft}
								zoom={zoom}
								containerWidth={containerWidth}
							/>

							<div
								ref={scrollContainerRef}
								className={styles.virtualScrollContainer}
								onMouseEnter={handleMouseEnter}
								onMouseLeave={handleMouseLeave}
								onMouseMove={handleMouseMove}
								onMouseDown={handleCompositeMouseDown}
								onContextMenu={(e) => e.preventDefault()}
								onDragOver={handleDragOver}
								onDrop={handleDrop}
								role="group"
							>
								<div
									className={styles.virtualScrollContent}
									style={{
										width: `${Math.ceil(totalWidth)}px`,
										transform: `translate3d(${-transformX}px, 0, 0)`,
									}}
								>
									{visibleTiles.map((tile) => (
										<TileComponent key={tile.tileId} {...tile} />
									))}
									<PlayheadCursor zoom={zoom} />

									{pendingCursorPosition !== null && (
										<div
											className={styles.pendingCursor}
											style={{
												left: `${pendingCursorPosition}px`,
											}}
										/>
									)}
									{auditionCursorPosition !== null && (
										<div
											className={styles.auditionCursor}
											style={{
												left: `${auditionCursorPosition}px`,
											}}
										/>
									)}
									{showRangePreview && previewStyle && (
										<div
											className={styles.rangePreviewRegion}
											style={previewStyle}
										/>
									)}
									{selectionStyle && (
										<div
											className={styles.rangePreviewRegion}
											style={selectionStyle}
										/>
									)}
									<SpectrogramContext.Provider value={contextValue}>
										<Theme appearance="dark">
											<LyricTimelineOverlay
												clientWidth={containerWidth}
												hiddenLineIds={showRangePreview ? selectedLines : null}
											/>
											{!isDragging && (
												<HoverCursor
													isHovering={isHovering}
													isInvalidEndTime={isInvalidEndTime}
												/>
											)}
										</Theme>
									</SpectrogramContext.Provider>
								</div>
								<Theme appearance="dark">
									<SpectrogramLaneLabels />
								</Theme>
							</div>
							<TimeShiftToolbar />
						</>
					)}
				</div>

				<SpectrogramSettingsSidebar
					t={t}
					showUnselectedLines={showUnselectedLines}
					setShowUnselectedLines={setShowUnselectedLines}
					setPreviewActive={setPreviewActive}
					fftSize={fftSize}
					setFftSize={setFftSize}
					dynamicMaxHeight={dynamicMaxHeight}
					dataHeight={dataHeight}
					setDataHeight={setDataHeight}
				/>
			</div>
		</div>
	);
}
