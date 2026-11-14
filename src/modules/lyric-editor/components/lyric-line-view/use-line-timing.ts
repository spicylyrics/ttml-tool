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

import { useEffect, useLayoutEffect } from "react";
import { ToolMode } from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";

export function useLineTiming({
	line,
	visualizeTimestampUpdate,
	startTimeRef,
	endTimeRef,
	toolMode,
	disableInsert,
}: {
	line: LyricLine;
	visualizeTimestampUpdate: boolean;
	startTimeRef: React.RefObject<HTMLDivElement | null>;
	endTimeRef: React.RefObject<HTMLDivElement | null>;
	toolMode: ToolMode;
	disableInsert: () => void;
}) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = startTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--accent-a8)",
				},
				{
					backgroundColor: "var(--accent-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [line.startTime, visualizeTimestampUpdate]);

	useLayoutEffect(() => {
		if (toolMode !== ToolMode.Edit) {
			disableInsert();
		}
	}, [toolMode, disableInsert]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: 用于呈现时间戳更新效果
	useEffect(() => {
		if (!visualizeTimestampUpdate) return;
		const animation = endTimeRef.current?.animate(
			[
				{
					backgroundColor: "var(--accent-a8)",
				},
				{
					backgroundColor: "var(--accent-a4)",
				},
			],
			{
				duration: 500,
			},
		);

		return () => {
			animation?.cancel();
		};
	}, [line.endTime, visualizeTimestampUpdate]);
}
