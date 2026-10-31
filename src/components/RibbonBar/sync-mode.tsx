import {
	BackgroundSyncControl,
	SettingToggle,
	SyncLevelControl,
	SyncOffsetControl,
} from "$/modules/settings/components/WorkflowControls";
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

import { Flex, Grid } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { cmdToggleWordHighlight } from "$/modules/keyboard/commands";
import { MENU_ACTIONS } from "$/modules/menu-actions/actions";
import { RIBBON_ACTIONS } from "$/modules/menu-actions/ribbon-actions";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";
import {
	highlightActiveWordAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync.ts";
import { showPreviewPanelAtom } from "$/states/main.ts";
import { AdvancedSection } from "./AdvancedSection";
import { RibbonFrame, RibbonSection } from "./common";
import { RibbonActionToggle, RibbonLabel, RibbonToggle } from "./RibbonToggle";

export const SyncModeRibbonBar = forwardRef<HTMLDivElement>((_props, ref) => {
	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const { t } = useTranslation();
	const showAdvanced = useAtomValue(advancedRibbonControlsAtom);
	const syncLevelLabel = t("ribbonBar.syncMode.syncLevel", "Sync by");
	const bgSyncLabel = t("ribbonBar.syncMode.bgLyricSync", "Background lines");
	const previewPanelLabel = t(
		"ribbonBar.editMode.previewPanel",
		"Preview panel",
	);

	return (
		<RibbonFrame ref={ref}>
			<RibbonSection label={t("ribbonBar.syncMode.syncAdjustment", "Offsets")}>
				<Grid
					columns="max-content auto"
					gap="4"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<RibbonLabel
						label={t("ribbonBar.syncMode.timeOffset", "Sync offset")}
						description={t(
							"settings.common.syncTimeOffsetDesc",
							"Shifts every timestamp you record by this amount, to make up for audio or input delay.",
						)}
					/>
					<SyncOffsetControl compact />
					<RibbonLabel
						label={t("ribbonBar.syncMode.commitOffset", "Next key offset")}
						description={t(
							"settings.common.syncCommitOffsetDesc",
							"Extra offset for the Next key only (G by default), for when it lands consistently early or late.",
						)}
					/>
					<SyncOffsetControl commit compact />
				</Grid>
			</RibbonSection>
			<RibbonSection label={syncLevelLabel}>
				<Flex
					direction="column"
					gap="2"
					align="center"
					justify="center"
					px="2"
					style={{ height: "100%" }}
				>
					<ActionTooltip
						label={syncLevelLabel}
						description={t(
							"settings.workflow.syncLevelDesc",
							"Word: time each word as you go. Line: time whole lines and spread their words out evenly, for a rough sync you fine-tune in the spectrogram.",
						)}
					>
						<SyncLevelControl />
					</ActionTooltip>
				</Flex>
			</RibbonSection>
			<RibbonSection
				label={t("ribbonBar.syncMode.playbackTracking", "Tracking")}
			>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<RibbonActionToggle
						action={RIBBON_ACTIONS.syncAutoScroll}
						description={t(
							"settings.common.syncAutoScrollDesc",
							"Scrolls the editor to follow the line that is playing.",
						)}
					/>
					<RibbonActionToggle
						action={RIBBON_ACTIONS.syncHighlightLine}
						description={t(
							"settings.common.highlightActiveLineDesc",
							"Highlights the line that is playing in the selected mode.",
						)}
					/>
				</Grid>
			</RibbonSection>
			<RibbonSection label={previewPanelLabel}>
				<Flex direction="column" align="center" gap="1">
					<ActionTooltip
						label={previewPanelLabel}
						description={t(
							"settings.workflow.previewPanelDesc",
							"Show a live lyric preview next to the word list.",
						)}
						shortcut={RIBBON_ACTIONS.previewPanel.command.atom}
					>
						<SettingToggle setting={showPreviewPanelAtom} />
					</ActionTooltip>
				</Flex>
			</RibbonSection>
			{showAdvanced && (
				<RibbonSection label={bgSyncLabel}>
					<Flex
						direction="column"
						gap="2"
						align="center"
						justify="center"
						px="2"
						style={{ height: "100%" }}
					>
						<ActionTooltip
							label={bgSyncLabel}
							description={t(
								"settings.workflow.bgLyricSyncDesc",
								"How G and H treat background lines while syncing.",
							)}
						>
							<BackgroundSyncControl />
						</ActionTooltip>
					</Flex>
				</RibbonSection>
			)}
			{showAdvanced && (
				<RibbonSection
					label={t("ribbonBar.syncMode.assistSettings", "Sync aids")}
				>
					<Grid
						columns="max-content auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<RibbonActionToggle
							action={RIBBON_ACTIONS.touchSyncPanel}
							description={t(
								"settings.workflow.touchSyncPanelDesc",
								"Show on-screen Start, Next and End buttons for touch screens.",
							)}
						/>
						<RibbonToggle
							label={t(
								"ribbonBar.syncMode.spectrogramHoverSync",
								"Sync at mouse position",
							)}
							description={t(
								"settings.common.spectrogramHoverSyncDesc",
								"While the mouse is over the spectrogram in Time mode, the sync keys record the time under the mouse instead of the playback time.",
							)}
							shortcut={MENU_ACTIONS.spectrogramHoverSync.command.atom}
							setting={spectrogramHoverSyncEnabledAtom}
						/>
					</Grid>
				</RibbonSection>
			)}
			{showAdvanced && (
				<RibbonSection
					label={t("ribbonBar.syncMode.displayOptions", "Display options")}
				>
					<Grid
						columns="max-content auto"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<RibbonActionToggle
							action={RIBBON_ACTIONS.showTimestamps}
							description={t(
								"settings.workflow.showTimestampsDesc",
								"Show start and end times on each word.",
							)}
						/>
						<RibbonToggle
							label={t(
								"ribbonBar.syncMode.highlightActiveWord",
								"Highlight active word",
							)}
							description={t(
								"settings.workflow.highlightActiveWordDesc",
								"Highlight the word that is playing right now.",
							)}
							shortcut={cmdToggleWordHighlight.atom}
							setting={highlightActiveWordAtom}
						/>
						<RibbonActionToggle
							action={RIBBON_ACTIONS.highlightErrors}
							description={t(
								"settings.assistant.highlightErrorsDesc",
								"Mark words whose start time is after their end time.",
							)}
						/>
						{showWordRomanizationInput && (
							<RibbonActionToggle
								action={RIBBON_ACTIONS.syncWordRomanization}
								description={t(
									"settings.workflow.showPerWordRomanizationDesc",
									"Show each word's romanization under it.",
								)}
							/>
						)}
					</Grid>
				</RibbonSection>
			)}
			<AdvancedSection />
		</RibbonFrame>
	);
});

export default SyncModeRibbonBar;
