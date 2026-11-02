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

import { Button, Flex, Text, TextField } from "@radix-ui/themes";
import { type Atom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	memo,
	type SyntheticEvent,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { SlIcon } from "$/components/SlIcon";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import styles from "../index.module.css";

export const SubLineEdit = memo(
	({
		lineAtom,
		lineIndex,
		type,
	}: {
		lineAtom: Atom<LyricLine>;
		lineIndex: number;
		type: "translatedLyric" | "romanLyric";
	}) => {
		const editLyricLines = useSetImmerAtom(lyricLinesAtom);
		const line = useAtomValue(lineAtom);
		const [editing, setEditing] = useState(false);
		const [inputValue, setInputValue] = useState("");
		const { t } = useTranslation();

		const onEnter = useCallback(
			(evt: SyntheticEvent<HTMLInputElement>) => {
				setEditing(false);
				const newValue = evt.currentTarget.value;
				if (newValue !== line[type]) {
					editLyricLines((state) => {
						state.lyricLines[lineIndex][type] = newValue;
					});
				}
			},
			[editLyricLines, line, lineIndex, type],
		);

		useEffect(() => {
			if (editing) {
				setInputValue(line[type] || "");
			}
		}, [editing, line, type]);

		const inputWidth = useMemo(() => {
			if (inputValue.length > 0) {
				return `${Math.min(Math.max(inputValue.length, 2), 60)}ch`;
			}
			return "12ch";
		}, [inputValue]);

		const label = useMemo(
			() =>
				type === "translatedLyric"
					? t("lyricLineView.translatedLabel", "翻译：")
					: t("lyricLineView.romanLabel", "音译："),
			[type, t],
		);

		return (
			<Flex
				align="baseline"
				style={{
					color:
						type === "translatedLyric"
							? "var(--translation-color, inherit)"
							: "var(--romanization-color, inherit)",
				}}
			>
				<SlIcon
					name={type === "translatedLyric" ? "translation" : "romanization"}
					className={styles.subLineIcon}
				/>
				<Text size="2" style={{ color: "inherit" }}>
					{label}
				</Text>
				{editing ? (
					<TextField.Root
						autoFocus
						size="1"
						data-lyric-line-interactive=""
						value={inputValue}
						style={{ width: inputWidth }}
						onChange={(evt) => setInputValue(evt.currentTarget.value)}
						onBlur={onEnter}
						onKeyDown={(evt) => {
							if (evt.key === "Enter") onEnter(evt);
						}}
					/>
				) : (
					<Button
						size="2"
						variant="ghost"
						data-lyric-line-interactive=""
						style={{ color: "inherit" }}
						onClick={(evt) => {
							evt.stopPropagation();
							setEditing(true);
						}}
					>
						{line[type] || (
							<Text color="gray">{t("lyricLineView.empty", "无")}</Text>
						)}
					</Button>
				)}
			</Flex>
		);
	},
);
