import {
	type LyricLine,
	stringifyEslrc,
	stringifyLrc,
	stringifyLys,
	stringifyQrc,
	stringifyYrc,
} from "@applemusic-like-lyrics/lyric";
import { DropdownMenu } from "@radix-ui/themes";
import { useSetAtom, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import { importLyricsDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main.ts";
import { normalizeLyricText } from "$/utils/apostrophe-normalization";
import { saveFile } from "$/utils/fileSystem.ts";
import { error } from "$/utils/logging.ts";
import { stringifyAss } from "$/utils/stringify-ass.ts";

export const ImportExportLyric = ({
	onSaveTtml,
}: {
	onSaveTtml: () => void | Promise<void>;
}) => {
	const store = useStore();
	const setImportLyricsDialog = useSetAtom(importLyricsDialogAtom);
	const { t } = useTranslation();
	const onExportLyric =
		(stringifier: (lines: LyricLine[]) => string, extension: string) =>
		async () => {
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
				const data = stringifier(lyricForExport);
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
		};

	return (
		<>
			<DropdownMenu.Item onSelect={() => setImportLyricsDialog(true)}>
				{t("topBar.menu.importLyric.import", "Import lyrics...")}
			</DropdownMenu.Item>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.exportLyric.export", "导出歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={onSaveTtml}>
						{t("topBar.menu.exportLyric.toTTML", "TTML")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLrc, "lrc")}>
						{t("topBar.menu.exportLyric.toLRC", "LRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyEslrc, "eslrc")}>
						{t("topBar.menu.exportLyric.toESLRC", "ESLRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyQrc, "qrc")}>
						{t("topBar.menu.exportLyric.toQRC", "QRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyYrc, "yrc")}>
						{t("topBar.menu.exportLyric.toYRC", "YRC")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyLys, "lys")}>
						{t("topBar.menu.exportLyric.toLrcfySylb", "Lyricify Syllable")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onClick={onExportLyric(stringifyAss, "ass")}>
						{t("topBar.menu.exportLyric.toASS", "ASS subtitles")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
