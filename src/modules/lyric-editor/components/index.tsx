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

import {
	MyLocation24Regular,
	TextBulletListSquare24Regular,
} from "@fluentui/react-icons";
import { Box, Button, Flex, Grid, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type FC,
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import {
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "$/modules/onboarding/states";
import {
	folderProjectsEnabledAtom,
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogOpenAtom,
	geniusHeaderDetectionDialogShownAtom,
} from "$/modules/settings/states/index.ts";
import { importLyricsDialogAtom, projectsDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, ToolMode, toolModeAtom } from "$/states/main.ts";
import {
	hasGeniusHeaderAtom,
	lyricLinesOnlyAtom,
} from "../states/document-structure.ts";
import styles from "./index.module.css";
import { LyricLineView } from "./lyric-line-view";
import { timingCopyPlacementAtom } from "./lyric-line-view-states";
import { useLineDragDrop } from "./lyric-lines-view/use-line-drag-drop.ts";
import { useLineListAutoScroll } from "./lyric-lines-view/use-line-list-auto-scroll.ts";
import { useLineListScrolling } from "./lyric-lines-view/use-line-list-scrolling.ts";
import { useLineListSelection } from "./lyric-lines-view/use-line-list-selection.ts";
import {
	CategorizeSelectionDialog,
	SectionManagerDialog,
	SectionMetadataDialog,
} from "./SectionActions";

export const LyricLinesView: FC = forwardRef<HTMLDivElement>((_props, ref) => {
	const editLyric = useAtomValue(lyricLinesOnlyAtom);
	const store = useStore();
	const viewRef = useRef<ViewportListRef>(null);
	const viewElRef = useRef<HTMLDivElement>(null);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	// Each mode mounts its own view (keyed by mode in App), and the old one
	// keeps rendering while it fades out. Pin the mode so the leaving view
	// doesn't adopt the next mode's layout and overwrite its scroll anchor.
	const [toolMode] = useState(() => store.get(toolModeAtom));
	const { t } = useTranslation();
	const setGuideWelcome = useSetAtom(guideWelcomeOpenAtom);
	const setGuidePanel = useSetAtom(guidePanelOpenAtom);
	const setGuideStep = useSetAtom(guideStepAtom);
	const setImportLyrics = useSetAtom(importLyricsDialogAtom);
	const setProjectsDialog = useSetAtom(projectsDialogAtom);
	const folderProjectsEnabled = useAtomValue(folderProjectsEnabledAtom);
	const { onOpenFile } = useTopMenuActions();

	useEffect(() => {
		if (toolMode === ToolMode.Preview) {
			store.set(timingCopyPlacementAtom, null);
		}
	}, [store, toolMode]);

	useLineDragDrop({ viewElRef, editLyric, toolMode, store, editLyricLines });

	// A new view first draws the top of the song, then jumps to its saved line
	// and fills in around it over a few frames. Keep it hidden until it has
	// settled so a mode switch shows the finished list at once. The timeout
	// covers a list that never finds its line.
	const [anchorSettled, setAnchorSettled] = useState(false);
	// The list measures its first row before drawing the rest, so give it two
	// more frames to fill in.
	const onAnchorSettled = useCallback(() => {
		requestAnimationFrame(() =>
			requestAnimationFrame(() => setAnchorSettled(true)),
		);
	}, []);
	useEffect(() => {
		const timer = window.setTimeout(onAnchorSettled, 600);
		return () => window.clearTimeout(timer);
	}, [onAnchorSettled]);

	const {
		scrollToIndex,
		lastSelectionScrolledIndexRef,
		lastPlaybackScrolledIndexRef,
		visibleItems,
	} = useLineListSelection({ editLyric, toolMode });

	const {
		scrollRafRef,
		isProgrammaticScrollRef,
		lastProgrammaticScrollTimeRef,
		cancelScrollAnimation,
		updateEditorAnchor,
		scrollToLineIndex,
		restoreEditorAnchorOnListReady,
	} = useLineListScrolling({
		viewElRef,
		viewRef,
		visibleItems,
		toolMode,
		store,
		onAnchorSettled,
	});

	const geniusCategorizationEnabled = useAtomValue(
		geniusCategorizationEnabledAtom,
	);
	const dialogShown = useAtomValue(geniusHeaderDetectionDialogShownAtom);
	const [, setDetectionDialogOpen] = useAtom(
		geniusHeaderDetectionDialogOpenAtom,
	);
	const hasGeniusHeader = useAtomValue(hasGeniusHeaderAtom);

	useEffect(() => {
		if (dialogShown || geniusCategorizationEnabled) return;
		if (hasGeniusHeader) {
			setDetectionDialogOpen(true);
		}
	}, [
		hasGeniusHeader,
		dialogShown,
		geniusCategorizationEnabled,
		setDetectionDialogOpen,
	]);

	const { handleLocate } = useLineListAutoScroll({
		viewElRef,
		toolMode,
		store,
		scrollToIndex,
		lastSelectionScrolledIndexRef,
		lastPlaybackScrolledIndexRef,
		scrollRafRef,
		isProgrammaticScrollRef,
		lastProgrammaticScrollTimeRef,
		cancelScrollAnimation,
		updateEditorAnchor,
		scrollToLineIndex,
	});

	useImperativeHandle(ref, () => viewElRef.current as HTMLDivElement, []);

	const emptyActions = (
		<>
			<Button
				onClick={() => {
					setGuideStep(0);
					setGuidePanel(false);
					setGuideWelcome(true);
				}}
			>
				{t("beginnerGuide.empty.start", "Start guide")}
			</Button>
			<Button variant="soft" onClick={() => setImportLyrics(true)}>
				{t("beginnerGuide.empty.import", "Import lyrics")}
			</Button>
			<Button variant="outline" onClick={onOpenFile}>
				{t("beginnerGuide.empty.open", "Open lyrics file")}
			</Button>
		</>
	);

	if (editLyric.length === 0)
		return (
			<Flex
				data-guide-target="editor"
				flexGrow="1"
				gap="2"
				align="center"
				justify="center"
				direction="column"
				height="100%"
				ref={ref}
			>
				{/* The sl-empty-* hooks only draw under the Spicy Lyrics design. */}
				<Flex
					direction="column"
					align="center"
					gap="2"
					className="sl-empty-panel"
				>
					<span className="sl-empty-icon" aria-hidden="true">
						<TextBulletListSquare24Regular />
					</span>
					<Text color="gray" className="sl-empty-title">
						{t("app.empty.title", "没有歌词行")}
					</Text>
					<Text color="gray" align="center">
						{t(
							"app.empty.description",
							"Add lines from the ribbon above, or open or import lyrics from the File menu.",
						)}
					</Text>
					{folderProjectsEnabled ? (
						// Four actions don't fit one row in the panel, so they get an even
						// 2x2 grid instead of wrapping one button onto its own line.
						<Grid
							columns="2"
							gap="2"
							mt="2"
							width="100%"
							maxWidth="24rem"
							className={styles.emptyActions}
						>
							{emptyActions}
							<Button variant="outline" onClick={() => setProjectsDialog(true)}>
								{t("topBar.menu.projects", "Projects")}
							</Button>
						</Grid>
					) : (
						<Flex gap="2" wrap="wrap" justify="center" mt="2">
							{emptyActions}
						</Flex>
					)}
				</Flex>
			</Flex>
		);
	return (
		<Flex
			data-guide-target="editor"
			direction="column"
			flexGrow="1"
			className={styles.lyricLinesWrapper}
		>
			<SectionMetadataDialog />
			<SectionManagerDialog />
			<CategorizeSelectionDialog />
			<Box
				flexGrow="1"
				style={{
					padding:
						toolMode === ToolMode.Sync
							? "clamp(24px, 12vh, 80px) 0"
							: undefined,
					height: "100%",
					maxHeight: "100%",
					overflowY: "auto",
					backgroundColor: "var(--editor-bg, transparent)",
					visibility: anchorSettled ? undefined : "hidden",
				}}
				ref={viewElRef}
			>
				<ViewportList
					overscan={25}
					items={visibleItems}
					ref={restoreEditorAnchorOnListReady}
					viewportRef={viewElRef}
				>
					{(item) => (
						<LyricLineView
							key={`${item.lineAtom}`}
							lineAtom={item.lineAtom}
							lineIndex={item.sourceIndex}
						/>
					)}
				</ViewportList>
			</Box>
			{(toolMode === ToolMode.Sync || toolMode === ToolMode.Edit) && (
				<Button
					className={styles.locateButton}
					variant="soft"
					onClick={handleLocate}
					title={t("lyricEditor.locate", "Centrar línea activa (Ctrl+Shift+L)")}
				>
					<MyLocation24Regular />
				</Button>
			)}
		</Flex>
	);
});

export default LyricLinesView;
