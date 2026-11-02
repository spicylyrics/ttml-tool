import { ContextMenu } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { lyricLinesAtom } from "$/states/main";
import { editingSectionIdAtom } from "../states/sections";
import { startSectionAt } from "../utils/section-editing";
import { getSectionBoundsById } from "../utils/section-system";

/**
 * Starts a section at this line, then opens its label for renaming. Inside a
 * section it splits it there and keeps its type; on unassigned lines it makes
 * a verse. Edit mode only: Time mode is for timing, not restructuring.
 */
export function StartSectionHereItem({ lineIndex }: { lineIndex: number }) {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const line = lyrics.lyricLines[lineIndex];
	const section = lyrics.sections?.find((item) => item.id === line?.sectionId);
	const startsSection =
		!!section &&
		getSectionBoundsById(lyrics.lyricLines, section.id)?.start === lineIndex;
	return (
		<ContextMenu.Item
			disabled={!line || startsSection}
			onSelect={() => {
				let createdId: string | undefined;
				editLyrics((draft) => {
					createdId = startSectionAt(
						draft,
						lineIndex,
						section?.category ?? "verse",
					)?.id;
				});
				if (createdId) setEditingSectionId(createdId);
			}}
		>
			{t("sectionEditing.startHere", "Start section here")}
		</ContextMenu.Item>
	);
}
