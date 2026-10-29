import { useAtomValue } from "jotai";
import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { playbackClock } from "$/modules/playback-clock";
import { lyricLinesAtom } from "$/states/main";
import { audioEngine } from "../audio-engine";
import { buildCueIndex, cueAt, upperBound } from "./model";
import {
	showWordTimingCueAtom,
	wordTimingClicksAtom,
	wordTimingClickVolumeAtom,
	wordTimingCueModeAtom,
} from "./states";
import styles from "./word-cue.module.css";

export const WordTimingCue = memo(() => {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const index = useMemo(() => buildCueIndex(lyrics.lyricLines), [lyrics]);
	const visible = useAtomValue(showWordTimingCueAtom);
	const clicks = useAtomValue(wordTimingClicksAtom);
	const cueMode = useAtomValue(wordTimingCueModeAtom);
	const volume = useAtomValue(wordTimingClickVolumeAtom);
	const root = useRef<HTMLDivElement>(null);
	const fill = useRef<HTMLDivElement>(null);
	const meter = useRef<HTMLDivElement>(null);
	const notches = useRef<HTMLDivElement>(null);
	const status = useRef<HTMLSpanElement>(null);
	const nextLabel = useRef<HTMLSpanElement>(null);
	const nextDot = useRef<HTMLSpanElement>(null);
	const syllableDot = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		audioEngine.setWordTimingCues(
			clicks ? index.clicks[cueMode] : [],
			clicks ? volume : 0,
		);
		return () => audioEngine.setWordTimingCues([], 0);
	}, [index, clicks, cueMode, volume]);

	useEffect(() => {
		if (!visible) return;
		let previousMs: number | undefined;
		let wasPlaying = false;
		let blink: Animation | undefined;
		let lastActive: (typeof index.words)[number] | undefined;
		const update = (seconds: number, _now?: number, seeked = false) => {
			if (
				!root.current ||
				!fill.current ||
				!status.current ||
				!nextLabel.current ||
				!meter.current
			)
				return;
			const timeMs = seconds * 1000;
			const { active, next, nextCueTime, progress } = cueAt(
				index,
				timeMs,
				cueMode,
			);
			if (notches.current && lastActive !== active) {
				lastActive = active;
				notches.current.replaceChildren();
				if (active && cueMode === "word") {
					for (const boundary of active.boundaries) {
						const notch = document.createElement("span");
						notch.className = styles.notch;
						notch.style.left = `${((boundary - active.start) / (active.end - active.start)) * 100}%`;
						notches.current.appendChild(notch);
					}
				}
			}
			const loaded = audioEngine.musicLoaded;
			const playing = audioEngine.musicPlaying;
			const onset =
				index.syllableStarts[
					upperBound(index.syllableStarts, timeMs, (start) => start) - 1
				];
			if (
				loaded &&
				playing &&
				!seeked &&
				syllableDot.current &&
				onset !== undefined &&
				(previousMs === undefined || timeMs >= previousMs) &&
				((wasPlaying && previousMs !== undefined && onset > previousMs) ||
					(!wasPlaying && timeMs - onset < 50))
			) {
				blink?.cancel();
				blink = syllableDot.current.animate(
					[{ opacity: 1 }, { opacity: 0.2 }],
					{ duration: 100, easing: "ease-out" },
				);
			}
			previousMs = timeMs;
			wasPlaying = playing;
			root.current.dataset.active = String(loaded && !!active);
			fill.current.style.transform = `scaleX(${loaded ? progress : 0})`;
			meter.current.setAttribute(
				"aria-valuenow",
				String(Math.round((loaded ? progress : 0) * 100)),
			);
			status.current.textContent = !loaded
				? t("wordCue.load", "Load audio")
				: !index.words.length
					? t("wordCue.untimed", "No word timings")
					: !playing
						? t("wordCue.paused", "Paused")
						: active
							? t("wordCue.active", "Active")
							: next
								? t("wordCue.gap", "Gap")
								: t("wordCue.done", "Done");
			const until =
				nextCueTime !== undefined && loaded
					? Math.max(
							0,
							(nextCueTime - timeMs) / 1000 / audioEngine.musicPlayBackRate,
						)
					: undefined;
			nextLabel.current.textContent =
				until === undefined
					? t(
							cueMode === "syllable"
								? "wordCue.noNextSyllable"
								: "wordCue.noNext",
							cueMode === "syllable" ? "No next syllable" : "No next word",
						)
					: t(
							cueMode === "syllable"
								? "wordCue.nextSyllableIn"
								: "wordCue.nextIn",
							cueMode === "syllable"
								? "Next syllable in {seconds}s"
								: "Next word in {seconds}s",
							{ seconds: until.toFixed(2) },
						);
			if (nextDot.current) {
				nextDot.current.style.visibility =
					until === undefined ? "hidden" : "visible";
				nextDot.current.style.left = `${(1 - Math.min(1, (until ?? 0) / 2)) * 100}%`;
			}
			if (syllableDot.current) {
				syllableDot.current.style.visibility =
					loaded && index.syllableStarts.length ? "visible" : "hidden";
			}
		};
		const updateNow = () => update(playbackClock.getSnapshot());
		const unsubscribe = playbackClock.subscribe(update);
		audioEngine.addEventListener("music-playback-rate-change", updateNow);
		updateNow();
		return () => {
			blink?.cancel();
			unsubscribe();
			audioEngine.removeEventListener("music-playback-rate-change", updateNow);
		};
	}, [index, visible, cueMode, t]);

	if (!visible) return null;
	return (
		<div
			ref={root}
			className={styles.cue}
			data-active="false"
			data-guide-target="word-timing-cue"
		>
			<span className={styles.title}>
				{t("wordCue.shortTitle", "Word timing")}
			</span>
			<span ref={status} className={styles.status} />
			<div
				ref={meter}
				className={styles.meter}
				role="progressbar"
				aria-label={t(
					cueMode === "syllable"
						? "wordCue.syllableProgress"
						: "wordCue.progress",
					cueMode === "syllable"
						? "Current syllable progress"
						: "Current word progress",
				)}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={0}
			>
				<div ref={fill} className={styles.fill} />
				<div ref={notches} className={styles.notches} aria-hidden="true" />
			</div>
			<div className={styles.approach} aria-hidden="true">
				<span ref={syllableDot} className={styles.syllableDot} />
				<div className={styles.approachTrack}>
					<span ref={nextDot} className={styles.dot} />
				</div>
			</div>
			<span ref={nextLabel} className={styles.next} />
		</div>
	);
});
