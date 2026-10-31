import { Box, Card, Checkbox, Flex, Text, Tooltip } from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ViewportList, type ViewportListRef } from "react-viewport-list";
import { OptionPicker } from "$/components/OptionPicker";
import { timedPreviewLyricsAtom } from "$/components/PreviewModeSwitcher/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states";
import { usePreviewScroll } from "$/modules/playback-clock/use-preview-scroll";
import {
	type TimingOverviewOrderMode,
	timingOverviewAutoScrollAtom,
	timingOverviewOrderModeAtom,
} from "$/modules/settings/states/sync.ts";
import { selectedLinesAtom } from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";
import { msToTimestamp } from "$/utils/timestamp";
import styles from "./index.module.css";
import {
	calculateTimingOverviewStats,
	findActiveTimingLineIndex,
	getDisplayedTimingLines,
} from "./timing-order.ts";
import { areWordGroupPropsEqual } from "./word-group-memo.ts";

const WordPill = memo(
	({
		word,
		currentTime,
		isGrouped,
		onWordClick,
	}: {
		word: LyricWord;
		currentTime: number;
		isGrouped?: boolean;
		onWordClick?: (word: LyricWord) => void;
	}) => {
		const { t } = useTranslation();
		const isWordActive =
			currentTime >= word.startTime && currentTime <= word.endTime;
		const wordDur = word.endTime - word.startTime;
		const isWhitespace = !word.word || word.word.trim() === "";

		if (isWhitespace && wordDur === 0) {
			return <div style={{ width: "4px" }} />;
		}

		const content = (
			<div
				className={classNames(
					styles.wordPill,
					isWordActive && styles.wordPillActive,
					isWhitespace && styles.whitespacePill,
					isGrouped && styles.groupedWordPill,
				)}
				onClick={
					onWordClick && (!isWhitespace || wordDur > 0)
						? (e) => {
								e.stopPropagation();
								onWordClick(word);
							}
						: undefined
				}
			>
				<Text className={styles.wordText}>
					{isWhitespace
						? word.word || <span className={styles.emptyBeat}>∅</span>
						: word.word}
				</Text>
				{(!isWhitespace || wordDur > 0) && (
					<Text className={classNames(styles.wordTime, styles.monospaced)}>
						{wordDur}ms
					</Text>
				)}
			</div>
		);

		return (
			<Tooltip
				content={
					<Flex direction="column" gap="1">
						<Text size="1">
							{t("timingOverview.start", "Start")}:{" "}
							{msToTimestamp(word.startTime)}
						</Text>
						<Text size="1">
							{t("timingOverview.end", "End")}: {msToTimestamp(word.endTime)}
						</Text>
						<Text size="1">
							{t("timingOverview.duration", "Duration")}: {wordDur}ms
						</Text>
						{word.romanWord && (
							<Text size="1">
								{t("timingOverview.romanization", "Roman")}: {word.romanWord}
							</Text>
						)}
					</Flex>
				}
			>
				{content}
			</Tooltip>
		);
	},
	(prev, next) => {
		const wasActive =
			prev.currentTime >= prev.word.startTime &&
			prev.currentTime <= prev.word.endTime;
		const isActive =
			next.currentTime >= next.word.startTime &&
			next.currentTime <= next.word.endTime;
		if (wasActive || isActive) return false;
		return prev.word === next.word;
	},
);

const WordGroup = memo(
	({
		words,
		currentTime,
		onWordClick,
	}: {
		words: LyricWord[];
		currentTime: number;
		onWordClick?: (word: LyricWord) => void;
	}) => {
		const isActive = words.some(
			(w) => currentTime >= w.startTime && currentTime <= w.endTime,
		);

		return (
			<div
				className={classNames(
					styles.wordGroup,
					isActive && styles.wordGroupActive,
				)}
			>
				{words.map((word, idx) => (
					<div
						key={word.id || idx}
						style={{ display: "flex", alignItems: "center" }}
					>
						<WordPill
							word={word}
							currentTime={currentTime}
							isGrouped={true}
							onWordClick={onWordClick}
						/>
						{idx < words.length - 1 && <div className={styles.wordDivider} />}
					</div>
				))}
			</div>
		);
	},
	areWordGroupPropsEqual,
);

const LineRow = memo(
	({
		line,
		index,
		currentTime,
		totalDuration,
		onRowClick,
		onWordClick,
	}: {
		line: LyricLine;
		index: number;
		currentTime: number;
		totalDuration: number;
		onRowClick: (line: LyricLine) => void;
		onWordClick: (word: LyricWord, line: LyricLine) => void;
	}) => {
		const { t } = useTranslation();
		const isActive =
			currentTime >= line.startTime && currentTime <= line.endTime;
		const duration = line.endTime - line.startTime;
		const durationPercent = totalDuration
			? (duration / totalDuration) * 100
			: 0;

		const wordGroups = useMemo(() => {
			const groups: (
				| { type: "words"; items: LyricWord[] }
				| { type: "whitespace"; word: LyricWord }
			)[] = [];
			let currentGroup: LyricWord[] = [];

			for (const word of line.words) {
				const isWhitespace = !word.word || word.word.trim() === "";
				if (isWhitespace) {
					if (currentGroup.length > 0) {
						groups.push({ type: "words", items: currentGroup });
						currentGroup = [];
					}
					groups.push({ type: "whitespace", word });
				} else {
					currentGroup.push(word);
				}
			}
			if (currentGroup.length > 0) {
				groups.push({ type: "words", items: currentGroup });
			}
			return groups;
		}, [line.words]);

		return (
			<div
				className={classNames(styles.row, isActive && styles.activeRow)}
				data-line-index={index}
				onClick={() => onRowClick(line)}
				style={{ display: "flex", borderBottom: "1px solid var(--gray-4)" }}
			>
				<div
					className={classNames(
						styles.monospaced,
						styles.cell,
						styles.fixedCell,
					)}
					style={{ width: "40px", padding: "8px 12px" }}
				>
					{index + 1}
				</div>
				<div
					className={classNames(
						styles.monospaced,
						styles.cell,
						styles.fixedCell,
					)}
					style={{ width: "100px", padding: "8px 12px" }}
				>
					{msToTimestamp(line.startTime)}
				</div>
				<div
					className={classNames(
						styles.monospaced,
						styles.cell,
						styles.fixedCell,
					)}
					style={{ width: "100px", padding: "8px 12px" }}
				>
					{msToTimestamp(line.endTime)}
				</div>
				<div
					className={classNames(styles.cell, styles.fixedCell)}
					style={{ width: "80px", padding: "8px 12px" }}
				>
					<Flex direction="column" gap="1">
						<Text size="1" className={styles.monospaced}>
							{(duration / 1000).toFixed(3)}s
						</Text>
						<div
							className={styles.durationBar}
							style={{ width: `${Math.min(100, durationPercent * 10)}%` }}
						/>
					</Flex>
				</div>
				<div
					className={styles.cell}
					style={{ flexGrow: 1, padding: "8px 12px", minWidth: 240 }}
				>
					<Box>
						<Flex align="center" gap="2" mb="1">
							<Text className={styles.lineText}>
								{line.words.map((w) => w.word).join("")}
							</Text>
							{line.isBG && (
								<Text
									size="1"
									style={{
										background: "var(--accent-9)",
										color: "white",
										padding: "0 4px",
										borderRadius: "2px",
										fontSize: "9px",
									}}
								>
									{t("timingOverview.backgroundVocal", "BG")}
								</Text>
							)}
						</Flex>
						<div className={styles.wordPills}>
							{wordGroups.map((group, gIdx) =>
								group.type === "words" ? (
									<WordGroup
										key={group.items?.[0]?.id || `g-${gIdx}`}
										words={group.items}
										currentTime={currentTime}
										onWordClick={(word) => onWordClick(word, line)}
									/>
								) : (
									<WordPill
										key={group.word?.id || `w-${gIdx}`}
										word={group.word}
										currentTime={currentTime}
										onWordClick={(word) => onWordClick(word, line)}
									/>
								),
							)}
						</div>
					</Box>
				</div>
			</div>
		);
	},
	(prev, next) => {
		const wasActive =
			prev.currentTime >= prev.line.startTime &&
			prev.currentTime <= prev.line.endTime;
		const isActive =
			next.currentTime >= next.line.startTime &&
			next.currentTime <= next.line.endTime;
		if (wasActive || isActive) return false;
		return (
			prev.line === next.line &&
			prev.totalDuration === next.totalDuration &&
			prev.index === next.index
		);
	},
);

export const TimingOverview = memo(() => {
	const { t } = useTranslation();
	const lyrics = useAtomValue(timedPreviewLyricsAtom);
	const currentTime = useAtomValue(currentTimeAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const [autoScroll, setAutoScroll] = useAtom(timingOverviewAutoScrollAtom);
	const [orderMode, setOrderMode] = useAtom(timingOverviewOrderModeAtom);
	const scrollRef = useRef<HTMLDivElement>(null);
	const viewportListRef = useRef<ViewportListRef>(null);

	const displayedLines = useMemo(() => {
		return getDisplayedTimingLines(lyrics.lyricLines, orderMode);
	}, [lyrics.lyricLines, orderMode]);

	const stats = useMemo(() => {
		return calculateTimingOverviewStats(lyrics.lyricLines);
	}, [lyrics.lyricLines]);

	const totalDuration = stats.totalMs;

	const handleRowClick = useMemo(
		() => (line: LyricLine) => {
			setCurrentTime(line.startTime);
			setSelectedLines(new Set([line.id]));
			audioEngine.seekMusic(line.startTime / 1000);
		},
		[setCurrentTime, setSelectedLines],
	);

	const handleWordClick = useCallback(
		(word: LyricWord, line: LyricLine) => {
			const targetTime =
				typeof word.startTime === "number" && word.startTime >= 0
					? word.startTime
					: line.startTime;
			setCurrentTime(targetTime);
			setSelectedLines(new Set([line.id]));
			audioEngine.seekMusic(targetTime / 1000);
		},
		[setCurrentTime, setSelectedLines],
	);

	const getScrollTarget = useCallback(
		(timeMs: number) => {
			const index = findActiveTimingLineIndex(displayedLines, timeMs);
			if (index < 0) return undefined;
			return {
				id: displayedLines[index].id,
				getNode: () =>
					scrollRef.current?.querySelector<HTMLElement>(
						`[data-line-index="${index}"]`,
					),
				reveal: () =>
					viewportListRef.current?.scrollToIndex({
						index,
						offset: (scrollRef.current?.clientHeight ?? 0) / -2,
					}),
			};
		},
		[displayedLines],
	);
	usePreviewScroll(scrollRef, getScrollTarget, {
		enabled: autoScroll,
		pauseMs: 3500,
	});

	return (
		<Card className={styles.timingOverview}>
			<div className={styles.header}>
				<Text size="2" weight="bold" style={{ minWidth: 0 }}>
					{t("timingOverview.title", "Technical timing overview")}
				</Text>
				<div
					className={styles.stats}
					style={{ alignItems: "center", minWidth: 0 }}
				>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.lines", "Lines")}:</Text>
						<Text size="1" weight="bold">
							{stats.lineCount}
						</Text>
					</div>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.words", "Words")}:</Text>
						<Text size="1" weight="bold">
							{stats.wordCount}
						</Text>
					</div>
					<div className={styles.statItem}>
						<Text size="1">{t("timingOverview.duration", "Duration")}:</Text>
						<Text size="1" weight="bold" className={styles.monospaced}>
							{msToTimestamp(stats.totalMs)}
						</Text>
					</div>
					<div className={styles.statItem}>
						<OptionPicker<TimingOverviewOrderMode>
							value={orderMode}
							onValueChange={setOrderMode}
							label={t("timingOverview.order", "Order")}
							options={[
								{
									value: "chronological",
									label: t(
										"timingOverview.orderChronological",
										"Chronological",
									),
								},
								{
									value: "textual",
									label: t("timingOverview.orderTextual", "Textual"),
								},
							]}
						/>
					</div>
					<div
						className={styles.statItem}
						style={{
							marginLeft: "auto",
							display: "flex",
							alignItems: "center",
							gap: "6px",
						}}
					>
						<Text size="1">
							{t("timingOverview.autoScroll", "Auto-scroll")}:
						</Text>
						<Checkbox
							checked={autoScroll}
							onCheckedChange={(v) => setAutoScroll(Boolean(v))}
						/>
					</div>
				</div>
			</div>
			<div className={styles.scrollArea} ref={scrollRef}>
				<div
					style={{ display: "flex", flexDirection: "column", minWidth: 560 }}
				>
					<div
						className={styles.tableHeader}
						style={{
							display: "flex",
							borderBottom: "1px solid var(--gray-6)",
							background: "var(--gray-2)",
							position: "sticky",
							top: 0,
							zIndex: 10,
						}}
					>
						<div
							className={styles.fixedCell}
							style={{
								width: "40px",
								padding: "8px 12px",
								fontWeight: 500,
								color: "var(--gray-11)",
								fontSize: "12px",
							}}
						>
							#
						</div>
						<div
							className={classNames(styles.fixedCell, styles.headerCell)}
							title={t("timingOverview.start", "Start")}
							style={{
								width: "100px",
								padding: "8px 12px",
								fontWeight: 500,
								color: "var(--gray-11)",
								fontSize: "12px",
							}}
						>
							{t("timingOverview.start", "Start")}
						</div>
						<div
							className={classNames(styles.fixedCell, styles.headerCell)}
							title={t("timingOverview.end", "End")}
							style={{
								width: "100px",
								padding: "8px 12px",
								fontWeight: 500,
								color: "var(--gray-11)",
								fontSize: "12px",
							}}
						>
							{t("timingOverview.end", "End")}
						</div>
						<div
							className={classNames(styles.fixedCell, styles.headerCell)}
							title={t("timingOverview.duration", "Duration")}
							style={{
								width: "80px",
								padding: "8px 12px",
								fontWeight: 500,
								color: "var(--gray-11)",
								fontSize: "12px",
							}}
						>
							{t("timingOverview.duration", "Duration")}
						</div>
						<div
							style={{
								flexGrow: 1,
								minWidth: 240,
								padding: "8px 12px",
								fontWeight: 500,
								color: "var(--gray-11)",
								fontSize: "12px",
							}}
						>
							{t("timingOverview.lyricsAndTimings", "Lyrics & word timings")}
						</div>
					</div>
					<ViewportList
						ref={viewportListRef}
						items={displayedLines}
						viewportRef={scrollRef}
					>
						{(line, index) => (
							<LineRow
								key={line.id || index}
								line={line}
								index={index}
								currentTime={currentTime}
								totalDuration={totalDuration}
								onRowClick={handleRowClick}
								onWordClick={handleWordClick}
							/>
						)}
					</ViewportList>
				</div>
			</div>
		</Card>
	);
});

export default TimingOverview;
