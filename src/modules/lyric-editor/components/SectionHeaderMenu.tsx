import { MoreHorizontal16Regular } from "@fluentui/react-icons";
import { DropdownMenu, IconButton } from "@radix-ui/themes";
import { useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricSection } from "$/types/ttml.ts";
import { moveSectionStart } from "../utils/section-editing.ts";
import {
	getSectionBoundsById,
	mergeSectionWithAdjacent,
	removeSectionMetadata,
} from "../utils/section-system.ts";
import { applyTimingsSectionIdAtom } from "./ApplySectionTimingsDialog.tsx";
import { editingSectionIdAtom } from "./SectionActions.tsx";

interface MenuState {
	canMoveUp: boolean;
	canMoveDown: boolean;
	hasPrevious: boolean;
	hasNext: boolean;
}

/**
 * The header's "..." menu for the section editing tools. It reads the
 * document only when opened, so headers don't re-render on every sync press.
 */
export function SectionHeaderMenu({ section }: { section: LyricSection }) {
	const { t } = useTranslation();
	const store = useStore();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const setApplyTimingsSectionId = useSetAtom(applyTimingsSectionIdAtom);
	const [state, setState] = useState<MenuState>();

	const readState = () => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const bounds = getSectionBoundsById(lines, section.id);
		setState({
			canMoveUp: !!bounds && bounds.start > 0,
			canMoveDown: !!bounds && bounds.end - bounds.start > 1,
			hasPrevious: !!bounds && !!lines[bounds.start - 1]?.sectionId,
			hasNext: !!bounds && !!lines[bounds.end]?.sectionId,
		});
	};

	return (
		<DropdownMenu.Root onOpenChange={(open) => open && readState()}>
			<DropdownMenu.Trigger>
				<IconButton
					size="1"
					variant="ghost"
					color="gray"
					aria-label={t("sectionEditing.menu", "Section actions")}
					title={t("sectionEditing.menu", "Section actions")}
					onClick={(event) => event.stopPropagation()}
				>
					<MoreHorizontal16Regular />
				</IconButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content onClick={(event) => event.stopPropagation()}>
				<DropdownMenu.Item onSelect={() => setEditingSectionId(section.id)}>
					{t("sectionEditing.editHeader", { label: section.label })}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					onSelect={() => setApplyTimingsSectionId(section.id)}
				>
					{t("sectionEditing.applyTimings", "Apply timings from...")}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					disabled={!state?.canMoveUp}
					onSelect={() =>
						editLyrics((draft) => {
							moveSectionStart(draft, section.id, "up");
						})
					}
				>
					{t("sectionEditing.moveStartUp", "Move start up a line")}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					disabled={!state?.canMoveDown}
					onSelect={() =>
						editLyrics((draft) => {
							moveSectionStart(draft, section.id, "down");
						})
					}
				>
					{t("sectionEditing.moveStartDown", "Move start down a line")}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					disabled={!state?.hasPrevious}
					onSelect={() =>
						editLyrics((draft) => {
							mergeSectionWithAdjacent(draft, section.id, "previous");
						})
					}
				>
					{t("sectionActions.mergePrevious", "Merge with previous")}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					disabled={!state?.hasNext}
					onSelect={() =>
						editLyrics((draft) => {
							mergeSectionWithAdjacent(draft, section.id, "next");
						})
					}
				>
					{t("sectionActions.mergeNext", "Merge with next")}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item
					color="red"
					onSelect={() =>
						editLyrics((draft) => {
							removeSectionMetadata(draft, section.id);
						})
					}
				>
					{t("sectionActions.removeHeader", "Remove header (keep lyrics)")}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
