import { MusicNote2Filled } from "@fluentui/react-icons";
import {
	Button,
	IconButton,
	Popover,
	Slider,
	Switch,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { type ComponentProps, type FC, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLoadAudio } from "$/hooks/useLoadAudio";
import {
	audioCoverArtAtom,
	currentDurationAtom,
	loadedAudioAtom,
	playbackRateAtom,
	preservesPitchAtom,
	volumeAtom,
} from "$/modules/audio/states";
import {
	clampPlaybackRate,
	MAX_PLAYBACK_RATE,
} from "$/modules/audio/utils/playback-rate";
import styles from "./AudioMenu.module.css";

/** Speeds people sync at: slowed down for fast lines, or a little faster to check. */
const SPEED_PRESETS = [0.5, 0.75, 1, 1.25];

/**
 * Radix puts `aria-label` on the slider root, but screen readers announce the
 * focusable thumb, so the name goes there.
 */
const LabeledSlider: FC<
	Omit<ComponentProps<typeof Slider>, "aria-label"> & {
		label: string;
		valueText?: string;
	}
> = ({ label, valueText, ...props }) => {
	const ref = useRef<HTMLSpanElement>(null);
	useLayoutEffect(() => {
		const thumb = ref.current?.querySelector('[role="slider"]');
		thumb?.setAttribute("aria-label", label);
		if (valueText) thumb?.setAttribute("aria-valuetext", valueText);
	}, [label, valueText]);
	return <Slider ref={ref} {...props} />;
};

/** `m:ss`, or `h:mm:ss` past an hour. */
function formatDuration(ms: number): string {
	const total = Math.round(ms / 1000);
	const h = Math.floor(total / 3600);
	const m = Math.floor(total / 60) % 60;
	const s = String(total % 60).padStart(2, "0");
	return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const formatRate = (rate: number) => `${Number(rate.toFixed(2))}×`;

const SpeedControl: FC = () => {
	const { t } = useTranslation();
	const [rate, setRate] = useAtom(playbackRateAtom);
	const label = t("audioPanel.playbackRate", "Playback speed");
	const resetLabel = t("audioPanel.resetSpeed", "Reset to 1×");

	return (
		<div className={styles.group}>
			<div className={styles.head}>
				<Text size="2" weight="medium">
					{label}
				</Text>
				{rate === 1 ? (
					<Text size="2" color="gray" className={styles.value}>
						1.00×
					</Text>
				) : (
					// The slider already announces the value; this names the action.
					<Tooltip content={resetLabel}>
						<Button
							size="1"
							variant="ghost"
							color="gray"
							className={styles.value}
							onClick={() => setRate(1)}
							aria-label={resetLabel}
						>
							{rate.toFixed(2)}×
						</Button>
					</Tooltip>
				)}
			</div>
			<div className={styles.presets}>
				{SPEED_PRESETS.map((preset) => (
					<Button
						key={preset}
						size="1"
						variant={rate === preset ? "solid" : "soft"}
						color={rate === preset ? undefined : "gray"}
						aria-pressed={rate === preset}
						onClick={() => setRate(preset)}
						className={styles.value}
					>
						{formatRate(preset)}
					</Button>
				))}
			</div>
			<div className={styles.centered}>
				{/* The track starts at 0 so 1x lands in the middle with even 0.05
				    steps; the first notch clamps to the 0.1x minimum. */}
				<LabeledSlider
					label={label}
					valueText={formatRate(rate)}
					min={0}
					max={MAX_PLAYBACK_RATE}
					step={0.05}
					value={[rate]}
					onValueChange={(v) =>
						setRate(clampPlaybackRate(Math.round(v[0] * 100) / 100))
					}
				/>
			</div>
		</div>
	);
};

/** The song being synced, with load or replace. Sits next to the trigger. */
const SongSlot: FC = () => {
	const { t } = useTranslation();
	const { loadAudio } = useLoadAudio();
	const audio = useAtomValue(loadedAudioAtom);
	const cover = useAtomValue(audioCoverArtAtom);
	const duration = useAtomValue(currentDurationAtom);
	const loaded = audio.size > 0;
	const name = audio instanceof File ? audio.name : null;

	if (!loaded) {
		return (
			<div className={styles.song}>
				<div className={styles.coverPlaceholder} aria-hidden>
					<MusicNote2Filled />
				</div>
				<Popover.Close>
					<Button size="2" className={styles.loadWide} onClick={loadAudio}>
						{t("spectrogram.loadAudio", "Load audio file")}
					</Button>
				</Popover.Close>
			</div>
		);
	}

	return (
		<div className={styles.song}>
			{cover ? (
				<img className={styles.cover} src={cover} alt="" />
			) : (
				<div className={styles.coverPlaceholder} aria-hidden>
					<MusicNote2Filled />
				</div>
			)}
			<div className={styles.songText}>
				<Text
					size="2"
					weight="medium"
					className={styles.songName}
					title={name ?? undefined}
				>
					{name ?? t("audioPanel.loadedAudio", "Loaded audio")}
				</Text>
				<Text size="1" color="gray" className={styles.value}>
					{formatDuration(duration)}
				</Text>
			</div>
			<Popover.Close>
				<Button size="2" variant="soft" onClick={loadAudio}>
					{t("audioPanel.replaceAudio", "Replace")}
				</Button>
			</Popover.Close>
		</div>
	);
};

/** The audio bar's music note: how the song plays, then the song itself. */
export const AudioMenu: FC = () => {
	const { t } = useTranslation();
	const [volume, setVolume] = useAtom(volumeAtom);
	const [preservesPitch, setPreservesPitch] = useAtom(preservesPitchAtom);
	const menuLabel = t("audioPanel.audioMenu", "Audio and playback");
	// Cue clicks have their own volume, so name this one for the music.
	const volumeLabel = t("wordCue.musicVolume", "Music volume");

	return (
		<Popover.Root>
			<Tooltip content={menuLabel}>
				<Popover.Trigger>
					<IconButton my="2" variant="soft" aria-label={menuLabel}>
						<MusicNote2Filled />
					</IconButton>
				</Popover.Trigger>
			</Tooltip>
			<Popover.Content
				side="top"
				align="start"
				width="300px"
				className={styles.content}
			>
				<div className={styles.controls}>
					<SpeedControl />
					<Text as="label" size="2" className={styles.head}>
						{t("audioPanel.preservesPitch", "Preserve pitch")}
						<Switch
							checked={preservesPitch}
							onCheckedChange={setPreservesPitch}
						/>
					</Text>
					<div className={styles.group}>
						<div className={styles.head}>
							<Text size="2" weight="medium">
								{volumeLabel}
							</Text>
							<Text size="2" color="gray" className={styles.value}>
								{Math.round(volume * 100)}%
							</Text>
						</div>
						<LabeledSlider
							label={volumeLabel}
							min={0}
							max={1}
							step={0.01}
							value={[volume]}
							onValueChange={(v) => setVolume(v[0])}
						/>
					</div>
				</div>
				<SongSlot />
			</Popover.Content>
		</Popover.Root>
	);
};
