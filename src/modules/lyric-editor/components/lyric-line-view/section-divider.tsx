import {
	ChevronDown16Regular,
	ChevronRight16Regular,
	MoreHorizontal16Regular,
} from "@fluentui/react-icons";
import { Button, DropdownMenu, IconButton, TextField } from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionCategorySelect } from "$/components/SectionCategorySelect";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { advGeniusHeaderColorAtom } from "$/modules/settings/states/index.ts";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import type { LyricSection } from "$/types/ttml.ts";
import { shiftSectionToTime } from "../../utils/genius-sections.ts";
import {
	relabelForCategory,
	toHeaderLabel,
	updateSection,
} from "../../utils/section-editing.ts";
import {
	getSectionBoundsById,
	mergeSectionWithAdjacent,
	removeSectionMetadata,
} from "../../utils/section-system.ts";
import { applyTimingsSectionIdAtom } from "../ApplySectionTimingsDialog.tsx";
import { lastLineDragEndAtom } from "../lyric-line-view-states.ts";
import { editingSectionIdAtom } from "../SectionActions.tsx";
import styles from "./section-divider.module.css";

const displayLabel = (label: string) => label.replace(/^\[|\]$/g, "");

/**
 * The row above the first line of a section: its name, a hairline, and the
 * section's tools. Click the name to rename or retype it in place; in Edit
 * mode, drag the row to move the whole section.
 */
export function SectionDivider({
	lineIndex,
	sectionId,
	geniusHeader,
}: {
	lineIndex: number;
	sectionId?: string;
	geniusHeader?: string;
}) {
	const sectionAtom = useMemo(
		() =>
			atom((get) =>
				sectionId
					? get(lyricLinesAtom).sections?.find((item) => item.id === sectionId)
					: undefined,
			),
		[sectionId],
	);
	const section = useAtomValue(sectionAtom);
	const label = section?.label ?? geniusHeader;
	// Subscribed, not read once: moving lines across a boundary has to show or
	// hide this row right away, not after a remount.
	const isStartAtom = useMemo(
		() =>
			atom((get) => {
				if (!label) return false;
				if (lineIndex === 0) return true;
				const previous = get(lyricLinesAtom).lyricLines[lineIndex - 1];
				return sectionId
					? previous?.sectionId !== sectionId
					: previous?.geniusHeader !== label;
			}),
		[label, lineIndex, sectionId],
	);
	const isStart = useAtomValue(isStartAtom);
	const headerColor = useAtomValue(advGeniusHeaderColorAtom);
	if (!isStart || !label) return null;
	if (!section)
		return (
			<div className={styles.divider}>
				<span className={styles.chevronSpace} />
				<span
					className={styles.label}
					style={{ color: headerColor || undefined }}
				>
					{displayLabel(label)}
				</span>
				<span className={styles.rule} aria-hidden />
			</div>
		);
	return <SectionRow section={section} headerColor={headerColor} />;
}

function SectionRow({
	section,
	headerColor,
}: {
	section: LyricSection;
	headerColor: string;
}) {
	const { t } = useTranslation();
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);
	const [collapsed, setCollapsed] = useAtom(collapsedSectionIdsAtom);
	const [editingId, setEditingId] = useAtom(editingSectionIdAtom);
	const editing = editingId === section.id;
	const isCollapsed = collapsed.has(section.id);
	const lineCountAtom = useMemo(
		() =>
			atom((get) => {
				const bounds = getSectionBoundsById(
					get(lyricLinesAtom).lyricLines,
					section.id,
				);
				return bounds ? bounds.end - bounds.start : 0;
			}),
		[section.id],
	);
	const lineCount = useAtomValue(lineCountAtom);

	const toggleCollapsed = () =>
		setCollapsed((current) => {
			const next = new Set(current);
			if (next.has(section.id)) next.delete(section.id);
			else next.add(section.id);
			return next;
		});

	// A click on the row itself (not its controls) selects the section's lines.
	const selectSection = (event: React.MouseEvent) => {
		if ((event.target as Element).closest("button, input, [role=combobox]"))
			return;
		if (Date.now() - store.get(lastLineDragEndAtom) < 250) return;
		const lines = store.get(lyricLinesAtom).lyricLines;
		store.set(
			selectedLinesAtom,
			new Set(
				lines.filter((line) => line.sectionId === section.id).map((l) => l.id),
			),
		);
	};

	return (
		// A pointer shortcut for selecting; the label and buttons are the keyboard path.
		<div
			className={styles.divider}
			data-section-divider={section.id}
			data-editing={editing || undefined}
			data-draggable={toolMode === ToolMode.Edit || undefined}
			onClick={selectSection}
		>
			<IconButton
				size="1"
				variant="ghost"
				color="gray"
				className={styles.chevron}
				aria-expanded={!isCollapsed}
				aria-label={
					isCollapsed
						? t("sectionActions.expand", "Expand section")
						: t("sectionActions.collapse", "Collapse section")
				}
				onClick={toggleCollapsed}
			>
				{isCollapsed ? <ChevronRight16Regular /> : <ChevronDown16Regular />}
			</IconButton>
			{editing ? (
				<SectionLabelEditor
					section={section}
					onDone={() => setEditingId(null)}
				/>
			) : (
				<button
					type="button"
					className={styles.label}
					style={{ color: headerColor || undefined }}
					title={t("sectionEditing.renameHint", "Rename or change type")}
					onClick={() => setEditingId(section.id)}
				>
					{displayLabel(section.label)}
				</button>
			)}
			<span className={styles.rule} aria-hidden />
			{!editing && (
				<span className={styles.meta}>
					{t(
						"sectionImportReview.lineCount",
						"{count, plural, one {# lyric line} other {# lyric lines}}",
						{ count: lineCount },
					)}
				</span>
			)}
			<div className={styles.actions}>
				{toolMode === ToolMode.Sync && !editing && (
					<SyncActions sectionId={section.id} />
				)}
				{toolMode === ToolMode.Edit && (
					<SectionMenu
						section={section}
						onRename={() => setEditingId(section.id)}
					/>
				)}
			</div>
		</div>
	);
}

function SyncActions({ sectionId }: { sectionId: string }) {
	const { t } = useTranslation();
	const store = useStore();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setApplyTimingsSectionId = useSetAtom(applyTimingsSectionIdAtom);
	return (
		<>
			<Button
				size="1"
				variant="soft"
				color="gray"
				onClick={() => setApplyTimingsSectionId(sectionId)}
			>
				{t("sectionEditing.applyTimings", "Apply timings from...")}
			</Button>
			<Button
				size="1"
				variant="soft"
				color="gray"
				onClick={() => {
					const currentTime = store.get(currentTimeAtom);
					editLyrics((draft) => {
						const start = getSectionBoundsById(draft.lyricLines, sectionId);
						if (start)
							shiftSectionToTime(draft.lyricLines, start.start, currentTime);
					});
				}}
			>
				{t("sectionEditing.snapToPlayhead", "Snap to playhead")}
			</Button>
		</>
	);
}

/** Rename, merge and remove. Reads the document only when opened. */
function SectionMenu({
	section,
	onRename,
}: {
	section: LyricSection;
	onRename: () => void;
}) {
	const { t } = useTranslation();
	const store = useStore();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const [hasPrevious, setHasPrevious] = useState(false);
	return (
		<DropdownMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				const lines = store.get(lyricLinesAtom).lyricLines;
				const bounds = getSectionBoundsById(lines, section.id);
				setHasPrevious(!!bounds && !!lines[bounds.start - 1]?.sectionId);
			}}
		>
			<DropdownMenu.Trigger>
				<IconButton
					size="1"
					variant="ghost"
					color="gray"
					aria-label={t("sectionEditing.menu", "Section actions")}
				>
					<MoreHorizontal16Regular />
				</IconButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content size="1" align="end">
				<DropdownMenu.Item onSelect={onRename}>
					{t("sectionEditing.rename", "Rename")}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					disabled={!hasPrevious}
					onSelect={() =>
						editLyrics((draft) => {
							mergeSectionWithAdjacent(draft, section.id, "previous");
						})
					}
				>
					{t("sectionActions.mergePrevious", "Merge with previous")}
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

/**
 * The label and type, edited in place. Enter or clicking away saves, Escape
 * puts them back. Changing the type renumbers a plain label ([Verse 2] ->
 * [Chorus 3]); a hand-written one stays as typed.
 */
function SectionLabelEditor({
	section,
	onDone,
}: {
	section: LyricSection;
	onDone: () => void;
}) {
	const { t } = useTranslation();
	const store = useStore();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const [text, setText] = useState(displayLabel(section.label));
	const [category, setCategory] = useState(section.category);
	const inputRef = useRef<HTMLInputElement>(null);
	const selectOpenRef = useRef(false);
	const doneRef = useRef(false);

	const finish = (save: boolean) => {
		if (doneRef.current) return;
		doneRef.current = true;
		const label = toHeaderLabel(text);
		if (
			save &&
			label &&
			(label !== section.label || category !== section.category)
		) {
			editLyrics((draft) => {
				updateSection(draft, section.id, label, category);
			});
		}
		onDone();
	};

	const changeCategory = (next: typeof category) => {
		const others = store.get(lyricLinesAtom).sections ?? [];
		const relabeled = relabelForCategory(
			others,
			{ ...section, label: toHeaderLabel(text) ?? section.label, category },
			next,
		);
		setText(displayLabel(relabeled.label));
		setCategory(next);
	};

	return (
		<div
			className={styles.editor}
			onBlur={(event) => {
				if (selectOpenRef.current) return;
				if (event.currentTarget.contains(event.relatedTarget as Node)) return;
				finish(true);
			}}
		>
			<TextField.Root
				ref={inputRef}
				size="1"
				className={styles.labelInput}
				aria-label={t("sectionEditing.label", "Section name")}
				value={text}
				autoFocus
				onFocus={(event) => event.currentTarget.select()}
				onChange={(event) => setText(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						event.stopPropagation();
						finish(true);
					} else if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						finish(false);
					}
				}}
			/>
			<SectionCategorySelect
				value={category}
				onValueChange={changeCategory}
				onOpenChange={(open) => {
					selectOpenRef.current = open;
				}}
				// Back to the name, so Enter saves straight away.
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					inputRef.current?.focus();
				}}
			/>
		</div>
	);
}
