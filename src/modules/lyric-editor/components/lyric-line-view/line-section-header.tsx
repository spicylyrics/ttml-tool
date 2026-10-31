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
import { useSetAtom } from "jotai";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { ToolMode } from "$/states/main.ts";
import { shiftSectionToTime } from "../../utils/genius-sections.ts";
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
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const setApplyTimingsSectionId = useSetAtom(applyTimingsSectionIdAtom);
	// A real section (not just a Genius header line) gets the editing tools:
	// the header opens rename/retype in Edit mode, plus the "..." menu.
	const section = sectionActionsEnabled ? activeSection : undefined;
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
			<Flex
				gap="2"
				mb="1"
				align="center"
				// Keeps the line's drag handler from capturing the pointer, which
				// would swallow clicks on the header's buttons.
				data-lyric-line-interactive={section ? "" : undefined}
			>
				{section && toolMode === ToolMode.Edit ? (
					<button
						type="button"
						className={styles.sectionHeaderButton}
						aria-label={t("sectionEditing.editHeader", {
							label: section.label,
						})}
						title={t("sectionEditing.editHeader", {
							label: section.label,
						})}
						onClick={(e) => {
							e.stopPropagation();
							setEditingSectionId(section.id);
						}}
					>
						{headerText}
					</button>
				) : (
					headerText
				)}
				{section && <SectionActions section={section} />}
				{section && <SectionHeaderMenu section={section} />}
				{toolMode === ToolMode.Sync && section && (
					<Button
						size="1"
						variant="ghost"
						onClick={(e) => {
							e.stopPropagation();
							setApplyTimingsSectionId(section.id);
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
			</Flex>
		)
	);
}
