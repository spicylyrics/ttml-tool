import { Flex, SegmentedControl, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { BrandMark } from "$/components/BrandBand";
import WindowControls from "$/components/WindowControls";
import { transcriptionModeEnabledAtom } from "$/modules/transcription/states";
import {
	keySwitchEditModeAtom,
	keySwitchPreviewModeAtom,
	keySwitchSyncModeAtom,
} from "$/states/keybindings.ts";
import {
	previousToolModeAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import { TopMenu } from "../TopMenu/index.tsx";
import styles from "./index.module.css";

export const TitleBar: FC = () => {
	const [toolMode, setToolMode] = useAtom(toolModeAtom);
	const setPreviousToolMode = useSetAtom(previousToolModeAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const { t } = useTranslation();
	const switchMode = useCallback(
		(targetMode: ToolMode) => {
			if (targetMode === toolMode) return;
			setPreviousToolMode(toolMode);
			setToolMode(targetMode);
		},
		[toolMode, setToolMode, setPreviousToolMode],
	);

	const onSwitchEditMode = useCallback(() => {
		switchMode(ToolMode.Edit);
	}, [switchMode]);
	const onSwitchSyncMode = useCallback(() => {
		switchMode(ToolMode.Sync);
	}, [switchMode]);
	const onSwitchPreviewMode = useCallback(() => {
		switchMode(ToolMode.Preview);
	}, [switchMode]);

	useKeyBindingAtom(keySwitchEditModeAtom, onSwitchEditMode);
	useKeyBindingAtom(keySwitchSyncModeAtom, onSwitchSyncMode);
	useKeyBindingAtom(keySwitchPreviewModeAtom, onSwitchPreviewMode);

	// Turning the flag off while transcribing would leave no tab selected.
	const transcriptionEnabled = useAtomValue(transcriptionModeEnabledAtom);
	useEffect(() => {
		if (!transcriptionEnabled && toolMode === ToolMode.Transcribe)
			switchMode(ToolMode.Edit);
	}, [transcriptionEnabled, toolMode, switchMode]);

	return (
		<WindowControls
			startChildren={<TopMenu />}
			titleChildren={
				<SegmentedControl.Root
					value={toolMode}
					onValueChange={(v) => switchMode(v as ToolMode)}
					// size="1"
				>
					{/* The tooltip goes inside the item: wrapping the item itself would
					    break the control's active indicator. */}
					<SegmentedControl.Item value={ToolMode.Edit}>
						<ActionTooltip
							label={t("topBar.modeBtns.edit", "编辑")}
							description={t(
								"topBar.modeBtns.editDesc",
								"Type, split and mark up the lyrics.",
							)}
							shortcut={keySwitchEditModeAtom}
						>
							{t("topBar.modeBtns.edit", "编辑")}
						</ActionTooltip>
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Sync}>
						<ActionTooltip
							label={t("topBar.modeBtns.sync", "打轴")}
							description={t(
								"topBar.modeBtns.syncDesc",
								"Time each word to the audio.",
							)}
							shortcut={keySwitchSyncModeAtom}
						>
							{t("topBar.modeBtns.sync", "打轴")}
						</ActionTooltip>
					</SegmentedControl.Item>
					<SegmentedControl.Item value={ToolMode.Preview}>
						<ActionTooltip
							label={t("topBar.modeBtns.preview", "预览")}
							description={t(
								"topBar.modeBtns.previewDesc",
								"Play the lyrics back the way listeners will see them.",
							)}
							shortcut={keySwitchPreviewModeAtom}
						>
							{t("topBar.modeBtns.preview", "预览")}
						</ActionTooltip>
					</SegmentedControl.Item>
					{transcriptionEnabled && (
						<SegmentedControl.Item value={ToolMode.Transcribe}>
							<ActionTooltip
								label={t("transcription.modeBtn", "Transcribe")}
								description={t(
									"transcription.modeBtnDesc",
									"Type the lyrics as plain text while the song plays.",
								)}
							>
								{t("transcription.modeBtn", "Transcribe")}
							</ActionTooltip>
						</SegmentedControl.Item>
					)}
				</SegmentedControl.Root>
			}
			endChildren={
				!import.meta.env.TAURI_ENV_PLATFORM && (
					<Flex align="center" gap="2" mr="2">
						<Flex
							direction="column"
							align="end"
							justify="center"
							style={{ lineHeight: 1.2 }}
						>
							<Text
								style={{ color: "var(--accent-11)" }}
								wrap="nowrap"
								size="2"
								className={styles.lockup}
							>
								<BrandMark className={styles.lockupMark} />
								<span className={styles.title}>
									{t("topBar.appName", "TTML Tool")}
								</span>
							</Text>
						</Flex>
					</Flex>
				)
			}
			onSpacerClicked={() => {
				setSelectedLines((o) => o.clear());
				setSelectedWords((o) => o.clear());
			}}
		/>
	);
};
