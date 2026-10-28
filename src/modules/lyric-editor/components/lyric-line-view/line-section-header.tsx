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

import { Button, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { toast } from "react-toastify";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { lyricLinesAtom, ToolMode } from "$/states/main.ts";
import { sectionEditingEnabledAtom } from "../../states/section-editing.ts";
import {
	copySectionTimings,
	findPreviousMatchingSection,
	shiftSectionToTime,
} from "../../utils/genius-sections.ts";
import { applyTimingsSectionIdAtom } from "../ApplySectionTimingsDialog.tsx";
import { editingSectionIdAtom, SectionActions } from "../SectionActions.tsx";
import { SectionHeaderMenu } from "../SectionHeaderMenu.tsx";
import styles from "./line-section-header.module.css";
import type { LyricLineViewState } from "./use-line-view";

export function LineSectionHeader({
	lineIndex,
	t,
	toolMode,
	editLyricLines,
	store,
	activeSection,
	sectionActionsEnabled,
	activeGeniusHeader,
	customHeaderColor,
	isSectionStart,
	categoryColor,
}: Pick<
	LyricLineViewState,
	| "lineIndex"
	| "t"
	| "toolMode"
	| "editLyricLines"
	| "store"
	| "activeSection"
	| "sectionActionsEnabled"
	| "activeGeniusHeader"
	| "customHeaderColor"
	| "isSectionStart"
	| "categoryColor"
>) {
	const sectionEditingEnabled = useAtomValue(sectionEditingEnabledAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const setApplyTimingsSectionId = useSetAtom(applyTimingsSectionIdAtom);
	// With the section editing tools on, the header itself opens rename/retype
	// in Edit mode, and Apply timings from... replaces Copy previous timing.
	const editable =
		sectionEditingEnabled && sectionActionsEnabled && !!activeSection;
	const headerText = (
		<Text
			size="1"
			weight="bold"
			color={
				customHeaderColor || categoryColor === "accent"
					? undefined
					: categoryColor
			}
			style={{
				opacity: 0.8,
				textTransform: "uppercase",
				color: customHeaderColor || undefined,
			}}
		>
			{activeGeniusHeader}
		</Text>
	);
	return (
		isSectionStart && (
			<Flex gap="2" mb="1" align="center">
				{editable && activeSection && toolMode === ToolMode.Edit ? (
					<button
						type="button"
						className={styles.sectionHeaderButton}
						aria-label={t("sectionEditing.editHeader", {
							label: activeSection.label,
						})}
						title={t("sectionEditing.editHeader", {
							label: activeSection.label,
						})}
						onClick={(e) => {
							e.stopPropagation();
							setEditingSectionId(activeSection.id);
						}}
					>
						{headerText}
					</button>
				) : (
					headerText
				)}
				{sectionActionsEnabled && activeSection && (
					<SectionActions section={activeSection} />
				)}
				{editable && activeSection && (
					<SectionHeaderMenu section={activeSection} />
				)}
				{toolMode === ToolMode.Sync && editable && activeSection && (
					<Button
						size="1"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							setApplyTimingsSectionId(activeSection.id);
						}}
					>
						{t("sectionEditing.applyTimings", "Apply timings from...")}
					</Button>
				)}
				{toolMode === ToolMode.Sync && (
					<Button
						size="1"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							const currentTime = store.get(currentTimeAtom);
							editLyricLines((state) => {
								shiftSectionToTime(state.lyricLines, lineIndex, currentTime);
							});
						}}
					>
						{t(
							"experimentalFeatures.geniusCategorization.snapToPlayhead",
							"Snap to playhead",
						)}
					</Button>
				)}
				{toolMode === ToolMode.Sync && !editable && (
					<Button
						size="1"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							const lyricLines = store.get(lyricLinesAtom).lyricLines;
							const previousSection = findPreviousMatchingSection(
								lyricLines,
								lineIndex,
								store.get(lyricLinesAtom).sections,
							);

							if (previousSection) {
								let copyResult: ReturnType<typeof copySectionTimings>;
								editLyricLines((state) => {
									copyResult = copySectionTimings(
										state.lyricLines,
										lineIndex,
										previousSection,
									);
								});
								if (!copyResult?.copiedLineCount) {
									toast.info(
										t(
											"experimentalFeatures.geniusCategorization.noMatchingLines",
											"No lines in this section match the earlier one, so nothing was copied.",
										),
									);
									return;
								}
								toast.success(t("common.success", "Restored"));
								if (!copyResult.lengthsMatch) {
									toast.info(
										"Section lengths differ; copied matching lines only.",
									);
								}
							} else {
								toast.info(
									t(
										"experimentalFeatures.geniusCategorization.noPreviousFound",
										"No earlier matching section with timing found.",
									),
								);
							}
						}}
					>
						{t(
							"experimentalFeatures.geniusCategorization.copyPrevious",
							"Copy previous timing",
						)}
					</Button>
				)}
			</Flex>
		)
	);
}
