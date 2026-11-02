import { type FC, memo } from "react";
import { useAudioSpectrogram } from "../hooks/useAudioSpectrogram";
import { useFollowPlayhead } from "../hooks/useFollowPlayhead";
import { SpectrogramView } from "./SpectrogramView";

export const AudioSpectrogram: FC = memo(() => {
	const state = useAudioSpectrogram();
	useFollowPlayhead(state.scrollContainerRef);
	return <SpectrogramView {...state} />;
});

export default AudioSpectrogram;
