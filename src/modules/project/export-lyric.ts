import {
	type LyricLine,
	stringifyEslrc,
	stringifyLrc,
	stringifyLys,
	stringifyQrc,
	stringifyYrc,
} from "@applemusic-like-lyrics/lyric";
import type { createStore } from "jotai";
import { lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { normalizeLyricText } from "$/utils/apostrophe-normalization";
import { saveFile } from "$/utils/fileSystem.ts";
import { error } from "$/utils/logging.ts";
import { stringifyAss } from "$/utils/stringify-ass.ts";

type Store = ReturnType<typeof createStore>;
type Translate = (key: string, fallback: string) => string;

/** The non-TTML formats under File > Export lyrics, by file extension. */
export const LYRIC_EXPORTERS = {
	lrc: stringifyLrc,
	eslrc: stringifyEslrc,
	qrc: stringifyQrc,
	yrc: stringifyYrc,
	lys: stringifyLys,
	ass: stringifyAss,
} satisfies Record<string, (lines: LyricLine[]) => string>;

export type LyricExportFormat = keyof typeof LYRIC_EXPORTERS;

export async function exportLyric(
	store: Store,
	t: Translate,
	extension: LyricExportFormat,
) {
	const lyricState = normalizeLyricText(
		store.get(lyricLinesAtom),
		store.get(lyricTextNormalizationOptionsAtom),
	);
	const lyric = lyricState.lyricLines;
	const metadata = lyricState.metadata;

	const songwriter = metadata.find((m) => m.key === "songwriter");
	if (!songwriter || songwriter.value.every((v) => !v.trim())) {
		const confirm = window.confirm(
			t(
				"confirmDialog.noSongwriter.description",
				"This song has no songwriters. Save anyway?",
			),
		);
		if (!confirm) return;
	}

	const lyricForExport = lyric.map((line) => ({
		...line,
		startTime: Math.round(line.startTime),
		endTime: Math.round(line.endTime),
		words: line.words.map((word) => ({
			...word,
			startTime: Math.round(word.startTime),
			endTime: Math.round(word.endTime),
		})),
	}));
	const saveFileName = store.get(saveFileNameAtom);
	const baseName = saveFileName.replace(/\.[^.]*$/, "");
	const fileName = `${baseName}.${extension}`;
	try {
		const data = LYRIC_EXPORTERS[extension](lyricForExport);
		await saveFile(data, {
			suggestedName: fileName,
			types: [
				{
					description: `${extension.toUpperCase()} Files`,
					accept: { "text/plain": [`.${extension}`] },
				},
			],
		});
	} catch (e) {
		error(`Failed to export lyric with format "${extension}"`, e);
	}
}
