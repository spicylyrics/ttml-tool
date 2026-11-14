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

import { Flex } from "@radix-ui/themes";
import classNames from "classnames";
import { ToolMode } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { hasNoTiming } from "../../utils/timing-status";
import styles from "../index.module.css";
import { UntimedTimestamp } from "../untimed-timestamp";
import type { LyricLineViewState } from "./use-line-view";

export function LineTimingControls({
	line,
	toolMode,
	showTimestamps,
	showEndTimeAsDuration,
	startTimeRef,
	endTimeRef,
}: Pick<
	LyricLineViewState,
	| "line"
	| "toolMode"
	| "showTimestamps"
	| "showEndTimeAsDuration"
	| "startTimeRef"
	| "endTimeRef"
>) {
	return (
		toolMode === ToolMode.Sync &&
		showTimestamps && (
			<Flex pr="3" gap="1" direction="column" align="stretch">
				<div
					className={classNames(
						styles.startTime,
						hasNoTiming(line) && styles.untimedTimestamp,
					)}
					ref={startTimeRef}
				>
					{hasNoTiming(line) ? (
						<UntimedTimestamp />
					) : (
						msToTimestamp(line.startTime)
					)}
				</div>
				<div
					className={classNames(
						styles.endTime,
						styles.endTimeLabel,
						line.endTime === 0 && styles.untimedTimestamp,
					)}
					ref={endTimeRef}
				>
					<span
						style={{
							display: "inline-flex",
							alignItems: "center",
						}}
					>
						{line.endTime === 0 ? (
							<UntimedTimestamp />
						) : showEndTimeAsDuration ? (
							`+${line.endTime - line.startTime}ms`
						) : (
							msToTimestamp(line.endTime)
						)}
					</span>
				</div>
			</Flex>
		)
	);
}
