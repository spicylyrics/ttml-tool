import {
	PreviewModeControl,
	SpicyBackgroundControl,
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

import { Grid } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import {
	PreviewModeType,
	previewModeTypeAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { timingOverviewAutoScrollAtom } from "$/modules/settings/states/sync.ts";
import { AdvancedSection } from "./AdvancedSection";
import { RibbonFrame, RibbonSection } from "./common";
import { ToxiSection } from "./preview-mode/ToxiSection";
import { RibbonLabel, RibbonToggle } from "./RibbonToggle";

export const PreviewModeRibbonBar = forwardRef<HTMLDivElement>(
	(_props, ref) => {
		const previewModeType = useAtomValue(previewModeTypeAtom);
		const { t } = useTranslation();
		const modeLabel = t("ribbonBar.previewMode.mode", "模式");
		const backgroundLabel = t("ribbonBar.previewMode.background", "Background");
		const backgroundDescription = t(
			"settings.workflow.spicyBackgroundDesc",
			"What shows behind the Spicy preview.",
		);

		return (
			<RibbonFrame ref={ref}>
				<RibbonSection label={modeLabel}>
					<ActionTooltip
						label={modeLabel}
						description={t(
							"settings.workflow.previewModeDesc",
							"Choose which preview the Preview tab shows.",
						)}
					>
						<PreviewModeControl />
					</ActionTooltip>
				</RibbonSection>
				{previewModeType === PreviewModeType.Spicy && (
					<RibbonSection
						label={t("ribbonBar.previewMode.spicy", "Spicy Lyrics")}
					>
						<Grid
							columns="max-content auto"
							gap="2"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<RibbonToggle
								label={t(
									"ribbonBar.previewMode.simpleLyrics",
									"Simple Lyrics mode",
								)}
								description={t(
									"settings.workflow.simpleLyricsDesc",
									"Match Spicy Lyrics' Simple Lyrics mode, with calmer word animations.",
								)}
								setting={spicySimpleLyricsModeAtom}
							/>
							<RibbonToggle
								label={t(
									"ribbonBar.previewMode.forceLineRendering",
									"Show as line-synced",
								)}
								description={t(
									"settings.workflow.forceLineRenderingDesc",
									"Show every line in the Spicy preview as line-synced, without word timing.",
								)}
								setting={spicyForceLineSyncedAtom}
							/>
							<RibbonLabel
								label={backgroundLabel}
								description={backgroundDescription}
							/>
							<ActionTooltip
								label={backgroundLabel}
								description={backgroundDescription}
							>
								<SpicyBackgroundControl />
							</ActionTooltip>
						</Grid>
					</RibbonSection>
				)}
				{previewModeType === PreviewModeType.Toxi && <ToxiSection />}
				{previewModeType === PreviewModeType.Timing && (
					<RibbonSection label={t("ribbonBar.previewMode.timing", "时轴")}>
						<Grid
							columns="max-content auto"
							gap="2"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<RibbonToggle
								label={t("ribbonBar.previewMode.autoScroll", "Auto-scroll")}
								description={t(
									"settings.workflow.timingOverviewAutoScrollDesc",
									"Keep the timing overview scrolled to the playhead.",
								)}
								setting={timingOverviewAutoScrollAtom}
							/>
						</Grid>
					</RibbonSection>
				)}
				{previewModeType !== PreviewModeType.Timing && (
					<RibbonSection label={t("ribbonBar.previewMode.lyrics", "歌词")}>
						<Grid
							columns="max-content auto"
							gap="2"
							gapY="1"
							flexGrow="1"
							align="center"
						>
							<RibbonToggle
								label={t(
									"ribbonBar.previewMode.showTranslation",
									"Show translation",
								)}
								description={t(
									"settings.workflow.previewShowTranslationDesc",
									"Show translation lines in the preview.",
								)}
								setting={showTranslationLinesAtom}
							/>
							<RibbonToggle
								label={t(
									"ribbonBar.previewMode.showRoman",
									"Show romanization",
								)}
								description={t(
									"settings.workflow.previewShowRomanDesc",
									"Show romanization in the preview.",
								)}
								setting={showRomanLinesAtom}
							/>
						</Grid>
					</RibbonSection>
				)}
				<AdvancedSection />
			</RibbonFrame>
		);
	},
);

export default PreviewModeRibbonBar;
