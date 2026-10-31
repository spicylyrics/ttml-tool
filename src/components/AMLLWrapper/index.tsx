import classNames from "classnames";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timedPreviewLyricsAtom } from "$/components/PreviewModeSwitcher/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	activeLineIdsAtom,
	audioPlayingAtom,
	currentTimeAtom,
} from "$/modules/audio/states/index.ts";
import { playbackClock } from "$/modules/playback-clock";
import { usePreviewScroll } from "$/modules/playback-clock/use-preview-scroll";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import {
	instantHighlightFadeAtom,
	showFpsCounterAtom,
	vsyncAtom,
} from "$/modules/settings/states/preview";
import {
	isDarkThemeAtom,
	projectIdentityAtom,
	selectedLinesAtom,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml";
import styles from "./index.module.css";
import { ActiveLineGroup, StaticLineGroup } from "./LineGroups";
import { groupAMLLLines, type LineGroup } from "./line-groups";
import { PreviewBackground } from "./PreviewBackground";
import { displayTimeAtom, wordRegistry } from "./word-registry";
export const AMLLWrapper = memo(
	({ variant }: { variant?: "standard" | "toxi" }) => {
		const isToxi = variant === "toxi";
		const vsync = useAtomValue(vsyncAtom);
		const showFps = useAtomValue(showFpsCounterAtom);
		const setDisplayTime = useSetAtom(displayTimeAtom);
		const lastUpdateRef = useRef(0);
		const [fps, setFps] = useState(0);
		const fpsRef = useRef({ frames: 0, lastTime: performance.now() });

		useEffect(() => {
			const update = (seconds: number, now: number, seeked = false) => {
				const displayMs = seconds * 1000;
				wordRegistry.forEach(({ el, word }) => {
					const progress =
						word.endTime <= word.startTime
							? 1
							: Math.min(
									Math.max(
										(displayMs - word.startTime) /
											(word.endTime - word.startTime),
										0,
									),
									1,
								);
					el.style.setProperty(
						"--progress",
						`${Math.round(progress * 1000) / 10}%`,
					);
				});
				// Preserve the existing 30/60Hz React budget. DOM progress and the
				// shared editor atom always use the engine's exact frame sample.
				if (
					seeked ||
					!audioEngine.musicPlaying ||
					now - lastUpdateRef.current >= (vsync ? 16.6 : 33.3)
				) {
					setDisplayTime(displayMs);
					lastUpdateRef.current = now;
				}
				fpsRef.current.frames++;
				if (now - fpsRef.current.lastTime >= 1000) {
					setFps(
						Math.round(
							(fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime),
						),
					);
					fpsRef.current = { frames: 0, lastTime: now };
				}
			};
			update(playbackClock.getSnapshot(), performance.now(), true);
			return playbackClock.subscribe(update);
		}, [vsync, setDisplayTime]);

		const lyrics = useAtomValue(timedPreviewLyricsAtom);
		const activeLineIds = useAtomValue(activeLineIdsAtom);
		const darkMode = useAtomValue(isDarkThemeAtom);
		const projectIdentity = useAtomValue(projectIdentityAtom);
		const setCurrentTime = useSetAtom(currentTimeAtom);
		const setSelectedLines = useSetAtom(selectedLinesAtom);

		const scrollContainerRef = useRef<HTMLDivElement>(null);

		// Group lines: in the AMLL data format, a BG vocal line (isBG: true) is
		// ALWAYS placed immediately after its parent main line in the sorted array.
		// This is guaranteed by the TTML→AMLL converter (amll-converter.ts line 149-156).
		// So we just scan in order and attach BG lines to the preceding main line.
		const lineGroups = useMemo((): LineGroup[] => {
			return groupAMLLLines(lyrics.lyricLines);
		}, [lyrics.lyricLines]);

		const activeLineIdsSet = useMemo(
			() => new Set(activeLineIds),
			[activeLineIds],
		);

		const getScrollTarget = useCallback(
			(timeMs: number) => {
				const index = lineGroups.findIndex((group) =>
					[group.main, ...group.bg].some(
						(line) => timeMs >= line.startTime && timeMs <= line.endTime,
					),
				);
				if (index < 0) return undefined;
				return {
					id: lineGroups[index].main.id,
					getNode: () => {
						const wrapper = scrollContainerRef.current?.children[index + 1];
						// display:contents has no box; measure its actual line group.
						const line = wrapper?.firstElementChild ?? wrapper;
						return line instanceof HTMLElement ? line : undefined;
					},
				};
			},
			[lineGroups],
		);
		usePreviewScroll(scrollContainerRef, getScrollTarget, { anchor: 0.4 });

		const handleLineClick = (line: LyricLine) => {
			setCurrentTime(line.startTime);
			setSelectedLines(new Set([line.id]));
			audioEngine.seekMusic(line.startTime / 1000);
		};

		const handleWordClick = (time: number) => {
			setCurrentTime(time);
			audioEngine.seekMusic(time / 1000);
		};

		const isPlaying = useAtomValue(audioPlayingAtom);
		const instantFade = useAtomValue(instantHighlightFadeAtom);
		const albumImg = useAtomValue(customBackgroundImageAtom);

		return (
			<div
				className={classNames(
					styles.amllWrapper,
					darkMode && styles.isDark,
					isToxi && styles.isToxi,
					instantFade && styles.hasInstantFade,
				)}
			>
				{/* Dynamic Mesh Warp Background (Kawarp) */}
				<div className={styles.bgLayer}>
					<PreviewBackground
						key={albumImg || "default"}
						album={albumImg || undefined}
						playing={isPlaying}
					/>
				</div>
				<div className={styles.contentOverlay}>
					<div className={styles.header}>
						<h3>{projectIdentity.name || "Untitled"}</h3>
						<span>{projectIdentity.artist || "Unknown Artist"}</span>
					</div>

					<div className={styles.lyricsViewport} ref={scrollContainerRef}>
						<div className={styles.padding} />
						{lineGroups.map((group) => {
							const isActive =
								activeLineIdsSet.has(group.main.id) ||
								group.bg.some((b) => activeLineIdsSet.has(b.id));

							if (isActive) {
								return (
									<div
										key={group.main.id}
										onClick={() => handleLineClick(group.main)}
										style={{ display: "contents" }}
									>
										<ActiveLineGroup
											group={group}
											onWordClick={handleWordClick}
										/>
									</div>
								);
							}
							return (
								<div
									key={group.main.id}
									onClick={() => handleLineClick(group.main)}
									style={{ display: "contents" }}
								>
									<StaticLineGroup group={group} isPast={false} />
								</div>
							);
						})}
						<div className={styles.padding} />
					</div>
				</div>
				{showFps && (
					<div
						style={{
							position: "absolute",
							bottom: 10,
							right: 10,
							background: "rgba(0,0,0,0.5)",
							color: "#0f0",
							fontFamily: "monospace",
							fontSize: "12px",
							padding: "2px 6px",
							borderRadius: "4px",
							pointerEvents: "none",
							zIndex: 1000,
						}}
					>
						FPS: {fps}
					</div>
				)}
			</div>
		);
	},
);

export default AMLLWrapper;
