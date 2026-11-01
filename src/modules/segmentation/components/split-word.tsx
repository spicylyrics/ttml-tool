import { Info16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Callout,
	Checkbox,
	Dialog,
	Flex,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import {
	segmentationCustomRulesAtom,
	segmentationEngineAtom,
	segmentationIgnoreListTextAtom,
	segmentationLearnedRulesAtom,
	segmentationPunctuationModeAtom,
	segmentationPunctuationWeightAtom,
	segmentationRemoveEmptySegmentsAtom,
	segmentationSplitCJKAtom,
	segmentationSplitEnglishAtom,
	splitWordApplyToAllAtom,
	splitWordIgnoreCaseAtom,
	splitWordRememberAtom,
} from "$/modules/segmentation/states";
import type {
	HyphenatorFunc,
	SegmentationConfig,
} from "$/modules/segmentation/types";
import { loadHyphenator } from "$/modules/segmentation/utils/hyphen-loader.ts";
import {
	applyLearnedRule,
	createLearnedRule,
	getLearnedWordParts,
} from "$/modules/segmentation/utils/learned-rules";
import {
	recalculateWordTime,
	segmentWord,
} from "$/modules/segmentation/utils/segmentation.ts";
import { getHyphenationLanguage } from "$/modules/segmentation/utils/syllabification-engines";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import { editingWordStateAtom, lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { ManualWordSplitter } from "./ManualWordSplitter";

export const SplitWordDialog = memo(() => {
	const [splitWordDialog, splitWordDialogOpen] = useAtom(splitWordDialogAtom);
	const editingState = useAtomValue(editingWordStateAtom);
	const lyricLines = useLyricLinesWhileOpen(splitWordDialog);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const { t } = useTranslation();

	const [splitIndices, setSplitIndices] = useState(new Set<number>());
	const [targetWordText, setTargetWordText] = useState("");

	const [applyToAll, setApplyToAll] = useAtom(splitWordApplyToAllAtom);
	const [ignoreCase, setIgnoreCase] = useAtom(splitWordIgnoreCaseAtom);
	const [rememberSplit, setRememberSplit] = useAtom(splitWordRememberAtom);
	const [learnedRules, setLearnedRules] = useAtom(segmentationLearnedRulesAtom);
	const engine = useAtomValue(segmentationEngineAtom);

	const splitCJK = useAtomValue(segmentationSplitCJKAtom);
	const splitEnglish = useAtomValue(segmentationSplitEnglishAtom);
	const punctuationMode = useAtomValue(segmentationPunctuationModeAtom);
	const punctuationWeight = useAtomValue(segmentationPunctuationWeightAtom);
	const removeEmptySegments = useAtomValue(segmentationRemoveEmptySegmentsAtom);
	const ignoreListText = useAtomValue(segmentationIgnoreListTextAtom);
	const customRules = useAtomValue(segmentationCustomRulesAtom);
	const [activeHyphenator, setActiveHyphenator] = useState<
		HyphenatorFunc | undefined
	>(undefined);

	useEffect(() => {
		let isMounted = true;

		const fetchHyphenator = async () => {
			const language = getHyphenationLanguage(engine);
			if (!language) {
				setActiveHyphenator(undefined);
				return;
			}
			const func = await loadHyphenator(language);
			if (isMounted && func) {
				setActiveHyphenator(() => func);
			}
		};

		fetchHyphenator();

		return () => {
			isMounted = false;
		};
	}, [engine]);

	const ignoreList = useMemo(() => {
		return new Set(
			ignoreListText.split("\n").filter((line) => line.trim() !== ""),
		);
	}, [ignoreListText]);

	const segmentationConfig = useMemo((): SegmentationConfig => {
		const weight = parseFloat(punctuationWeight);
		const finalPunctuationWeight = Number.isNaN(weight) ? 0.2 : weight;

		return {
			engine,
			splitCJK,
			splitEnglish,
			punctuationMode,
			punctuationWeight: finalPunctuationWeight,
			removeEmptySegments,
			ignoreList,
			customRules,
			learnedRules,
			hyphenator: activeHyphenator,
		};
	}, [
		engine,
		splitCJK,
		splitEnglish,
		punctuationMode,
		punctuationWeight,
		removeEmptySegments,
		ignoreList,
		customRules,
		learnedRules,
		activeHyphenator,
	]);

	useEffect(() => {
		if (!splitWordDialog) {
			return;
		}

		const line = lyricLines.lyricLines[editingState.lineIndex];
		const word = line?.words[editingState.wordIndex];

		if (word) {
			setTargetWordText(word.word);

			const resultWords = segmentWord(word, segmentationConfig);
			if (resultWords.length > 1) {
				const indices = new Set<number>();
				let currentIndex = 0;
				for (let i = 0; i < resultWords.length - 1; i++) {
					currentIndex += Array.from(resultWords[i].word).length;
					indices.add(currentIndex);
				}
				setSplitIndices(indices);
			} else {
				setSplitIndices(new Set());
			}
		} else {
			setTargetWordText("");
			setSplitIndices(new Set());
		}
	}, [
		splitWordDialog,
		editingState.lineIndex,
		editingState.wordIndex,
		lyricLines,
		segmentationConfig,
	]);

	const toggleSplitPoint = useCallback((index: number) => {
		setSplitIndices((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	}, []);

	const handleSplit = useCallback(() => {
		if (!targetWordText) return;

		const sortedIndices = Array.from(splitIndices).sort((a, b) => a - b);
		const buildSegments = (text: string) => {
			const chars = Array.from(text);
			const parts: string[] = [];
			let lastIndex = 0;
			for (const index of sortedIndices) {
				if (index <= lastIndex) continue;
				parts.push(chars.slice(lastIndex, index).join(""));
				lastIndex = index;
			}
			parts.push(chars.slice(lastIndex).join(""));
			return parts.filter((p) => p.length > 0);
		};

		const targetSegments = buildSegments(targetWordText);

		if (targetSegments.length === 0) return;
		const splitRule = createLearnedRule(targetWordText, sortedIndices);
		const learnedRule = rememberSplit ? splitRule : null;
		const ruleForCurrentSplit = splitRule
			? new Map([[splitRule.key, splitRule.boundaries]])
			: null;
		const targetCore = getLearnedWordParts(targetWordText);

		const createNewWords = (
			targetWord: LyricWord,
			segments: string[],
		): LyricWord[] => {
			return recalculateWordTime(targetWord, segments, segmentationConfig);
		};

		editLyricLines((state) => {
			if (applyToAll) {
				for (const line of state.lyricLines) {
					line.words = line.words.flatMap((word) => {
						const isMatch = ignoreCase
							? getLearnedWordParts(word.word)?.key === targetCore?.key
							: word.word === targetWordText;

						if (isMatch) {
							const wordSegments =
								ruleForCurrentSplit && ignoreCase
									? applyLearnedRule(word.word, ruleForCurrentSplit) ||
										targetSegments
									: targetSegments;
							return createNewWords(
								word,
								wordSegments.length > 0 ? wordSegments : targetSegments,
							);
						}
						return word;
					});
				}
			} else {
				const line = state.lyricLines[editingState.lineIndex];
				if (line) {
					const word = line.words[editingState.wordIndex];
					if (word && word.word === targetWordText) {
						line.words.splice(
							editingState.wordIndex,
							1,
							...createNewWords(word, targetSegments),
						);
					}
				}
			}
		});

		if (learnedRule) {
			const nextRules = new Map(learnedRules);
			nextRules.set(learnedRule.key, learnedRule.boundaries);
			setLearnedRules(nextRules);
		}
	}, [
		targetWordText,
		splitIndices,
		editLyricLines,
		applyToAll,
		ignoreCase,
		rememberSplit,
		learnedRules,
		setLearnedRules,
		editingState.lineIndex,
		editingState.wordIndex,
		segmentationConfig,
	]);

	return (
		<Dialog.Root open={splitWordDialog} onOpenChange={splitWordDialogOpen}>
			<Dialog.Content>
				<Dialog.Title>{t("splitWordDialog.title", "Split word")}</Dialog.Title>
				<Flex direction="column" gap="2">
					<Callout.Root color="blue">
						<Callout.Icon>
							<Info16Regular />
						</Callout.Icon>
						<Callout.Text>
							{t(
								"splitWordDialog.tip",
								"After splitting, new words will evenly divide the original word's start/end time.",
							)}
						</Callout.Text>
					</Callout.Root>

					<Box my="3">
						<ManualWordSplitter
							word={targetWordText}
							splitIndices={splitIndices}
							onSplitIndexToggle={toggleSplitPoint}
						/>
						<Flex justify="end" mt="2">
							<Button
								size="1"
								variant="soft"
								disabled={!activeHyphenator || !targetWordText}
								onClick={() => {
									if (!activeHyphenator || !targetWordText) return;
									const hyphenated = activeHyphenator(targetWordText);
									const parts = hyphenated.split("\u00AD");
									const indices = new Set<number>();
									let currentIndex = 0;
									for (let i = 0; i < parts.length - 1; i++) {
										currentIndex += parts[i].length;
										indices.add(currentIndex);
									}
									setSplitIndices(indices);
								}}
							>
								{t("splitWordDialog.syllableSplit", "Syllable split")}
							</Button>
						</Flex>
					</Box>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={applyToAll}
									onCheckedChange={(c) => setApplyToAll(c as boolean)}
								/>
								{t(
									"splitWordDialog.applyToAll",
									"Apply this split to all identical words",
								)}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={rememberSplit}
									onCheckedChange={(c) => setRememberSplit(c as boolean)}
								/>
								{t("splitWordDialog.remember", "Remember this split")}
							</Flex>
						</Text>

						<Text as="label" size="2">
							<Flex
								gap="2"
								align="center"
								style={{ opacity: applyToAll ? 1 : 0.5 }}
							>
								<Checkbox
									disabled={!applyToAll}
									checked={ignoreCase}
									onCheckedChange={(c) => setIgnoreCase(c as boolean)}
								/>
								{t("splitWordDialog.ignoreCase", "忽略大小写")}
							</Flex>
						</Text>
					</Flex>
				</Flex>

				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button onClick={handleSplit}>
							{t("splitWordDialog.actionButton", "执行")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
