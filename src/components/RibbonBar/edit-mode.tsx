import { Button, Grid } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";

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

import { ROLE_COLORS, SlIcon } from "$/components/SlIcon";
import { RIBBON_ACTIONS } from "$/modules/menu-actions/ribbon-actions";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import { newLyricLine } from "$/types/ttml";
import { msToTimestamp, parseTimespan } from "$/utils/timestamp.ts";
import { AdvancedSection } from "./AdvancedSection";
import { RibbonFrame, RibbonSection } from "./common";
import { AuxiliaryDisplayField } from "./edit-mode/AuxiliaryDisplayField";
import { PhoneticSection } from "./edit-mode/PhoneticSection";
import { CheckboxField } from "./fields/CheckboxField";
import { EditField } from "./fields/EditField";
import { RibbonActionToggle } from "./RibbonToggle";

export const EditModeRibbonBar = forwardRef<HTMLDivElement>((_props, ref) => {
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const showAdvanced = useAtomValue(advancedRibbonControlsAtom);

	return (
		<RibbonFrame ref={ref} reserveControlRows={3}>
			<RibbonSection label={t("ribbonBar.editMode.new", "新建")}>
				<Grid columns="1" gap="1" gapY="1" flexGrow="1" align="center">
					<ActionTooltip
						label={t("ribbonBar.editMode.lyricLine", "Lyric line")}
						description={t(
							"ribbonBar.tooltips.newLyricLine",
							"Add an empty line at the end of the lyrics.",
						)}
						shortcut={RIBBON_ACTIONS.newLyricLine.command.atom}
					>
						<Button
							size="1"
							variant="soft"
							onClick={() =>
								editLyricLines((draft) => {
									draft.lyricLines.push(newLyricLine());
								})
							}
						>
							{t("ribbonBar.editMode.lyricLine", "Lyric line")}
						</Button>
					</ActionTooltip>
				</Grid>
			</RibbonSection>
			<RibbonSection
				label={t("ribbonBar.editMode.playbackTracking", "Tracking")}
			>
				<Grid
					columns="max-content auto"
					gap="2"
					gapY="1"
					flexGrow="1"
					align="center"
				>
					<RibbonActionToggle
						action={RIBBON_ACTIONS.editAutoScroll}
						description={t(
							"settings.common.syncAutoScrollDesc",
							"Scrolls the editor to follow the line that is playing.",
						)}
					/>
					<RibbonActionToggle
						action={RIBBON_ACTIONS.editHighlightLine}
						description={t(
							"settings.common.highlightActiveLineDesc",
							"Highlights the line that is playing in the selected mode.",
						)}
					/>
				</Grid>
			</RibbonSection>
			{selectedLines.size > 0 && (
				<RibbonSection
					label={t("ribbonBar.editMode.lineTiming", "Line timing")}
				>
					<Grid
						columns="max-content 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EditField
							label={t("ribbonBar.editMode.startTime", "起始时间")}
							fieldName="startTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "结束时间")}
							fieldName="endTime"
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
					</Grid>
				</RibbonSection>
			)}
			{selectedLines.size > 0 && (
				<RibbonSection
					label={t("ribbonBar.editMode.lineProperties", "Line properties")}
				>
					<Grid
						columns="max-content max-content"
						gap="4"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<CheckboxField
							label={t("ribbonBar.editMode.bgLyric", "Background vocal")}
							description={t(
								"ribbonBar.tooltips.bgLyric",
								"Mark the selected lines as background vocals.",
							)}
							defaultValue={false}
							isWordField={false}
							fieldName="isBG"
							icon={<SlIcon name="background" color={ROLE_COLORS.background} />}
							shortcut={RIBBON_ACTIONS.lineBackground.command.atom}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.duetLyric", "Duet vocal")}
							description={t(
								"ribbonBar.tooltips.duetLyric",
								"Mark the selected lines as sung by the second singer.",
							)}
							isWordField={false}
							fieldName="isDuet"
							defaultValue={false}
							icon={<SlIcon name="duet" color={ROLE_COLORS.duet} />}
							shortcut={RIBBON_ACTIONS.lineDuet.command.atom}
						/>
						<CheckboxField
							label={t("ribbonBar.editMode.ignoreSync", "Skip when syncing")}
							description={t(
								"ribbonBar.tooltips.ignoreSync",
								"Sync keys jump past the selected lines, so you don't time them.",
							)}
							isWordField={false}
							fieldName="ignoreSync"
							defaultValue={false}
							shortcut={RIBBON_ACTIONS.lineIgnoreSync.command.atom}
						/>
					</Grid>
				</RibbonSection>
			)}
			{showAdvanced && (selectedLines.size > 0 || selectedWords.size > 0) && (
				<PhoneticSection />
			)}
			{selectedWords.size > 0 && (
				<RibbonSection
					label={t("ribbonBar.editMode.wordTiming", "Word timing")}
				>
					<Grid
						columns="max-content 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EditField
							label={t("ribbonBar.editMode.startTime", "起始时间")}
							fieldName="startTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
						<EditField
							label={t("ribbonBar.editMode.endTime", "结束时间")}
							fieldName="endTime"
							isWordField
							parser={parseTimespan}
							formatter={msToTimestamp}
						/>
					</Grid>
				</RibbonSection>
			)}
			{selectedWords.size > 0 && (
				<RibbonSection
					label={t("ribbonBar.editMode.wordProperties", "Word properties")}
				>
					<Grid
						columns="max-content 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EditField
							label={t("ribbonBar.editMode.wordContent", "Word content")}
							fieldName="word"
							isWordField
							parser={(v) => v}
							formatter={(v) => v}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanWord", "Word romanization")}
							fieldName="romanWord"
							isWordField
							parser={(v) => v}
							formatter={(v) => v || ""}
						/>
					</Grid>
				</RibbonSection>
			)}
			{showAdvanced && selectedLines.size > 0 && (
				<RibbonSection
					label={t("ribbonBar.editMode.secondaryContent", "Secondary content")}
				>
					<Grid
						columns="max-content 1fr"
						gap="2"
						gapY="1"
						flexGrow="1"
						align="center"
					>
						<EditField
							label={t("ribbonBar.editMode.translatedLyric", "翻译歌词")}
							fieldName="translatedLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "15em" }}
						/>
						<EditField
							label={t("ribbonBar.editMode.romanLyric", "音译歌词")}
							fieldName="romanLyric"
							parser={(v) => v}
							formatter={(v) => v}
							textFieldStyle={{ width: "15em" }}
						/>
					</Grid>
				</RibbonSection>
			)}
			{showAdvanced && (
				<RibbonSection
					label={t(
						"ribbonBar.editMode.auxiliaryLineDisplay",
						"Auxiliary line display",
					)}
				>
					<AuxiliaryDisplayField />
				</RibbonSection>
			)}
			<AdvancedSection />
		</RibbonFrame>
	);
});

export default EditModeRibbonBar;
