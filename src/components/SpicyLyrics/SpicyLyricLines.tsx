/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import classNames from "classnames";
import { memo, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { WordTimingProblem } from "$/modules/preview-problems/detect-word-timing-problems";
import styles from "./index.module.css";
import {
	groupSpicyTokens,
	isRtl,
	keyFor,
	type SpicyLine,
	type SpicyToken,
} from "./model";
import { rowGap, type SpicyVirtualRow } from "./useSpicyVirtualList";

/** Tooltip and accessible label for each problem a word can be marked with. */
const problemLabels: Record<WordTimingProblem, [string, string]> = {
	untimed: ["previewProblems.untimed", "No timing in a timed line"],
	endsBeforeStart: ["previewProblems.endsBeforeStart", "Ends before it starts"],
	startsBeforeLine: [
		"previewProblems.startsBeforeLine",
		"Starts before its line",
	],
	endsAfterLine: ["previewProblems.endsAfterLine", "Ends after its line"],
};

type NodeMaps = {
	lineNodes: RefObject<Map<string, HTMLDivElement>>;
	wordNodes: RefObject<Map<string, HTMLElement>>;
};

export function SpicyLyricLines({
	lines,
	rows,
	totalSize,
	measureRow,
	lineNodes,
	wordNodes,
	showTranslation,
	seek,
}: NodeMaps & {
	lines: SpicyLine[];
	rows: SpicyVirtualRow[];
	totalSize: number;
	measureRow: (node: HTMLDivElement | null) => void;
	showTranslation: boolean;
	seek: (time: number) => void;
}) {
	return (
		<div className={styles.virtualContent} style={{ height: totalSize }}>
			{rows.map(({ index, start }) => {
				const line = lines[index];
				if (!line) return null;
				return (
					<div
						key={line.id}
						ref={measureRow}
						data-index={index}
						className={styles.row}
						style={{
							transform: `translateY(${start}px)`,
							paddingBottom: `${rowGap(lines, index)}cqw`,
						}}
					>
						<SpicyLineRow
							line={line}
							lineNodes={lineNodes}
							wordNodes={wordNodes}
							showTranslation={showTranslation}
							seek={seek}
						/>
					</div>
				);
			})}
		</div>
	);
}

const SpicyLineRow = memo(function SpicyLineRow({
	line,
	lineNodes,
	wordNodes,
	showTranslation,
	seek,
}: NodeMaps & {
	line: SpicyLine;
	showTranslation: boolean;
	seek: (time: number) => void;
}) {
	const { t } = useTranslation();
	const untimed = line.isUntimed
		? t("previewProblems.untimedLine", "Not synced yet")
		: undefined;
	const renderToken = (
		line: SpicyLine,
		word: SpicyToken,
		wordIndex: number,
		wordBoundary: boolean,
		partOfWord = false,
	) => {
		const key = keyFor(line, word, wordIndex);
		const letters = word.letters;
		const className = letters ? styles.letterGroup : styles.word;
		const problem = word.problems?.length
			? word.problems.map((item) => t(...problemLabels[item])).join(". ")
			: undefined;
		const pending = word.isUntimed
			? t("previewProblems.untimedLine", "Not synced yet")
			: undefined;
		return (
			<span
				key={key}
				ref={(node) => {
					if (node) wordNodes.current.set(key, node);
					else wordNodes.current.delete(key);
				}}
				className={classNames(
					className,
					wordBoundary && styles.wordBoundary,
					partOfWord && styles.partOfWord,
					word.allowInternalWrap && styles.breakableToken,
					problem && styles.timingProblem,
					pending && styles.untimedWord,
				)}
				dir={isRtl(word.text) ? "rtl" : undefined}
				title={problem ?? pending}
				aria-label={problem ? `${word.text}: ${problem}` : undefined}
				data-timing-problem={problem ? word.problems?.join(" ") : undefined}
			>
				{letters
					? letters
							.map((letter, index) => ({
								letter,
								start:
									word.startTime +
									index * ((word.endTime - word.startTime) / letters.length),
							}))
							.map(({ letter, start }) => (
								<span
									key={`${key}:${start}`}
									ref={(node) => {
										if (node) wordNodes.current.set(`${key}:${start}`, node);
										else wordNodes.current.delete(`${key}:${start}`);
									}}
									className={classNames(
										styles.letter,
										letter.trim().length === 0 && styles.spaceLetter,
									)}
								>
									{letter}
								</span>
							))
					: word.text}
			</span>
		);
	};
	return (
		<div
			ref={(node) => {
				if (node) lineNodes.current.set(line.id, node);
				else lineNodes.current.delete(line.id);
			}}
			className={classNames(
				styles.line,
				line.isDotLine && styles.dotLine,
				line.isLineSynced && styles.lineSynced,
				line.isRtl && styles.rtl,
				line.isBackground && styles.backgroundLine,
				line.isDuet && styles.duet,
				line.isUntimed && styles.untimedLine,
			)}
			dir={line.isRtl ? "rtl" : undefined}
			title={untimed}
			data-untimed={line.isUntimed || undefined}
			onClick={line.isUntimed ? undefined : () => seek(line.startTime)}
		>
			{line.isDotLine ? (
				<div className={styles.dotGroup}>
					{line.words.map((word, wi) => {
						const key = keyFor(line, word, wi);
						return (
							<span
								key={key}
								ref={(node) => {
									if (node) wordNodes.current.set(key, node);
									else wordNodes.current.delete(key);
								}}
								className={styles.dot}
							>
								{word.text}
							</span>
						);
					})}
				</div>
			) : line.isLineSynced ? (
				line.text
			) : (
				groupSpicyTokens(line.words).map((group) => {
					const first = group.items[0];
					if (group.items.length === 1)
						return renderToken(
							line,
							first.token,
							first.wordIndex,
							group.hasTrailingSpace,
						);
					return (
						<span
							key={`group:${keyFor(line, first.token, first.wordIndex)}`}
							className={classNames(
								styles.wordGroup,
								group.hasTrailingSpace && styles.wordBoundary,
								// One box around a split word, not one per touching syllable.
								group.items.some(({ token }) => token.problems?.length) &&
									styles.problemGroup,
							)}
						>
							{/* Every syllable but the last joins the next one, so each
									    scales toward the joint instead of opening a gap. */}
							{group.items.map(({ token, wordIndex }, index) =>
								renderToken(
									line,
									token,
									wordIndex,
									false,
									index < group.items.length - 1,
								),
							)}
						</span>
					);
				})
			)}
			{showTranslation && !line.isDotLine && line.translation ? (
				<span className={styles.translation}>{line.translation}</span>
			) : null}
		</div>
	);
});
