import {
	Button,
	ContextMenu,
	Dialog,
	Flex,
	IconButton,
	Select,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { uid } from "uid";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import {
	LYRIC_SECTION_CATEGORIES,
	type LyricSection,
	type LyricSectionCategory,
} from "$/types/ttml";
import { relabelForCategory, startSectionAt } from "../utils/section-editing";
import {
	createSectionsFromSelectedLines,
	getOrderedSections,
	getSectionBoundsById,
	mergeSectionWithAdjacent,
	mergeUnassignedBlock,
	moveSection,
	removeSectionMetadata,
	splitSection,
} from "../utils/section-system";

export const editingSectionIdAtom = atom<string | null>(null);
const categorizingSelectionAtom = atom(false);
const sectionManagerOpenAtom = atom(false);

export function CategorizeSelectionContextMenuItem() {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setCategorizingSelection = useSetAtom(categorizingSelectionAtom);
	const selectedCount = selectedLines.size;
	const hasAssignedLine = lyrics.lyricLines.some(
		(line) => selectedLines.has(line.id) && line.sectionId,
	);

	return (
		<ContextMenu.Item
			disabled={selectedCount === 0 || hasAssignedLine}
			onSelect={() => setCategorizingSelection(true)}
		>
			{t("sectionActions.categorizeSelected", { count: selectedCount })}…
		</ContextMenu.Item>
	);
}

export function CategorizeSelectionDialog() {
	const { t } = useTranslation();
	const selectedLines = useAtomValue(selectedLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const [open, setOpen] = useAtom(categorizingSelectionAtom);
	const [category, setCategory] = useState<LyricSectionCategory>("verse");

	const save = () => {
		editLyrics((draft) => {
			createSectionsFromSelectedLines(draft, selectedLines, category);
		});
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="400px">
				<Dialog.Title>
					{t("sectionActions.categorizeTitle", "Categorize selected lines")}
				</Dialog.Title>
				<Flex direction="column" gap="3">
					<Select.Root
						value={category}
						onValueChange={(value) =>
							setCategory(value as LyricSectionCategory)
						}
					>
						<Select.Trigger />
						<Select.Content>
							{LYRIC_SECTION_CATEGORIES.map((item) => (
								<Select.Item key={item} value={item}>
									{item}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Flex justify="end" gap="2">
						<Button variant="soft" color="gray" onClick={() => setOpen(false)}>
							{t("common.cancel", "Cancel")}
						</Button>
						<Button onClick={save} disabled={selectedLines.size === 0}>
							{t("sectionActions.categorize", "Categorize")}
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function SectionActions({ section }: { section: LyricSection }) {
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useAtom(collapsedSectionIdsAtom);

	const toggleCollapsed = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(section.id)) next.delete(section.id);
			else next.add(section.id);
			return next;
		});
	};

	return (
		<>
			<IconButton
				size="1"
				variant="ghost"
				color="gray"
				onClick={toggleCollapsed}
				title={
					collapsed.has(section.id)
						? t("sectionActions.expand", "Expand section")
						: t("sectionActions.collapse", "Collapse section")
				}
			>
				{collapsed.has(section.id) ? "▸" : "▾"}
			</IconButton>
		</>
	);
}

export function SectionMetadataDialog() {
	const { t } = useTranslation();
	const [editingSectionId, setEditingSectionId] = useAtom(editingSectionIdAtom);
	const lyrics = useLyricLinesWhileOpen(!!editingSectionId);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const source = lyrics.sections?.find(
		(section) => section.id === editingSectionId,
	);
	const [editing, setEditing] = useState<LyricSection | null>(null);

	useEffect(() => {
		setEditing(source ? { ...source } : null);
	}, [source]);

	const closeEditor = () => {
		setEditing(null);
		setEditingSectionId(null);
	};

	return (
		<Dialog.Root
			open={!!editingSectionId}
			onOpenChange={(open) => !open && closeEditor()}
		>
			<Dialog.Content maxWidth="500px">
				<Dialog.Title>
					{t("sectionActions.editTitle", "Edit section")}
				</Dialog.Title>
				{editing && (
					<Flex direction="column" gap="3">
						<TextField.Root
							value={editing.label}
							onChange={(event) =>
								setEditing({ ...editing, label: event.target.value })
							}
						/>
						<Select.Root
							value={editing.category}
							onValueChange={(category) =>
								setEditing(
									relabelForCategory(
										lyrics.sections ?? [],
										editing,
										category as LyricSectionCategory,
									),
								)
							}
						>
							<Select.Trigger />
							<Select.Content>
								{LYRIC_SECTION_CATEGORIES.map((category) => (
									<Select.Item key={category} value={category}>
										{category}
									</Select.Item>
								))}
							</Select.Content>
						</Select.Root>
						<TextField.Root
							placeholder={t("sectionActions.vocalist", "Vocalist / role")}
							value={editing.vocalist ?? ""}
							onChange={(event) =>
								setEditing({
									...editing,
									vocalist: event.target.value || undefined,
								})
							}
						/>
						<input
							type="color"
							value={editing.color ?? "#808080"}
							onChange={(event) =>
								setEditing({ ...editing, color: event.target.value })
							}
							style={{ width: "100%", height: 32 }}
						/>
						<TextArea
							placeholder={t("sectionActions.notes", "Notes")}
							value={editing.notes ?? ""}
							onChange={(event) =>
								setEditing({
									...editing,
									notes: event.target.value || undefined,
								})
							}
						/>
						<Flex justify="end" gap="2">
							<Button variant="soft" color="gray" onClick={closeEditor}>
								{t("common.cancel", "Cancel")}
							</Button>
							<Button
								onClick={() => {
									editLyrics((draft) => {
										const target = draft.sections?.find(
											(item) => item.id === editing.id,
										);
										if (!target) return;
										Object.assign(target, editing);
										for (const line of draft.lyricLines) {
											if (line.sectionId === target.id) {
												line.geniusHeader = target.label;
											}
										}
									});
									closeEditor();
								}}
							>
								{t("common.save", "Save")}
							</Button>
						</Flex>
					</Flex>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function SectionManagerDialog() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(sectionManagerOpenAtom);
	const lyrics = useLyricLinesWhileOpen(open);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const sections = getOrderedSections(lyrics);
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="560px">
				<Dialog.Title>
					{t("sectionActions.manage", "Manage sections")}
				</Dialog.Title>
				<Flex direction="column" gap="2" mt="3">
					{sections.map((section) => {
						const bounds = getSectionBoundsById(lyrics.lyricLines, section.id);
						return (
							<Flex key={section.id} align="center" justify="between" gap="2">
								<Button
									variant="ghost"
									onClick={() => {
										if (!bounds) return;
										setSelectedLines(
											new Set(
												lyrics.lyricLines
													.slice(bounds.start, bounds.end)
													.map((line) => line.id),
											),
										);
									}}
								>
									{section.label} ({bounds ? bounds.end - bounds.start : 0})
								</Button>
								<Button
									size="1"
									onClick={() => setEditingSectionId(section.id)}
								>
									{t("common.edit", "Edit")}
								</Button>
							</Flex>
						);
					})}
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}

export function SectionContextMenuItems({
	section,
	lineIndex,
}: {
	section: LyricSection;
	lineIndex: number;
}) {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const setSectionManagerOpen = useSetAtom(sectionManagerOpenAtom);
	const orderedSections = getOrderedSections(lyrics);
	const sectionIndex = orderedSections.findIndex(
		(item) => item.id === section.id,
	);
	const bounds = getSectionBoundsById(lyrics.lyricLines, section.id);
	const previousId =
		bounds && bounds.start > 0
			? lyrics.lyricLines[bounds.start - 1]?.sectionId
			: undefined;
	const nextId =
		bounds && bounds.end < lyrics.lyricLines.length
			? lyrics.lyricLines[bounds.end]?.sectionId
			: undefined;
	const hasPreviousMatch = orderedSections
		.slice(0, Math.max(0, sectionIndex))
		.some((item) => item.category === section.category);

	const navigateToSection = (target: LyricSection | undefined) => {
		if (!target) return;
		const targetBounds = getSectionBoundsById(lyrics.lyricLines, target.id);
		const targetLine = targetBounds
			? lyrics.lyricLines[targetBounds.start]
			: undefined;
		if (targetLine) setSelectedLines(new Set([targetLine.id]));
	};

	const linkToPrevious = () => {
		const previous = orderedSections
			.slice(0, Math.max(0, sectionIndex))
			.reverse()
			.find((item) => item.category === section.category);
		if (!previous) return;
		editLyrics((draft) => {
			const currentDraft = draft.sections?.find(
				(item) => item.id === section.id,
			);
			const previousDraft = draft.sections?.find(
				(item) => item.id === previous.id,
			);
			if (!currentDraft || !previousDraft) return;
			const groupId = previousDraft.repeatGroupId ?? uid();
			previousDraft.repeatGroupId = groupId;
			currentDraft.repeatGroupId = groupId;
		});
	};

	return (
		<>
			<ContextMenu.Item
				disabled={sectionIndex <= 0}
				onSelect={() => navigateToSection(orderedSections[sectionIndex - 1])}
			>
				{t("sectionActions.goPrevious", "Go to previous section")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={
					sectionIndex < 0 || sectionIndex >= orderedSections.length - 1
				}
				onSelect={() => navigateToSection(orderedSections[sectionIndex + 1])}
			>
				{t("sectionActions.goNext", "Go to next section")}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item onSelect={() => setEditingSectionId(section.id)}>
				{t("sectionActions.editMetadata", "Edit metadata")}
			</ContextMenu.Item>
			<ContextMenu.Item onSelect={() => setSectionManagerOpen(true)}>
				{t("sectionActions.manage", "Manage sections")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={
					!bounds ||
					bounds.end - bounds.start < 2 ||
					lineIndex <= bounds.start ||
					lineIndex >= bounds.end
				}
				onSelect={() =>
					editLyrics((draft) => {
						splitSection(draft, section.id, lineIndex);
					})
				}
			>
				{t("sectionActions.split", "Split at selected line")}
			</ContextMenu.Item>
			<StartSectionHereItem
				lineIndex={lineIndex}
				category={section.category}
				disabled={!bounds || lineIndex <= bounds.start}
			/>
			<ContextMenu.Item
				disabled={!previousId || previousId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						mergeSectionWithAdjacent(draft, section.id, "previous");
					})
				}
			>
				{t("sectionActions.mergePrevious", "Merge with previous")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!nextId || nextId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						mergeSectionWithAdjacent(draft, section.id, "next");
					})
				}
			>
				{t("sectionActions.mergeNext", "Merge with next")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!previousId || previousId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						moveSection(draft, section.id, "up");
					})
				}
			>
				{t("sectionActions.moveUp", "Move up")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!nextId || nextId === section.id}
				onSelect={() =>
					editLyrics((draft) => {
						moveSection(draft, section.id, "down");
					})
				}
			>
				{t("sectionActions.moveDown", "Move down")}
			</ContextMenu.Item>
			<ContextMenu.Item disabled={!hasPreviousMatch} onSelect={linkToPrevious}>
				{t("sectionActions.linkPrevious", { category: section.category })}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!section.repeatGroupId}
				onSelect={() =>
					editLyrics((draft) => {
						const target = draft.sections?.find(
							(item) => item.id === section.id,
						);
						if (target) delete target.repeatGroupId;
					})
				}
			>
				{t("sectionActions.unlinkRepeat", "Unlink repeat")}
			</ContextMenu.Item>
			<ContextMenu.Separator />
			<ContextMenu.Item
				color="red"
				onSelect={() =>
					editLyrics((draft) => {
						removeSectionMetadata(draft, section.id);
					})
				}
			>
				{t("sectionActions.removeHeader", "Remove header (keep lyrics)")}
			</ContextMenu.Item>
		</>
	);
}

/**
 * Starts a section at this line, then opens it for renaming or retyping.
 * Edit mode only: Sync mode is for timing, not restructuring.
 */
function StartSectionHereItem({
	lineIndex,
	category,
	disabled,
}: {
	lineIndex: number;
	category: LyricSectionCategory;
	disabled: boolean;
}) {
	const { t } = useTranslation();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setEditingSectionId = useSetAtom(editingSectionIdAtom);
	const toolMode = useAtomValue(toolModeAtom);
	if (toolMode !== ToolMode.Edit) return null;
	return (
		<ContextMenu.Item
			disabled={disabled}
			onSelect={() => {
				let createdId: string | undefined;
				editLyrics((draft) => {
					createdId = startSectionAt(draft, lineIndex, category)?.id;
				});
				if (createdId) setEditingSectionId(createdId);
			}}
		>
			{t("sectionEditing.startHere", "Start section here")}
		</ContextMenu.Item>
	);
}

export function UnassignedSectionContextMenuItems({
	lineIndex,
}: {
	lineIndex: number;
}) {
	const { t } = useTranslation();
	const lyrics = useAtomValue(lyricLinesAtom);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const line = lyrics.lyricLines[lineIndex];
	let start = lineIndex;
	let end = lineIndex + 1;
	while (start > 0 && !lyrics.lyricLines[start - 1].sectionId) start--;
	while (end < lyrics.lyricLines.length && !lyrics.lyricLines[end].sectionId)
		end++;
	const previousId =
		line && !line.sectionId
			? lyrics.lyricLines[start - 1]?.sectionId
			: undefined;
	const nextId =
		line && !line.sectionId ? lyrics.lyricLines[end]?.sectionId : undefined;
	return (
		<>
			<StartSectionHereItem
				lineIndex={lineIndex}
				category="verse"
				disabled={!line || !!line.sectionId}
			/>
			<ContextMenu.Item
				disabled={!previousId}
				onSelect={() =>
					editLyrics((draft) => {
						mergeUnassignedBlock(draft, lineIndex, "previous");
					})
				}
			>
				{t(
					"sectionActions.addToPrevious",
					"Add unassigned lines to previous section",
				)}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!nextId}
				onSelect={() =>
					editLyrics((draft) => {
						mergeUnassignedBlock(draft, lineIndex, "next");
					})
				}
			>
				{t("sectionActions.addToNext", "Add unassigned lines to next section")}
			</ContextMenu.Item>
		</>
	);
}

export function SectionContextMenuSub({
	section,
	lineIndex,
}: {
	section: LyricSection;
	lineIndex: number;
}) {
	const { t } = useTranslation();
	return (
		<ContextMenu.Sub>
			<ContextMenu.SubTrigger>
				{t("sectionActions.section", "Section")}
			</ContextMenu.SubTrigger>
			<ContextMenu.SubContent sideOffset={12}>
				<SectionContextMenuItems section={section} lineIndex={lineIndex} />
			</ContextMenu.SubContent>
		</ContextMenu.Sub>
	);
}
