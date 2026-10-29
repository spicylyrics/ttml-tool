/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import {
	ChevronDownFilled,
	ChevronUpFilled,
	PauseFilled,
	PlayFilled,
} from "@fluentui/react-icons";
import { Card, Flex, IconButton, Inset, Text, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import {
	type CSSProperties,
	type FC,
	memo,
	useCallback,
	useEffect,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import { AudioMenu } from "$/modules/audio/components/AudioMenu";
import { AudioSlider } from "$/modules/audio/components/AudioSlider";
import {
	audioPlayingAtom,
	currentDurationAtom,
	currentTimeAtom,
	playbackRateAtom,
	preservesPitchAtom,
	volumeAtom,
} from "$/modules/audio/states";
import { stepPlaybackRate } from "$/modules/audio/utils/playback-rate";
import { WordCueOptions } from "$/modules/audio/word-cues/settings";
import { WordTimingCue } from "$/modules/audio/word-cues/WordTimingCue";
import { AuditionKeyBinding } from "$/modules/keyboard/components/AuditionKeyBinding";
import { AudioSpectrogram } from "$/modules/spectrogram/components/AudioSpectrogram";
import {
	keyPlaybackRateDownAtom,
	keyPlaybackRateResetAtom,
	keyPlaybackRateUpAtom,
	keyPlayPauseAtom,
	keySeekBackwardAtom,
	keySeekForwardAtom,
	keyVolumeDownAtom,
	keyVolumeUpAtom,
} from "$/states/keybindings.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";

const AudioPlaybackKeyBinding = memo(() => {
	const store = useStore();

	useKeyBindingAtom(keyPlayPauseAtom, () => {
		if (audioEngine.musicPlaying) audioEngine.pauseMusic();
		else audioEngine.resumeOrSeekMusic();
	}, []);

	useKeyBindingAtom(keySeekForwardAtom, () => {
		audioEngine.seekMusic(
			Math.min(audioEngine.musicCurrentTime + 5, audioEngine.musicDuration),
		);
	}, []);

	useKeyBindingAtom(keySeekBackwardAtom, () => {
		audioEngine.seekMusic(Math.max(audioEngine.musicCurrentTime - 5, 0));
	}, []);

	useKeyBindingAtom(keyVolumeUpAtom, () => {
		store.set(volumeAtom, (v) => Math.min(1, v + 0.1));
	}, [store]);

	useKeyBindingAtom(keyVolumeDownAtom, () => {
		store.set(volumeAtom, (v) => Math.max(0, v - 0.1));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateUpAtom, () => {
		store.set(playbackRateAtom, (v) => stepPlaybackRate(v, 1));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateDownAtom, () => {
		store.set(playbackRateAtom, (v) => stepPlaybackRate(v, -1));
	}, [store]);

	useKeyBindingAtom(keyPlaybackRateResetAtom, () => {
		store.set(playbackRateAtom, 1);
	}, [store]);

	return null;
});

// Never wrap or shrink: the inherited overflow-wrap breaks off the last digit
// when the fallback monospace font (Menlo on macOS) runs wider than min-width.
const timeLabelStyle: CSSProperties = {
	minWidth: "5.5em",
	flexShrink: 0,
	whiteSpace: "nowrap",
	fontVariantNumeric: "tabular-nums",
	color: "var(--audio-bar-text, inherit)",
	fontFamily: "var(--timestamp-font-family)",
};

const CurrentTimeLabel: FC = () => {
	const currentTime = useAtomValue(currentTimeAtom);
	return (
		<Text size="2" style={{ ...timeLabelStyle, textAlign: "left" }}>
			{msToTimestamp(currentTime)}
		</Text>
	);
};

export const AudioControls: FC = memo(() => {
	const [audioLoaded, setAudioLoaded] = useState(false);
	const playbackRate = useAtomValue(playbackRateAtom);
	const preservesPitch = useAtomValue(preservesPitchAtom);
	const [spectrogramVisible, setSpectrogramVisible] = useState(false);
	const currentDuration = useAtomValue(currentDurationAtom);
	const [audioPlaying, setAudioPlaying] = useAtom(audioPlayingAtom);
	const [volume, setVolume] = useAtom(volumeAtom);
	const { t } = useTranslation();

	const onTogglePlay = useCallback(() => {
		if (audioEngine.musicPlaying) {
			audioEngine.pauseMusic();
		} else {
			audioEngine.resumeOrSeekMusic();
		}
	}, []);

	useEffect(() => {
		const onMusicLoad = () => {
			setAudioLoaded(true);
			setAudioPlaying(false);
		};
		const onMusicUnload = () => {
			setAudioLoaded(false);
			setAudioPlaying(false);
		};
		const onMusicPause = () => {
			setAudioPlaying(false);
		};
		const onMusicResume = () => {
			setAudioPlaying(true);
		};
		const onVolumeChange = () => {
			setVolume(audioEngine.volume);
		};
		setAudioLoaded(audioEngine.musicLoaded);
		setAudioPlaying(audioEngine.musicPlaying);
		audioEngine.addEventListener("music-load", onMusicLoad);
		audioEngine.addEventListener("music-unload", onMusicUnload);
		audioEngine.addEventListener("music-pause", onMusicPause);
		audioEngine.addEventListener("music-resume", onMusicResume);
		audioEngine.addEventListener("volume-change", onVolumeChange);
		return () => {
			audioEngine.removeEventListener("music-load", onMusicLoad);
			audioEngine.removeEventListener("music-unload", onMusicUnload);
			audioEngine.removeEventListener("music-pause", onMusicPause);
			audioEngine.removeEventListener("music-resume", onMusicResume);
			audioEngine.removeEventListener("volume-change", onVolumeChange);
		};
	}, [setAudioPlaying, setVolume]);

	useEffect(() => {
		audioEngine.volume = volume;
	}, [volume]);

	useEffect(() => {
		audioEngine.musicPlayBackRate = playbackRate;
	}, [playbackRate]);

	useEffect(() => {
		audioEngine.preservesPitch = preservesPitch;
	}, [preservesPitch]);

	return (
		<Card
			data-guide-target="audio"
			m="0"
			style={
				{
					backgroundColor: "var(--audio-bar-bg, var(--rt-color-panel-solid))",
					height: "100%",
					minHeight: 0,
					borderRadius: 0,
					// borderRadius alone leaves the Inset and card background rounded.
					"--card-border-radius": "0px",
				} as CSSProperties
			}
		>
			<Inset>
				<AudioPlaybackKeyBinding />
				<AuditionKeyBinding />
				<Flex direction="column">
					<div style={{ display: spectrogramVisible ? "flex" : "none" }}>
						<AudioSpectrogram />
					</div>
					<WordTimingCue />
					<Flex
						align="center"
						px="2"
						gapX="2"
						data-guide-target="audio-playback-bar"
					>
						<AudioMenu />
						<Tooltip content={t("audioPanel.playPause", "暂停 / 播放音乐")}>
							<IconButton
								my="2"
								ml="0"
								variant="soft"
								disabled={!audioLoaded}
								onClick={onTogglePlay}
								aria-label={t("audioPanel.playPause", "Play / pause music")}
								aria-pressed={audioPlaying}
							>
								{audioPlaying ? <PauseFilled /> : <PlayFilled />}
							</IconButton>
						</Tooltip>
						<WordCueOptions />
						<CurrentTimeLabel />
						<AudioSlider />
						<Text size="2" style={timeLabelStyle}>
							{msToTimestamp(currentDuration)}
						</Text>
						<Tooltip
							content={t("audioPanel.expandSpectrogram", "展开 / 收起频谱图")}
						>
							<IconButton
								my="2"
								ml="0"
								variant="soft"
								onClick={() => setSpectrogramVisible(!spectrogramVisible)}
								aria-label={t(
									"audioPanel.expandSpectrogram",
									"Expand / collapse spectrogram",
								)}
								aria-expanded={spectrogramVisible}
							>
								{spectrogramVisible ? (
									<ChevronDownFilled />
								) : (
									<ChevronUpFilled />
								)}
							</IconButton>
						</Tooltip>
					</Flex>
				</Flex>
			</Inset>
		</Card>
	);
});

export default AudioControls;
