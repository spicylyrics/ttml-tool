import {
	ClockRegular,
	EyeFilled,
	EyeOffFilled,
	SettingsFilled,
} from "@fluentui/react-icons";
import {
	Flex,
	IconButton,
	Popover,
	Slider,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { memo } from "react";
import { OptionPicker } from "$/components/OptionPicker";
import type { useAudioSpectrogram } from "../hooks/useAudioSpectrogram";
import styles from "./AudioSpectrogram.module.css";
import { FollowPlayheadButton } from "./FollowPlayheadButton.tsx";
import { FrequencyRuler } from "./FrequencyRuler.tsx";
import { SpectrogramLaneToggles } from "./SpectrogramLaneToggles.tsx";

type SpectrogramState = ReturnType<typeof useAudioSpectrogram>;

function GainSidebar({
	gain,
	setGain,
	minGain,
	maxGain,
	gainPercent,
	thumbOffsetPx,
}: Pick<
	SpectrogramState,
	"gain" | "setGain" | "minGain" | "maxGain" | "gainPercent" | "thumbOffsetPx"
>) {
	return (
		<div className={`${styles.sidebar} ${styles.leftSidebar}`}>
			<Flex
				direction="column"
				align="center"
				gap="2"
				style={{ height: "100%", width: "100%" }}
			>
				<Flex
					direction="column"
					align="center"
					justify="end"
					style={{
						flex: 1,
						width: "100%",
						padding: "4px 0",
						position: "relative",
					}}
				>
					<FrequencyRuler />
					<div
						className={styles.gainSliderContainer}
						style={{ height: "95%", zIndex: 10 }}
					>
						<Slider
							orientation="vertical"
							size="1"
							min={minGain}
							max={maxGain}
							step={0.5}
							value={[gain]}
							onValueChange={(v) => setGain(v[0])}
							style={{ flex: 1, width: "18px", zIndex: 10 }}
						/>
						<div
							className={styles.gainTooltip}
							style={{
								bottom: `calc(${gainPercent}% + ${thumbOffsetPx}px)`,
							}}
						>
							{gain}x
						</div>
					</div>
				</Flex>
			</Flex>
		</div>
	);
}

function SettingsSidebar({
	t,
	showUnselectedLines,
	setShowUnselectedLines,
	setPreviewActive,
	fftSize,
	setFftSize,
	dynamicMaxHeight,
	dataHeight,
	setDataHeight,
}: Pick<
	SpectrogramState,
	| "t"
	| "showUnselectedLines"
	| "setShowUnselectedLines"
	| "setPreviewActive"
	| "fftSize"
	| "setFftSize"
	| "dynamicMaxHeight"
	| "dataHeight"
	| "setDataHeight"
>) {
	return (
		<div className={`${styles.sidebar} ${styles.rightSidebar}`}>
			<Tooltip
				content={t("spectrogram.showUnselectedLines", "显示未选中行")}
				side="left"
			>
				<IconButton
					variant={showUnselectedLines ? "solid" : "outline"}
					onClick={() => setShowUnselectedLines((prev) => !prev)}
					aria-label={t("spectrogram.showUnselectedLines", "显示未选中行")}
					aria-pressed={showUnselectedLines}
				>
					{showUnselectedLines ? <EyeFilled /> : <EyeOffFilled />}
				</IconButton>
			</Tooltip>

			<SpectrogramLaneToggles />

			<Tooltip content={t("timeShiftDialog.title", "Time Shift")} side="left">
				<IconButton
					variant="ghost"
					color="gray"
					onClick={() => {
						setPreviewActive((prev) => !prev);
					}}
					aria-label={t("timeShiftDialog.title", "Time Shift")}
				>
					<ClockRegular />
				</IconButton>
			</Tooltip>

			<FollowPlayheadButton />

			<Popover.Root>
				<Popover.Trigger>
					<IconButton
						variant="ghost"
						color="gray"
						title={t("spectrogram.settings", "Spectrogram settings")}
					>
						<SettingsFilled />
					</IconButton>
				</Popover.Trigger>
				<Popover.Content side="left" align="end" style={{ width: 220 }}>
					<Flex direction="column" gap="3">
						<Text size="2" weight="bold">
							{t("spectrogram.settings", "Spectrogram settings")}
						</Text>

						<Flex direction="column" gap="2">
							<Text size="1" color="gray">
								{t("spectrogram.fftSize", "FFT size")} (
								{t("spectrogram.resolution", "FFT resolution")})
							</Text>
							<OptionPicker
								value={fftSize.toString()}
								onValueChange={(v) => setFftSize(Number.parseInt(v, 10))}
								label={t("spectrogram.fftSize", "FFT size")}
								options={["512", "1024", "2048", "4096"].map((size) => ({
									value: size,
									label: size,
								}))}
							/>
						</Flex>

						<Flex align="center" gap="2">
							<Text size="1" color="gray">
								{t("spectrogram.height", "Display height")}
							</Text>
							<Slider
								size="1"
								min={100}
								max={dynamicMaxHeight}
								step={10}
								value={[Math.min(dataHeight, dynamicMaxHeight)]}
								onValueChange={(v) => setDataHeight(v[0])}
							/>
							<Text size="1">{Math.min(dataHeight, dynamicMaxHeight)}px</Text>
						</Flex>
					</Flex>
				</Popover.Content>
			</Popover.Root>
		</div>
	);
}

// Memoized so pointer movement and playback over the spectrogram don't
// re-render these controls.
export const SpectrogramGainSidebar = memo(GainSidebar);
export const SpectrogramSettingsSidebar = memo(SettingsSidebar);
