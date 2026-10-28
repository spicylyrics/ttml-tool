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

import { ContextMenu } from "@radix-ui/themes";
import { TimeModeWordMenuItems } from "$/modules/time-mode-editing/TimeModeWordMenuItems.tsx";
import { ToolMode } from "$/states/main.ts";
import { LineTimingMenuItems } from "../line-timing-menu.tsx";
import { LyricLineMenu } from "../lyric-line-menu.tsx";
import {
	CategorizeSelectionContextMenuItem,
	SectionContextMenuItems,
	SectionContextMenuSub,
	UnassignedSectionContextMenuItems,
} from "../SectionActions.tsx";
import type { LyricLineViewState } from "./use-line-view";

export function LineContextMenu({
	lineIndex,
	toolMode,
	activeSection,
	sectionActionsEnabled,
	manualCategorizationEnabled,
}: Pick<
	LyricLineViewState,
	| "lineIndex"
	| "toolMode"
	| "activeSection"
	| "sectionActionsEnabled"
	| "manualCategorizationEnabled"
>) {
	return (
		<ContextMenu.Content>
			{toolMode === ToolMode.Sync && (
				<TimeModeWordMenuItems lineIndex={lineIndex} />
			)}
			<LineTimingMenuItems />
			{(toolMode === ToolMode.Edit ||
				sectionActionsEnabled ||
				manualCategorizationEnabled) && <ContextMenu.Separator />}
			{manualCategorizationEnabled &&
				(toolMode === ToolMode.Edit || toolMode === ToolMode.Sync) && (
					<CategorizeSelectionContextMenuItem />
				)}
			{manualCategorizationEnabled && toolMode === ToolMode.Edit && (
				<ContextMenu.Separator />
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Sync && (
				<SectionContextMenuItems
					section={activeSection}
					lineIndex={lineIndex}
				/>
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Edit && (
				<SectionContextMenuSub section={activeSection} lineIndex={lineIndex} />
			)}
			{manualCategorizationEnabled && toolMode === ToolMode.Edit && (
				<UnassignedSectionContextMenuItems lineIndex={lineIndex} />
			)}
			{sectionActionsEnabled && activeSection && toolMode === ToolMode.Edit && (
				<ContextMenu.Separator />
			)}
			{toolMode === ToolMode.Edit && <LyricLineMenu lineIndex={lineIndex} />}
		</ContextMenu.Content>
	);
}
