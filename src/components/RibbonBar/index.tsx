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

import { Card, Inset } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { type CSSProperties, forwardRef, memo } from "react";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { ToolMode, toolModeAtom } from "$/states/main.ts";
import { lazy } from "$/utils/lazy.ts";

const EditModeRibbonBar = lazy(() => import("./edit-mode"));
const SyncModeRibbonBar = lazy(() => import("./sync-mode"));
const PreviewModeRibbonBar = lazy(() => import("./preview-mode"));

export const RibbonBar = memo(
	forwardRef<HTMLDivElement>((_props, ref) => {
		const toolMode = useAtomValue(toolModeAtom);
		const cardStyle: CSSProperties & {
			"--card-background-color": string;
			"--card-border-radius": string;
		} = {
			"--card-background-color":
				"var(--ribbon-bg, var(--titlebar-bg, var(--color-panel-translucent)))",
			// borderRadius alone leaves the Inset and card background rounded.
			"--card-border-radius": "0px",
			minHeight: "fit-content",
			flexShrink: "0",
			borderRadius: 0,
			borderBottom: "1px solid var(--gray-5)",
			backgroundColor:
				"var(--ribbon-bg, var(--titlebar-bg, var(--color-panel-translucent)))",
			backdropFilter: "blur(var(--custom-backdrop-blur, 16px)) saturate(160%)",
			zIndex: 10,
		};

		return (
			<Card data-guide-target="ribbon" style={cardStyle} ref={ref}>
				<Inset>
					<div
						style={{
							height: "100%",
							overflowY: "clip",
							overflowX: "clip",
						}}
					>
						{toolMode === ToolMode.Edit && (
							<SuspensePlaceHolder key="edit">
								<EditModeRibbonBar />
							</SuspensePlaceHolder>
						)}
						{toolMode === ToolMode.Sync && (
							<SuspensePlaceHolder key="sync">
								<SyncModeRibbonBar />
							</SuspensePlaceHolder>
						)}
						{toolMode === ToolMode.Preview && (
							<SuspensePlaceHolder key="preview">
								<PreviewModeRibbonBar />
							</SuspensePlaceHolder>
						)}
					</div>
				</Inset>
			</Card>
		);
	}),
);

export default RibbonBar;
