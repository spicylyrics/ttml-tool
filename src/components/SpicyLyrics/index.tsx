/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import classNames from "classnames";
import { type CSSProperties, memo } from "react";
import styles from "./index.module.css";
import { SpicyLyricLines } from "./SpicyLyricLines";
import { useSpicyLyrics } from "./useSpicyLyrics";

export const SpicyLyrics = memo(() => {
	const {
		simple,
		userFont,
		useAccent,
		accent,
		coverPalette,
		backgroundRef,
		backgroundMode,
		backgroundImage,
		showFps,
		fps,
		viewportRef,
		hasDuetLines,
		lines,
		rows,
		totalSize,
		measureRow,
		lineNodes,
		wordNodes,
		showTranslation,
		seek,
	} = useSpicyLyrics();

	return (
		<div
			className={classNames(
				styles.root,
				simple && styles.simple,
				userFont && styles.userFont,
			)}
			style={
				{
					"--spicy-accent": useAccent ? accent : "#5c6cff",
					"--spicy-cover-base": coverPalette?.base,
					"--spicy-cover-highlight": coverPalette?.highlight,
				} as CSSProperties
			}
		>
			<div
				ref={backgroundRef}
				className={classNames(
					styles.background,
					backgroundMode === "animated" && styles.animatedBackground,
				)}
			/>
			{backgroundMode === "color" ? (
				<div className={styles.colorBackground} />
			) : null}
			{backgroundMode === "static" && backgroundImage ? (
				<div
					className={styles.staticBackground}
					style={{ backgroundImage: `url("${backgroundImage}")` }}
				/>
			) : null}
			{backgroundMode === "static" && !backgroundImage ? (
				<div className={styles.staticFallback} />
			) : null}
			<div className={styles.overlay} />
			{showFps ? <div className={styles.fpsCounter}>FPS: {fps}</div> : null}
			<div
				ref={viewportRef}
				className={classNames(
					styles.viewport,
					hasDuetLines && styles.hasDuetLines,
				)}
			>
				<SpicyLyricLines
					lines={lines}
					rows={rows}
					totalSize={totalSize}
					measureRow={measureRow}
					lineNodes={lineNodes}
					wordNodes={wordNodes}
					showTranslation={showTranslation}
					seek={seek}
				/>
			</div>
		</div>
	);
});

export default SpicyLyrics;
