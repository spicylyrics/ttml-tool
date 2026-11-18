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

import { Button } from "@radix-ui/themes";
import { toast } from "react-toastify";
import { lyricLinesAtom } from "$/states/main.ts";
import {
	type ApplyLineTimingsResult,
	applyLineTimingSnapshots,
} from "../../utils/line-timing.ts";
import type { LyricLineViewState } from "./use-line-view";

export function LineTimingPlacement({
	lineIndex,
	t,
	editLyricLines,
	store,
	timingCopyPlacement,
	setTimingCopyPlacement,
}: Pick<
	LyricLineViewState,
	| "lineIndex"
	| "t"
	| "editLyricLines"
	| "store"
	| "timingCopyPlacement"
	| "setTimingCopyPlacement"
>) {
	return (
		timingCopyPlacement && (
			<Button
				mx="1"
				my="1"
				variant="soft"
				size="1"
				style={{ width: "calc(100% - var(--space-4))" }}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					let result: ApplyLineTimingsResult | undefined;
					editLyricLines((state) => {
						result = applyLineTimingSnapshots(
							state.lyricLines,
							lineIndex,
							timingCopyPlacement.snapshots,
						);
					});
					setTimingCopyPlacement(null);

					if (!result || result.appliedLineCount === 0) return;
					toast.success(
						t("lyricLineView.timingsApplied", {
							count: result.appliedLineCount,
							defaultValue:
								"{count, plural, one {Applied timing to # line.} other {Applied timing to # lines.}}",
						}),
					);
					const warnings: string[] = [];
					if (result.partial) {
						warnings.push(
							t("lyricLineView.partialTimingCopy", {
								applied: result.appliedLineCount,
								total: timingCopyPlacement.snapshots.length,
								defaultValue:
									"Only {applied} of {total} source timings fit before the end of the lyrics.",
							}),
						);
					}
					if (result.usedOriginalTimes) {
						warnings.push(
							t(
								"lyricLineView.timingCopyOriginalTimes",
								"Nothing above is timed, so the copied lines kept their original times.",
							),
						);
					}
					if (result.wordCountMismatchCount > 0) {
						warnings.push(
							t("lyricLineView.wordTimingMismatch", {
								count: result.wordCountMismatchCount,
								defaultValue:
									"{count, plural, one {# line had a different word count, so only matching word positions were copied.} other {# lines had different word counts, so only matching word positions were copied.}}",
							}),
						);
					}
					if (warnings.length > 0) toast.info(warnings.join(" "));
				}}
			>
				{Math.min(
					timingCopyPlacement.snapshots.length,
					store.get(lyricLinesAtom).lyricLines.length - lineIndex,
				) < timingCopyPlacement.snapshots.length
					? t("lyricLineView.applyPartialTimingsHere", {
							applied: Math.min(
								timingCopyPlacement.snapshots.length,
								store.get(lyricLinesAtom).lyricLines.length - lineIndex,
							),
							total: timingCopyPlacement.snapshots.length,
							defaultValue: "Apply {applied} of {total} timings starting here",
						})
					: t("lyricLineView.applyTimingsHere", {
							count: timingCopyPlacement.snapshots.length,
							defaultValue:
								"{count, plural, one {Apply # timing starting here} other {Apply # timings starting here}}",
						})}
			</Button>
		)
	);
}
