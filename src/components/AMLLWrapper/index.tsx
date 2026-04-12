// #if AMLL_LOCAL_EXISTS
// #warning Using local Apple Music Like Lyrics, skip importing css style
// #else
import "@applemusic-like-lyrics/core/style.css";

// #endif

// import { MaskObsceneWordsMode } from "@applemusic-like-lyrics/core";
import {
	LyricPlayer,
	type LyricPlayerRef,
} from "@applemusic-like-lyrics/react";
import { Card } from "@radix-ui/themes";
import structuredClone from "@ungap/structured-clone";
import classNames from "classnames";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useEffect, useMemo, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	audioPlayingAtom,
	currentTimeAtom,
	playbackRateAtom,
} from "$/modules/audio/states";
import {
	lyricWordFadeWidthAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
} from "$/modules/settings/states/preview";
import {
	isDarkThemeAtom,
	lyricLinesAtom,
	selectedLinesAtom,
} from "$/states/main.ts";
import styles from "./index.module.css";

export const AMLLWrapper = memo(() => {
	const originalLyricLines = useAtomValue(lyricLinesAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const isPlaying = useAtomValue(audioPlayingAtom);
	const isPlayingRef = useRef(isPlaying);
	isPlayingRef.current = isPlaying;
	useAtomValue(playbackRateAtom);
	const darkMode = useAtomValue(isDarkThemeAtom);
	const showTranslationLines = useAtomValue(showTranslationLinesAtom);
	const showRomanLines = useAtomValue(showRomanLinesAtom);
	const wordFadeWidth = useAtomValue(lyricWordFadeWidthAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const playerRef = useRef<LyricPlayerRef>(null);

	const lyricLines = useMemo(() => {
		return structuredClone(
			originalLyricLines.lyricLines.map((line) => ({
				...line,
				translatedLyric: showTranslationLines ? line.translatedLyric : "",
				romanLyric: showRomanLines ? line.romanLyric : "",
			})),
		);
	}, [originalLyricLines, showTranslationLines, showRomanLines]);

	useEffect(() => {
		setTimeout(() => {
			playerRef.current?.lyricPlayer?.calcLayout(true);
		}, 1500);
	}, []);

	const coverArt = useMemo(() => {
		const art = originalLyricLines.metadata.find(
			(m) => m.key === "cover_art" || m.key === "image",
		);
		if (!art?.value[0]) return "";
		return getBetterGeniusCoverArt(art.value[0], 600);
	}, [originalLyricLines.metadata]);

	return (
		<Card className={classNames(styles.amllWrapper, darkMode && styles.isDark)}>
			<div className={styles.backgroundContainer}>
				{coverArt && (
					<img
						src={coverArt}
						key={coverArt}
						className={styles.backgroundImage}
						alt=""
					/>
				)}
				<div className={styles.gradientFallback} />
				<div className={styles.backgroundOverlay} />
			</div>
			<div className={styles.contentOverlay}>
				<LyricPlayer
					style={{
						height: "100%",
						boxSizing: "content-box",
					}}
					onLyricLineClick={(evt) => {
						if (!isPlayingRef.current) return;
						const lineStartTimeMs = evt.line.getLine().startTime;
						setCurrentTime(lineStartTimeMs);
						const lineId = (evt.line.getLine() as { id?: string }).id;
						if (lineId) setSelectedLines(new Set([lineId]));
						audioEngine.seekMusic(lineStartTimeMs / 1000);
						playerRef.current?.lyricPlayer?.resetScroll();
					}}
					lyricLines={lyricLines}
					currentTime={currentTime}
					playing={isPlaying}
					// maskObsceneWordsMode={
					// 	hideObsceneWords
					// 		? MaskObsceneWordsMode.FullMask
					// 		: MaskObsceneWordsMode.Disabled
					// }
					wordFadeWidth={wordFadeWidth}
					ref={playerRef}
				/>
			</div>
		</Card>
	);
});

export default AMLLWrapper;
