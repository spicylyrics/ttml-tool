import {
	AlertRegular,
	CheckRegular,
	DismissRegular,
	HistoryRegular,
	SubtractRegular,
	SearchRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Flex,
	IconButton,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	requestFocusAtom,
} from "$/states/main.ts";
import {
	collectPossibleGrammarWarnings,
	normalizeWord,
} from "$/modules/lyric-editor/utils/grammar-warning";

export const grammarCheckDialogAtom = atom(false);

const IGNORED_WORDS_KEY = "grammarCheckIgnoredWords";

const ignoredWordsAtom = atomWithStorage<string[]>(IGNORED_WORDS_KEY, []);

interface GrammarIssue {
	type: "repeated" | "ambiguous" | "article" | "capitalization";
	lineId: string;
	lineIndex: number;
	isBackground: boolean;
	wordId: string;
	word: string;
	message: string;
	suggestion?: string;
}

interface GrammarChange {
	action: "fix" | "ignore";
	issue: GrammarIssue;
	timestamp: number;
}

export const GrammarCheckDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(grammarCheckDialogAtom);
	const lyricData = useAtomValue(lyricLinesAtom);
	const allLyricLines = lyricData?.lyricLines || [];
	const setSelectedLines = useSetAtom(selectedLinesAtom);
	const setRequestFocus = useSetAtom(requestFocusAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [changeHistory, setChangeHistory] = useState<GrammarChange[]>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [ignoredIssues, setIgnoredIssues] = useState<Set<string>>(new Set());
	const [ignoredWords = [], setIgnoredWords] = useAtom(ignoredWordsAtom);
	const safeIgnoredList = Array.isArray(ignoredWords) ? ignoredWords : [];
	const [showIgnoreList, setShowIgnoreList] = useState(false);

	const issues = useMemo(() => {
		const result: GrammarIssue[] = [];
		if (!allLyricLines || allLyricLines.length === 0) return result;

		// Count main vocal lines for display (BG lines don't increase the count)
		let mainLineCount = 0;
		const safeIgnored = Array.isArray(ignoredWords) ? ignoredWords : [];

		allLyricLines.forEach((line) => {
			const isBackground = line.isBG;
			if (!isBackground) {
				mainLineCount++;
			}

			const ignoredWords = new Set<string>();
			const warnings = collectPossibleGrammarWarnings(line, ignoredWords);
			const wordIdsWithWarnings = Array.from(warnings);

			const wordIndexMap = new Map<string, number>();
			line.words?.forEach((w, i) => {
				wordIndexMap.set(w.id, i);
			});

			wordIdsWithWarnings.forEach((wordId) => {
				const wordIndex = wordIndexMap.get(wordId);
				if (wordIndex === undefined) return;
				const word = line.words?.[wordIndex];
				if (!word) return;

				const normalized = normalizeWord(word.word);
				let issueType: GrammarIssue["type"] = "ambiguous";
				let message = "";
				let suggestion: string | undefined;

				// Skip words in the global ignore list
				const isIgnored = safeIgnored.some(
					(ignored) => normalized.toLowerCase() === ignored.toLowerCase(),
				);
				if (isIgnored) return;

				// Check for lowercase at start of line
				const firstAlphaIndex = word.word.search(/[a-zA-Zа-яёÁ-ЯЁ]/);
				if (
					wordIndex === 0 &&
					firstAlphaIndex !== -1 &&
					word.word[firstAlphaIndex] ===
						word.word[firstAlphaIndex].toLowerCase()
				) {
					issueType = "capitalization";
					message = t(
						"grammarCheck.capitalization",
						"Word should be capitalized",
					);
					const char = word.word[firstAlphaIndex];
					suggestion =
						word.word.slice(0, firstAlphaIndex) +
						char.toUpperCase() +
						word.word.slice(firstAlphaIndex + 1);
				}

				// Check for capital letters in middle of line
				if (wordIndex > 0 && !message) {
					const hasCapitalInMiddle = /[a-zA-Zà-ÿÀ-ÿ].*[A-ZÀ-Ý]/.test(word.word);
					if (hasCapitalInMiddle) {
						issueType = "ambiguous";
						message = t(
							"grammarCheck.capitalInMiddle",
							"Word has capital letters in middle",
						);
						// Suggestion: lowercase the capital letter in middle
						const lowerMatch = word.word.match(/[a-zà-ÿ][A-ZÀ-Ý]/);
						if (lowerMatch) {
							const lowerIdx = word.word.search(/[a-zà-ÿ][A-ZÀ-Ý]/);
							if (lowerIdx !== -1) {
								suggestion =
									word.word.slice(0, lowerIdx + 1) +
									word.word.slice(lowerIdx + 1).toLowerCase();
							}
						}
					}
				}

				if (message) {
					result.push({
						type: issueType,
						lineId: line.id,
						lineIndex: mainLineCount,
						isBackground,
						wordId,
						word: word.word,
						message,
						suggestion,
					});
				}
			});
		});

		return result;
	}, [allLyricLines, t, ignoredWords]);

	const displayedIssues = useMemo(() => {
		return issues.filter((issue) => !ignoredIssues.has(issue.wordId));
	}, [issues, ignoredIssues]);

	const issueCount = displayedIssues.length;

	const handleJumpToIssue = (issue: GrammarIssue) => {
		setSelectedLines(new Set([issue.lineId]));
		setRequestFocus("startTime");
	};

	const handleFix = (issue: GrammarIssue) => {
		if (!issue.suggestion) return;

		const lineIndex = allLyricLines.findIndex((l) => l.id === issue.lineId);
		if (lineIndex === -1) return;

		editLyricLines((lyrics) => {
			const line = lyrics.lyricLines[lineIndex];
			if (line && line.words) {
				const wordIndex = line.words.findIndex((w) => w.id === issue.wordId);
				if (wordIndex !== -1 && line.words[wordIndex]) {
					line.words[wordIndex].word = issue.suggestion!;
				}
			}
		});

		setChangeHistory((prev) => [
			...prev,
			{ action: "fix", issue, timestamp: Date.now() },
		]);
	};

	const handleIgnore = (issue: GrammarIssue) => {
		setIgnoredIssues((prev) => new Set(prev).add(issue.wordId));
		setChangeHistory((prev) => [
			...prev,
			{ action: "ignore", issue, timestamp: Date.now() },
		]);
	};

	const handleIgnoreWord = (word: string) => {
		const normalized = normalizeWord(word);
		const safeList = Array.isArray(ignoredWords) ? ignoredWords : [];
		if (normalized && !safeList.includes(normalized)) {
			setIgnoredWords([...safeList, normalized]);
		}
	};

	const handleClearHistory = () => {
		setChangeHistory([]);
	};

	const handleUndoLast = () => {
		if (changeHistory.length === 0) return;

		const lastChange = changeHistory[changeHistory.length - 1];

		if (lastChange.action === "ignore") {
			// Remove from ignored issues so it reappears in the list
			setIgnoredIssues((prev) => {
				const newSet = new Set(prev);
				newSet.delete(lastChange.issue.wordId);
				return newSet;
			});
			setChangeHistory((prev) => prev.slice(0, -1));
			return;
		}

		// For fix actions, revert the fix
		const issue = lastChange.issue;
		const lineIndex = allLyricLines.findIndex((l) => l.id === issue.lineId);
		if (lineIndex === -1) return;

		editLyricLines((lyrics) => {
			const line = lyrics.lyricLines[lineIndex];
			if (line && line.words) {
				const wordIndex = line.words.findIndex((w) => w.id === issue.wordId);
				if (wordIndex !== -1 && line.words[wordIndex]) {
					line.words[wordIndex].word = issue.word;
				}
			}
		});

		setChangeHistory((prev) => prev.slice(0, -1));
	};

	return (
		<>
			{isOpen && (
				<Box
					style={{
						position: "fixed",
						inset: 0,
						backgroundColor: "rgba(0,0,0,0.5)",
						zIndex: 1000,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
					onClick={() => setIsOpen(false)}
				>
					<Box
						style={{
							backgroundColor: "var(--color-panel)",
							borderRadius: "8px",
							width: "700px",
							maxHeight: "80vh",
							overflow: "hidden",
						}}
						onClick={(e) => e.stopPropagation()}
					>
						<Flex
							align="center"
							justify="between"
							style={{
								padding: "16px",
								borderBottom: "1px solid var(--gray-5)",
							}}
						>
							<Text size="5" weight="bold">
								{t("grammarCheck.title", "Grammar & Spelling Check")}
							</Text>
							<Flex align="center" gap="4">
								<Flex align="center" gap="2">
									<Button
										variant={!showHistory && !showIgnoreList ? "soft" : "ghost"}
										size="1"
										style={{ width: "90px", flexShrink: 0 }}
										onClick={() => {
											setShowHistory(false);
											setShowIgnoreList(false);
										}}
									>
										<AlertRegular />
										<span style={{ whiteSpace: "nowrap" }}>
											{t("grammarCheck.issues", "Issues")} ({issueCount})
										</span>
									</Button>
									<Button
										variant={showHistory ? "soft" : "ghost"}
										size="1"
										style={{ width: "90px", flexShrink: 0 }}
										onClick={() => {
											setShowHistory(true);
											setShowIgnoreList(false);
										}}
									>
										<HistoryRegular />
										<span style={{ whiteSpace: "nowrap" }}>
											{t("grammarCheck.history", "History")} (
											{changeHistory.length})
										</span>
									</Button>
									<Button
										variant={showIgnoreList ? "soft" : "ghost"}
										size="1"
										style={{ width: "130px", flexShrink: 0 }}
										onClick={() => {
											setShowIgnoreList(true);
											setShowHistory(false);
										}}
									>
										<SubtractRegular />
										<span style={{ whiteSpace: "nowrap" }}>
											{t("grammarCheck.ignoredWords", "Ignored Words")} (
											{safeIgnoredList.length})
										</span>
									</Button>
								</Flex>
								<IconButton
									size="1"
									variant="ghost"
									onClick={() => setIsOpen(false)}
								>
									<DismissRegular />
								</IconButton>
							</Flex>
						</Flex>

						<Box style={{ padding: "16px" }}>
							<Text size="2" color="gray">
								{issueCount === 0
									? t("grammarCheck.noIssues", "No issues found!")
									: `${issueCount} ${t("grammarCheck.issuesFound", "issues found")}`}
							</Text>
						</Box>

						{showHistory ? (
							<ScrollArea style={{ height: "400px" }}>
								<Box style={{ padding: "16px" }}>
									<Flex justify="end" gap="2" style={{ marginBottom: "8px" }}>
										<Button
											size="1"
											variant="outline"
											disabled={changeHistory.length === 0}
											onClick={handleUndoLast}
										>
											{t("grammarCheck.undoLast", "Undo Last")}
										</Button>
										<Button
											size="1"
											variant="outline"
											onClick={handleClearHistory}
										>
											{t("grammarCheck.clearHistory", "Clear History")}
										</Button>
									</Flex>
									{changeHistory.length === 0 ? (
										<Text size="2" color="gray">
											{t("grammarCheck.noHistory", "No changes made yet")}
										</Text>
									) : (
										<Flex direction="column" gap="2">
											{[...changeHistory].reverse().map((change) => (
												<Box
													key={`${change.issue.wordId}-${change.timestamp}`}
													style={{
														padding: "8px",
														backgroundColor: "var(--gray-3)",
														borderRadius: "4px",
													}}
												>
													<Flex align="center" gap="2">
														{change.action === "fix" ? (
															<CheckRegular
																style={{ color: "var(--green-9)" }}
															/>
														) : (
															<DismissRegular
																style={{ color: "var(--gray-9)" }}
															/>
														)}
														<Text size="2">
															"{change.issue.word}" -{" "}
															{change.action === "fix"
																? t("grammarCheck.fixed", "fixed")
																: t("grammarCheck.ignored", "ignored")}
														</Text>
														<Text size="1" color="gray">
															({t("grammarCheck.line", "Line")}{" "}
															{change.issue.lineIndex}
															{change.issue.isBackground ? " (BG)" : ""})
														</Text>
													</Flex>
												</Box>
											))}
										</Flex>
									)}
								</Box>
							</ScrollArea>
						) : showIgnoreList ? (
							<ScrollArea style={{ height: "400px" }}>
								<Box style={{ padding: "16px" }}>
									<Flex justify="end" gap="2" style={{ marginBottom: "8px" }}>
										<Button
											size="1"
											variant="outline"
											disabled={safeIgnoredList.length === 0}
											onClick={() => setIgnoredWords([])}
										>
											{t("grammarCheck.clearIgnoredWords", "Clear All")}
										</Button>
									</Flex>
									{safeIgnoredList.length === 0 ? (
										<Text size="2" color="gray">
											{t("grammarCheck.noIgnoredWords", "No ignored words")}
										</Text>
									) : (
										<Flex direction="column" gap="2">
											{safeIgnoredList.map((word) => (
												<Box
													key={word}
													style={{
														padding: "8px",
														backgroundColor: "var(--gray-3)",
														borderRadius: "4px",
													}}
												>
													<Flex align="center" justify="between">
														<Text size="2">{word}</Text>
														<IconButton
															size="1"
															variant="soft"
															color="red"
															onClick={() => {
																setIgnoredWords(
																	safeIgnoredList.filter((w) => w !== word),
																);
															}}
														>
															<DismissRegular />
														</IconButton>
													</Flex>
												</Box>
											))}
										</Flex>
									)}
								</Box>
							</ScrollArea>
						) : (
							<ScrollArea style={{ height: "400px" }}>
								<Box style={{ padding: "16px" }}>
									{issueCount === 0 ? (
										<Flex
											direction="column"
											align="center"
											justify="center"
											style={{ padding: "40px" }}
										>
											<CheckRegular
												style={{
													width: "48px",
													height: "48px",
													color: "var(--green-9)",
												}}
											/>
											<Text size="3" style={{ marginTop: "16px" }}>
												{t(
													"grammarCheck.noIssuesMessage",
													"No issues found! Your lyrics look good.",
												)}
											</Text>
										</Flex>
									) : (
										<Flex direction="column" gap="2">
											{displayedIssues.map((issue) => (
												<Box
													key={`${issue.lineId}-${issue.wordId}`}
													style={{
														padding: "12px",
														backgroundColor: "var(--gray-3)",
														borderRadius: "6px",
													}}
												>
													<Flex align="center" justify="between" gap="2">
														<Box
															style={{ cursor: "pointer" }}
															onClick={() => handleJumpToIssue(issue)}
														>
															<Flex align="center" gap="2">
																<AlertRegular
																	style={{
																		color:
																			issue.type === "repeated"
																				? "var(--orange-9)"
																				: "var(--yellow-9)",
																	}}
																/>
																<Text size="2" weight="bold">
																	"{issue.word}"
																</Text>
																<Text size="2" color="gray">
																	-
																</Text>
																<Text size="2">{issue.message}</Text>
																{issue.suggestion && (
																	<>
																		<Text size="2" color="gray">
																			→
																		</Text>
																		<Text size="2" weight="bold" color="green">
																			{issue.suggestion}
																		</Text>
																	</>
																)}
															</Flex>
															<Text
																size="1"
																color="gray"
																style={{ marginTop: "4px" }}
															>
																{t("grammarCheck.line", "Line")}{" "}
																{issue.lineIndex}
																{issue.isBackground ? " (BG)" : ""}
															</Text>
														</Box>
														<Flex gap="1">
															<IconButton
																size="1"
																variant="soft"
																color="gray"
																onClick={() => handleJumpToIssue(issue)}
															>
																<SearchRegular />
															</IconButton>
															{issue.suggestion && (
																<IconButton
																	size="1"
																	variant="soft"
																	onClick={() => handleFix(issue)}
																	title="Apply suggested fix"
																>
																	<CheckRegular
																		style={{ color: "var(--green-9)" }}
																	/>
																</IconButton>
															)}
															<IconButton
																size="1"
																variant="soft"
																color="red"
																onClick={() => handleIgnore(issue)}
																title="Ignore this word in this session"
															>
																<DismissRegular />
															</IconButton>
															<IconButton
																size="1"
																variant="soft"
																onClick={() => handleIgnoreWord(issue.word)}
																title="Always ignore this word"
															>
																<SubtractRegular />
															</IconButton>
														</Flex>
													</Flex>
												</Box>
											))}
										</Flex>
									)}
								</Box>
							</ScrollArea>
						)}
					</Box>
				</Box>
			)}
		</>
	);
};
