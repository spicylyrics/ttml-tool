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
import { LineRoleMenuRow, LyricLineMenu } from "../lyric-line-menu.tsx";
import { StartSectionHereItem } from "../SectionActions.tsx";
import type { LyricLineViewState } from "./use-line-view";

// Section tools live on the section's divider, not here. The only one left is
// Start section here, which needs a line to start at.
export function LineContextMenu({
	lineIndex,
	toolMode,
}: Pick<LyricLineViewState, "lineIndex" | "toolMode">) {
	return (
		<ContextMenu.Content>
			{toolMode === ToolMode.Sync && (
				<TimeModeWordMenuItems lineIndex={lineIndex} />
			)}
			<LineTimingMenuItems />
			<ContextMenu.Separator />
			{toolMode === ToolMode.Edit && (
				<>
					<StartSectionHereItem lineIndex={lineIndex} />
					<ContextMenu.Separator />
					<LyricLineMenu lineIndex={lineIndex} />
				</>
			)}
			{toolMode === ToolMode.Sync && <LineRoleMenuRow lineIndex={lineIndex} />}
		</ContextMenu.Content>
	);
}
