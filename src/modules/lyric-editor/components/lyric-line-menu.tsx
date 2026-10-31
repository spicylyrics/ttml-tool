import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { MenuIconRow } from "$/components/MenuIconRow";
import { ROLE_COLORS, SlIcon } from "$/components/SlIcon";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";

import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { insertLinesInSection } from "../utils/section-system";
import { swapDuetLinesAtom } from "../utils/swap-duet";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);

/** Background, duet and swap for the selected lines. Edit and Time mode both show it. */
export const LineRoleMenuRow = ({ lineIndex }: { lineIndex: number }) => {
	const { t } = useTranslation();
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const swapDuetLines = useSetAtom(swapDuetLinesAtom);

	const lineObjs = useAtomValue(lyricLinesAtom);
	const selectedLineObjs = lineObjs.lyricLines.filter((line) =>
		selectedLines.has(line.id),
	);
	const [Bgchecked, setBgChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isBG)) return true;
		else if (selectedLineObjs.every((line) => !line.isBG)) return false;
		else return "indeterminate" as const;
	});
	const [DuetChecked, setDuetChecked] = React.useState(() => {
		if (selectedLineObjs.every((line) => line.isDuet)) return true;
		else if (selectedLineObjs.every((line) => !line.isDuet)) return false;
		else return "indeterminate" as const;
	});

	function bgOnCheck(checked: boolean) {
		setBgChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isBG = checked;
		});
	}
	function duetOnCheck(checked: boolean) {
		setDuetChecked(checked);
		editLyricLines((state) => {
			const lines = state.lyricLines.filter((line) =>
				selectedLines.has(line.id),
			);
			for (const line of lines) line.isDuet = checked;
		});
	}

	return (
		<MenuIconRow label={t("contextMenu.lineRole", "Line role")}>
			<MenuIconRow.Track>
				<MenuIconRow.Toggle
					icon={<SlIcon name="background" />}
					label={t("contextMenu.bgLyric", "背景歌词")}
					checked={Bgchecked}
					onCheckedChange={bgOnCheck}
					color={ROLE_COLORS.background}
				/>
				<MenuIconRow.Toggle
					icon={<SlIcon name="duet" />}
					label={t("contextMenu.duetLyric", "对唱歌词")}
					checked={DuetChecked}
					onCheckedChange={duetOnCheck}
					color={ROLE_COLORS.duet}
				/>
			</MenuIconRow.Track>
			<MenuIconRow.Action
				icon={<SlIcon name="swapDuet" />}
				label={t("editModeTools.swapDuetSelected", "Swap main and duet")}
				onSelect={() => {
					const lineId = lineObjs.lyricLines[lineIndex]?.id;
					swapDuetLines(
						selectedLinesSize > 0
							? selectedLines
							: new Set(lineId ? [lineId] : []),
					);
				}}
			/>
		</MenuIconRow>
	);
};

export const LyricLineMenu = ({ lineIndex }: { lineIndex: number }) => {
	const { t } = useTranslation();
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);

	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const lineObjs = useAtomValue(lyricLinesAtom);
	const combineEnabled = (() => {
		if (selectedLinesSize < 2) return null;
		const lineIdxs = lineObjs.lyricLines
			.filter((line) => selectedLines.has(line.id))
			.map((line) => lineObjs.lyricLines.indexOf(line));
		const minIdx = Math.min(...lineIdxs);
		const maxIdx = Math.max(...lineIdxs);
		if (lineIdxs.length !== maxIdx - minIdx + 1) return null;
		for (let i = minIdx; i <= maxIdx; i++)
			if (!lineIdxs.includes(i)) return null;
		return { minIdx, maxIdx };
	})();

	return (
		<>
			<LineRoleMenuRow lineIndex={lineIndex} />
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						insertLinesInSection(
							state,
							lineIndex,
							[newLyricLine()],
							state.lyricLines[lineIndex]?.sectionId,
						);
					});
				}}
			>
				{t("contextMenu.insertLineBefore", "在前插入空行")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						insertLinesInSection(
							state,
							lineIndex + 1,
							[newLyricLine()],
							state.lyricLines[lineIndex]?.sectionId,
						);
					});
				}}
			>
				{t("contextMenu.insertLineAfter", "在后插入空行")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={copyLines} disabled={selectedLinesSize === 0}>
				{t("contextMenu.copyLine", {
					count: selectedLinesSize,
					defaultValue: "复制行",
				})}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					setTimingCopyPlacement(null);
					setGlobalEnableInsert(true);
				}}
				disabled={selectedLinesSize === 0}
			>
				{t("contextMenu.duplicateTo", "Duplicate to…")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={combineLines} disabled={!combineEnabled}>
				{t("contextMenu.combineLine", "合并行")}
			</ContextMenu.Item>
			<ContextMenu.Item
				onSelect={() => {
					editLyricLines((state) => {
						if (selectedLinesSize === 0) {
							state.lyricLines.splice(lineIndex, 1);
						} else {
							state.lyricLines = state.lyricLines.filter(
								(line) => !selectedLines.has(line.id),
							);
						}
					});
				}}
			>
				{t("contextMenu.deleteLine", {
					count: selectedLinesSize,
					defaultValue: "删除行",
				})}
			</ContextMenu.Item>
		</>
	);

	function combineLines() {
		editLyricLines((state) => {
			if (!combineEnabled) return;
			const { minIdx, maxIdx } = combineEnabled;
			const target = state.lyricLines[minIdx];
			for (let i = minIdx + 1; i <= maxIdx; i++) {
				const line = state.lyricLines[i];
				target.words.push(...line.words);
			}
			target.endTime = state.lyricLines[maxIdx].endTime;
			state.lyricLines.splice(minIdx + 1, maxIdx - minIdx);
		});
	}

	function copyLines() {
		editLyricLines((state) => {
			state.lyricLines = state.lyricLines.flatMap((line) => {
				if (!selectedLines.has(line.id)) return line;
				const newLine: LyricLine = {
					...line,
					id: newLyricLine().id,
					words: line.words.map((word) => ({
						...word,
						id: newLyricWord().id,
					})),
				};
				return [line, newLine];
			});
		});
	}
};
