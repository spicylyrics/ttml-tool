import { DropdownMenu } from "@radix-ui/themes";
import { useAtomValue, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { lyricTextNormalizationOptionsAtom } from "$/modules/settings/states";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import { normalizeLyricText } from "$/utils/apostrophe-normalization";
import { saveFile } from "$/utils/fileSystem";
import { error as logError } from "$/utils/logging";
import { lyricToText, textFileName } from "../logic/text-export";
import { projectsHubEnabledAtom } from "../states";

const useLyricText = () => {
	const store = useStore();
	const { t } = useTranslation();
	/** The lyrics as text, or null (with a toast) when there's nothing to export. */
	return useCallback(
		(format: "plain" | "genius") => {
			const lyric = normalizeLyricText(
				store.get(lyricLinesAtom),
				store.get(lyricTextNormalizationOptionsAtom),
			);
			const text = lyricToText(lyric, format);
			if (text.trim()) return text;
			toast.info(
				t("projectsHub.export.empty", "There are no lyrics to export."),
			);
			return null;
		},
		[store, t],
	);
};

/** Plain and Genius text entries for File > Export lyrics. Renders nothing with the flag off. */
export const TextExportMenuItems = () => {
	const store = useStore();
	const { t } = useTranslation();
	const enabled = useAtomValue(projectsHubEnabledAtom);
	const getText = useLyricText();

	const save = (format: "plain" | "genius") => async () => {
		const text = getText(format);
		if (text === null) return;
		try {
			await saveFile(text, {
				suggestedName: textFileName(store.get(saveFileNameAtom)),
				types: [
					{
						description: t("projectsHub.export.textFiles", "Text files"),
						accept: { "text/plain": [".txt"] },
					},
				],
			});
		} catch (e) {
			logError(`Failed to export lyrics as ${format} text`, e);
			toast.error(
				t("projectsHub.export.saveFailed", "Couldn't save the file."),
			);
		}
	};

	if (!enabled) return null;
	return (
		<>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={save("plain")}>
				{t("projectsHub.export.plainText", "Plain text...")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={save("genius")}>
				{t("projectsHub.export.geniusText", "Genius text...")}
			</DropdownMenu.Item>
		</>
	);
};

/** File menu entry that copies the lyrics as Genius text. Renders nothing with the flag off. */
export const CopyGeniusTextMenuItem = () => {
	const { t } = useTranslation();
	const enabled = useAtomValue(projectsHubEnabledAtom);
	const getText = useLyricText();

	if (!enabled) return null;
	return (
		<DropdownMenu.Item
			onSelect={async () => {
				const text = getText("genius");
				if (text === null) return;
				try {
					await navigator.clipboard.writeText(text);
					toast.success(
						t("projectsHub.export.copied", "Copied the lyrics as Genius text."),
					);
				} catch (e) {
					logError("Failed to copy the lyrics as Genius text", e);
					toast.error(
						t("projectsHub.export.copyFailed", "Couldn't copy the lyrics."),
					);
				}
			}}
		>
			{t("projectsHub.export.copyGenius", "Copy as Genius text")}
		</DropdownMenu.Item>
	);
};
