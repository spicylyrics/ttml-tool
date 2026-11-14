/*
 * Copyright 2023-2026 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import type { Draft } from "immer";
import type { useStore } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import type { LyricLine, TTMLLyric } from "$/types/ttml.ts";
import styles from "../index.module.css";
import { useFlashOnChange } from "../use-flash-on-change";
import { useSyncWordEditing } from "./use-sync-word-editing";

export const useSyncWordLifecycle = ({
	store,
	startTime,
	endTime,
	highlightActiveWord,
	visualizeTimestampUpdate,
	editLyricLines,
	line,
	wordIndex,
}: {
	store: ReturnType<typeof useStore>;
	startTime: number;
	endTime: number;
	highlightActiveWord: boolean;
	visualizeTimestampUpdate: boolean;
	editLyricLines: (recipe: (state: Draft<TTMLLyric>) => void) => void;
	line: LyricLine;
	wordIndex: number;
}) => {
	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLDivElement>(null);
	const wordContainerRef = useRef<HTMLDivElement>(null);
	const lastClickTimeRef = useRef(0);

	// Keep mutable refs for active-highlight settings to avoid re-subscribing on every settings change
	const highlightActiveWordRef = useRef(highlightActiveWord);

	const activeStateRef = useRef({ active: false });
	const updateActive = useCallback(
		(force = false) => {
			const el = wordContainerRef.current;
			if (!el) return;
			const time = store.get(currentTimeAtom);
			const active =
				highlightActiveWordRef.current && time >= startTime && time < endTime;
			if (force || active !== activeStateRef.current.active)
				el.classList.toggle(styles.active, active);
			activeStateRef.current = { active };
		},
		[store, startTime, endTime],
	);

	useEffect(() => {
		highlightActiveWordRef.current = highlightActiveWord;
		updateActive();
	}, [highlightActiveWord, updateActive]);

	// Re-apply the active class synchronously on every React reconciliation
	// pass so React updating className on the DOM element does not wipe out imperative classes.
	useLayoutEffect(() => {
		updateActive(true);
	});

	// Drive the active/animated classes imperatively via store.sub
	// instead of subscribing to currentTimeAtom inside React (which causes ~60fps
	// re-renders of every visible word).
	useEffect(() => {
		updateActive();
		if (!highlightActiveWord) return;
		return store.sub(currentTimeAtom, updateActive);
	}, [store, updateActive, highlightActiveWord]);

	// Keep editing hooks between active highlighting and timestamp effects, as in the original component.
	const editing = useSyncWordEditing({
		editLyricLines,
		line,
		wordIndex,
	});

	useFlashOnChange(startTimeRef, startTime, visualizeTimestampUpdate);

	useFlashOnChange(endTimeRef, endTime, visualizeTimestampUpdate);
	return {
		startTimeRef,
		endTimeRef,
		wordContainerRef,
		lastClickTimeRef,
		editing,
	};
};
