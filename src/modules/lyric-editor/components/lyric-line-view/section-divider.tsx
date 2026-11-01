import {
	ChevronDown16Regular,
	ChevronRight16Regular,
	MoreHorizontal16Regular,
} from "@fluentui/react-icons";
import {
	Button,
	ContextMenu,
	DropdownMenu,
	IconButton,
	TextField,
} from "@radix-ui/themes";
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
			// No section tools here, and the browser's own menu has no place in the app.
			<div
				className={styles.divider}
				onContextMenu={(event) => event.preventDefault()}
			>
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
	const actions = useSectionActions(section.id);

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
		<ContextMenu.Root onOpenChange={actions.onMenuOpen}>
			<ContextMenu.Trigger disabled={toolMode === ToolMode.Preview}>
				{/* A pointer shortcut for selecting; the label and buttons are the keyboard path. */}
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
					{/* Next to the name, where the eye already is; the hairline fills the rest. */}
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
							<SyncActions actions={actions} />
						)}
						{toolMode === ToolMode.Edit && <SectionMenu actions={actions} />}
					</div>
					<span className={styles.rule} aria-hidden />
				</div>
			</ContextMenu.Trigger>
			<SectionContextMenu actions={actions} toolMode={toolMode} />
		</ContextMenu.Root>
	);
}

/**
 * What a section's hover tools, "..." menu and right-click menu do. Merge is
 * only offered when a section sits right above, which is read when a menu
 * opens so the row doesn't re-render on every sync press.
 */
function useSectionActions(sectionId: string) {
	const store = useStore();
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const setEditingId = useSetAtom(editingSectionIdAtom);
	const setApplyTimingsSectionId = useSetAtom(applyTimingsSectionIdAtom);
	const [hasPrevious, setHasPrevious] = useState(false);
	return {
		hasPrevious,
		onMenuOpen: (open: boolean) => {
			if (!open) return;
			const lines = store.get(lyricLinesAtom).lyricLines;
			const bounds = getSectionBoundsById(lines, sectionId);
			setHasPrevious(!!bounds && !!lines[bounds.start - 1]?.sectionId);
		},
		rename: () => setEditingId(sectionId),
		applyTimings: () => setApplyTimingsSectionId(sectionId),
		snapToPlayhead: () => {
			const currentTime = store.get(currentTimeAtom);
			editLyrics((draft) => {
				const bounds = getSectionBoundsById(draft.lyricLines, sectionId);
				if (bounds)
					shiftSectionToTime(draft.lyricLines, bounds.start, currentTime);
			});
		},
		mergePrevious: () =>
			editLyrics((draft) => {
				mergeSectionWithAdjacent(draft, sectionId, "previous");
			}),
		remove: () =>
			editLyrics((draft) => {
				removeSectionMetadata(draft, sectionId);
			}),
	};
}

type SectionActions = ReturnType<typeof useSectionActions>;

function SyncActions({ actions }: { actions: SectionActions }) {
	const { t } = useTranslation();
	return (
		<>
			<Button
				size="1"
				variant="soft"
				color="gray"
				onClick={actions.applyTimings}
			>
				{t("sectionEditing.applyTimings", "Apply timings from...")}
			</Button>
			<Button
				size="1"
				variant="soft"
				color="gray"
				onClick={actions.snapToPlayhead}
			>
				{t("sectionEditing.snapToPlayhead", "Snap to playhead")}
			</Button>
		</>
	);
}

/** The "..." menu in Edit mode: rename, merge and remove. */
function SectionMenu({ actions }: { actions: SectionActions }) {
	const { t } = useTranslation();
	return (
		<DropdownMenu.Root onOpenChange={actions.onMenuOpen}>
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
			<DropdownMenu.Content align="start">
				<DropdownMenu.Item onSelect={actions.rename}>
					{t("sectionEditing.rename", "Rename")}
				</DropdownMenu.Item>
				<DropdownMenu.Item
					disabled={!actions.hasPrevious}
					onSelect={actions.mergePrevious}
				>
					{t("sectionActions.mergePrevious", "Merge with previous")}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				<DropdownMenu.Item color="red" onSelect={actions.remove}>
					{t("sectionActions.removeHeader", "Remove header (keep lyrics)")}
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}

/** Right-clicking the row offers the same tools as hovering it. */
function SectionContextMenu({
	actions,
	toolMode,
}: {
	actions: SectionActions;
	toolMode: ToolMode;
}) {
	const { t } = useTranslation();
	return (
		<ContextMenu.Content>
			<ContextMenu.Item onSelect={actions.rename}>
				{t("sectionEditing.rename", "Rename")}
			</ContextMenu.Item>
			{toolMode === ToolMode.Sync && (
				<>
					<ContextMenu.Separator />
					<ContextMenu.Item onSelect={actions.applyTimings}>
						{t("sectionEditing.applyTimings", "Apply timings from...")}
					</ContextMenu.Item>
					<ContextMenu.Item onSelect={actions.snapToPlayhead}>
						{t("sectionEditing.snapToPlayhead", "Snap to playhead")}
					</ContextMenu.Item>
				</>
			)}
			{toolMode === ToolMode.Edit && (
				<>
					<ContextMenu.Item
						disabled={!actions.hasPrevious}
						onSelect={actions.mergePrevious}
					>
						{t("sectionActions.mergePrevious", "Merge with previous")}
					</ContextMenu.Item>
					<ContextMenu.Separator />
					<ContextMenu.Item color="red" onSelect={actions.remove}>
						{t("sectionActions.removeHeader", "Remove header (keep lyrics)")}
					</ContextMenu.Item>
				</>
			)}
		</ContextMenu.Content>
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
				size="2"
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
