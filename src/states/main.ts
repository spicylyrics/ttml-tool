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

import { type Atom, atom } from "jotai";
import { atomWithStorage, selectAtom } from "jotai/utils";
import { REDO, RESET, UNDO, withHistory } from "jotai-history";
import { uid } from "uid";
import {
	migrateLegacySections,
	repairSectionIntegrity,
} from "$/modules/lyric-editor/utils/section-system";
import { normalizeDocumentWords } from "$/modules/project/logic/normalize-document";
import { identifyProject } from "$/modules/project/logic/project-info";
import type { TTMLLyric } from "../types/ttml";

export enum ToolMode {
	Edit = "edit",
	Sync = "sync",
	Preview = "preview",
}

export const toolModeAtom = atom<ToolMode>(ToolMode.Edit);
export const previousToolModeAtom = atom<ToolMode | null>(null);

export const showPreviewPanelAtom = atomWithStorage("showPreviewPanel", false);
export const previewPanelWidthAtom = atomWithStorage("previewPanelWidth", 400);

export const autoDarkModeAtom = atom(true);
export const isDarkThemeAtom = autoDarkModeAtom;

export const lyricLinesAtom = atom({
	lyricLines: [],
	metadata: [],
	marks: [],
	sections: [],
} as TTMLLyric);

/** Keeps its identity through word and line edits, unlike the whole document. */
export const lyricMetadataAtom = atom((get) => get(lyricLinesAtom).metadata);

const setsEqual = (a: Set<string>, b: Set<string>) => {
	if (a.size !== b.size) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
};

export const allLyricsWordsAtom: Atom<Set<string>> = selectAtom(
	lyricLinesAtom,
	(lyrics) => {
		const words = new Set<string>();
		for (const line of lyrics.lyricLines) {
			for (const wordObj of line.words) {
				const cleaned = wordObj.word
					.trim()
					.toLowerCase()
					.replace(/[^a-z']/g, "");
				if (cleaned) words.add(cleaned);
			}
		}
		return words;
	},
	setsEqual,
);

/**
 * @description 当前项目的唯一标识符
 *
 * - 打开应用和新建文件时会生成一个随机的 UUID
 * - 打开文件时会尝试与数据库中的历史项目进行匹配，如果匹配成功，则复用旧项目的 ID，否则生成新 ID
 */
export const projectIdAtom = atom(uid());

/**
 * @description 当前项目的显示身份信息，主要用于在 UI 上显示项目名称
 * @readonly
 */
export const projectIdentityAtom = atom((get) => {
	return identifyProject({ metadata: get(lyricMetadataAtom) });
});

/**
 * @description 自动保存的状态
 */
export enum SaveStatus {
	/**
	 * @description 已保存，当前编辑器的内容和数据库的一致
	 */
	Saved = "saved",
	/**
	 * @description 等待保存
	 */
	Pending = "pending",
	/**
	 * @description 正在保存
	 */
	Saving = "saving",
}

/**
 * @description 当前自动保存的状态
 */
export const saveStatusAtom = atom<SaveStatus>(SaveStatus.Saved);

/**
 * @description 上次自动保存的时间戳
 */
export const lastSavedTimeAtom = atom<number | null>(null);

export const undoableLyricLinesAtom = withHistory(lyricLinesAtom, 10);
// The history object changes on every edit; menus only need these flags.
export const canUndoLyricLinesAtom = atom(
	(get) => get(undoableLyricLinesAtom).canUndo,
);
export const canRedoLyricLinesAtom = atom(
	(get) => get(undoableLyricLinesAtom).canRedo,
);
/**
 * The exact lyric snapshot that was last saved or opened, or null before any
 * document baseline exists. Edits always replace the lyric object, so identity
 * tells us whether the editor still holds what was saved.
 */
export const savedLyricLinesAtom = atom<TTMLLyric | null>(null);
export const isDirtyAtom = atom((get) => {
	// An empty editor has no lyrics for Open/Import to discard. Audio and the
	// suggested filename are separate state and survive an online import.
	if (get(lyricLinesAtom).lyricLines.length === 0) return false;
	const saved = get(savedLyricLinesAtom);
	if (saved === null) return get(undoableLyricLinesAtom).canUndo;
	return get(lyricLinesAtom) !== saved;
});
/** Marks `snapshot` as saved while keeping undo history intact. */
export const markLyricsSavedAtom = atom(
	null,
	(_get, set, snapshot: TTMLLyric) => {
		set(savedLyricLinesAtom, snapshot);
	},
);
/** Starts a fresh document: clears undo history and marks the current lyric clean. */
export const startFreshLyricDocumentAtom = atom(null, (get, set) => {
	set(undoableLyricLinesAtom, RESET);
	set(savedLyricLinesAtom, get(lyricLinesAtom));
});
export const undoLyricLinesAtom = atom(null, (_get, set) => {
	set(undoableLyricLinesAtom, UNDO);
});
export const redoLyricLinesAtom = atom(null, (_get, set) => {
	set(undoableLyricLinesAtom, REDO);
});
export const editingWordStateAtom = atom({
	wordIndex: -1,
	lineIndex: -1,
	word: "",
});
export const newLyricLinesAtom = atom(
	null,
	(
		_get,
		set,
		newState: TTMLLyric = {
			lyricLines: [],
			metadata: [],
			marks: [],
			sections: [],
		},
	) => {
		newState = normalizeDocumentWords(newState);
		if (!newState.marks) newState.marks = [];
		migrateLegacySections(newState);
		repairSectionIntegrity(newState);
		set(lyricLinesAtom, newState);
		set(selectedLinesAtom, new Set());
		set(selectedWordsAtom, new Set());
	},
);
export const selectedLinesAtom = atom(new Set<string>());
export const selectedWordsAtom = atom(new Set<string>());
export const collapsedSectionIdsAtom = atom(new Set<string>());

export const saveFileNameAtom = atom("lyric.ttml");

export const showUnselectedLinesAtom = atomWithStorage(
	"showUnselectedLines",
	true,
);
export const showEndTimeAsDurationAtom = atom(false);

export interface EditingTimeFieldState {
	isWord: boolean;
	field: "startTime" | "endTime";
}

export const editingTimeFieldAtom = atom<EditingTimeFieldState | null>(null);

export const requestFocusAtom = atom<string | null>(null);

export const isGlobalFileDraggingAtom = atom(false);
