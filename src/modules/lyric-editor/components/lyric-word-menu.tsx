import { TextTRegular } from "@fluentui/react-icons";
import { ContextMenu } from "@radix-ui/themes";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { MenuIconRow } from "$/components/MenuIconRow";
import { SlIcon } from "$/components/SlIcon";
import { segmentationEngineAtom } from "$/modules/segmentation/states";
import { segmentSelectedWords } from "$/modules/segmentation/utils/segmentation";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	combineWordsDialogAtom,
	replaceRomanizationDialogAtom,
	replaceWordCombinationDialogAtom,
	replaceWordDialogAtom,
	splitWordDialogAtom,
} from "$/states/dialogs";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { type LyricLine, type LyricWord, newLyricLine } from "$/types/ttml";
import {
	combineWordsApplyToAllAtom,
	combineWordsIgnoreCaseAtom,
} from "../tools/combine-words-options";
import { getWordCombinationSelection } from "../tools/replace-word-combination";
import {
	combineMatchingWordSequences,
	combineSelectedWords,
	getCombineWordSelection,
} from "../utils/combine-words";
import {
	deleteWordsFromLines,
	normalizeLineTime,
} from "../utils/normalize-line-time";
import { insertLinesInSection } from "../utils/section-system";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);
const selectedWordsSizeAtom = atom((get) => get(selectedWordsAtom).size);

export const LyricWordMenu = ({
	wordIndex,
	wordAtom,
	lineIndex,
}: {
	wordIndex: number;
	wordAtom: Atom<LyricWord>;
	lineIndex: number;
}) => {
	const { t } = useTranslation();

	const store = useStore();
	const selectedWordsSize = useAtomValue(selectedWordsSizeAtom);
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setOpenReplaceWordDialog = useSetAtom(replaceWordDialogAtom);
	const setReplaceWordCombinationDialog = useSetAtom(
		replaceWordCombinationDialogAtom,
	);
	const setReplaceRomanizationDialog = useSetAtom(
		replaceRomanizationDialogAtom,
	);
	const setCombineWordsDialog = useSetAtom(combineWordsDialogAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);
	const word = useAtomValue(wordAtom);
	const combineApplyToAll = useAtomValue(combineWordsApplyToAllAtom);
	const combineIgnoreCase = useAtomValue(combineWordsIgnoreCaseAtom);
	const combineShiftClickRef = useRef(false);
	const segmentationEngine = useAtomValue(segmentationEngineAtom);
	const { config: segmentationConfig, isLoading: segmentationLoading } =
		useSegmentationConfig();
	// Read when the menu renders: words on different lines or with gaps can't
	// be replaced as one combination, so the item greys out instead of opening.
	const wordCombination =
		selectedWordsSize > 1
			? getWordCombinationSelection(
					store.get(lyricLinesAtom).lyricLines,
					store.get(selectedWordsAtom),
				)
			: null;

	return (
		<>
			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => {
					setEditingWordState({
						wordIndex,
						lineIndex,
						word: word.word,
					});
					setOpenSplitWordDialog(true);
				}}
			>
				{t("contextMenu.splitWord", "拆分单词…")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={selectedWordsSize === 0 || segmentationLoading}
				onSelect={() => {
					const selectedWordIds = store.get(selectedWordsAtom);
					let splitCount = 0;
					editLyricLines((state) => {
						splitCount = segmentSelectedWords(
							state.lyricLines,
							selectedWordIds,
							{
								...segmentationConfig,
								engine: segmentationEngine,
								splitEnglish: segmentationEngine !== "none",
							},
						);
					});
					if (splitCount === 0) {
						toast.info(
							t(
								"contextMenu.autoSegmentWordsNothing",
								"Nothing to split in the selected words.",
							),
						);
					}
				}}
			>
				{t("contextMenu.autoSegmentWords", {
					count: selectedWordsSize,
					defaultValue: "Auto-segment selected words",
				})}
			</ContextMenu.Item>
			{/* One row for both replaces, like Line role: the word (or the
			    selected words together) and its romanization. */}
			<MenuIconRow label={t("contextMenu.replace", "Replace")}>
				{selectedWordsSize > 1 ? (
					<MenuIconRow.Action
						icon={<TextTRegular />}
						label={t(
							"replaceWordCombinationDialog.title",
							"Replace word combination",
						)}
						disabled={!wordCombination}
						onSelect={() => {
							setReplaceWordCombinationDialog({
								open: true,
								selection: wordCombination,
							});
						}}
					/>
				) : (
					<MenuIconRow.Action
						icon={<TextTRegular />}
						label={t("contextMenu.replaceWord", "替换单词…")}
						disabled={selectedWordsSize !== 1}
						onSelect={() => {
							setEditingWordState({
								wordIndex,
								lineIndex,
								word: word.word,
							});
							setOpenReplaceWordDialog(true);
						}}
					/>
				)}
				<MenuIconRow.Action
					icon={<SlIcon name="romanization" />}
					label={t("contextMenu.replaceRomanization", "Replace Romanization…")}
					disabled={selectedWordsSize !== 1}
					onSelect={() => {
						setReplaceRomanizationDialog({
							open: true,
							lineIndex,
							wordIndex,
						});
					}}
				/>
			</MenuIconRow>
			<ContextMenu.Item
				disabled={!(selectedWordsSize > 1 && selectedLinesSize === 1)}
				onPointerDown={(event) => {
					combineShiftClickRef.current = event.shiftKey;
				}}
				onPointerCancel={() => {
					combineShiftClickRef.current = false;
				}}
				onSelect={() => {
					const combineImmediately = combineShiftClickRef.current;
					combineShiftClickRef.current = false;
					if (combineImmediately) {
						editLyricLines((state) => {
							const sourceLine = state.lyricLines[lineIndex];
							if (!sourceLine) return;

							const selectedWordIds = store.get(selectedWordsAtom);
							const selection = getCombineWordSelection(
								sourceLine.words,
								selectedWordIds,
							);
							if (!selection) return;

							if (combineApplyToAll && selection.isContiguous) {
								for (const line of state.lyricLines) {
									line.words = combineMatchingWordSequences(
										line.words,
										selection.words,
										combineIgnoreCase,
									);
								}
							} else {
								sourceLine.words = combineSelectedWords(
									sourceLine.words,
									selectedWordIds,
								);
							}
						});
						return;
					}
					setCombineWordsDialog({ open: true, lineIndex });
				}}
			>
				{t("contextMenu.combineWords", "合并单词")}
				<span style={{ marginLeft: "auto", color: "var(--gray-9)" }}>
					Shift+click
				</span>
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => {
					editLyricLines((state) => {
						deleteWordsFromLines(
							state.lyricLines,
							store.get(selectedWordsAtom),
						);
					});
				}}
			>
				{t("contextMenu.deleteWords", {
					count: selectedWordsSize,
					defaultValue: "删除选定单词",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />

			<ContextMenu.Item
				disabled={selectedWordsSize !== 1}
				onSelect={() => afterToNewLine()}
			>
				{t(
					"contextMenu.moveFollowingWordToNewLine",
					"Move following words to new line",
				)}
			</ContextMenu.Item>

			<ContextMenu.Item
				disabled={selectedWordsSize === 0}
				onSelect={() => selectedToNewLine()}
			>
				{t("contextMenu.moveWordToNewLine", {
					count: selectedWordsSize,
					defaultValue: "所选单词拆至新行",
				})}
			</ContextMenu.Item>

			<ContextMenu.Separator />
		</>
	);

	function selectedToNewLine() {
		editLyricLines((state) => {
			const selectedWordIds = store.get(selectedWordsAtom);
			const selectedWords: LyricWord[] = [];
			const affectedLines: LyricLine[] = [];
			for (const line of state.lyricLines) {
				const deletedAtBounds =
					line.words.length > 0 &&
					(selectedWordIds.has(line.words[0].id) ||
						selectedWordIds.has(line.words[line.words.length - 1].id));
				line.words = line.words.filter((w) => {
					if (selectedWordIds.has(w.id)) {
						selectedWords.push(w);
						affectedLines.push(line);
						return false;
					}
					return true;
				});
				if (deletedAtBounds) normalizeLineTime(line);
			}
			const newLine = {
				...newLyricLine(),
				isBG: state.lyricLines[lineIndex].isBG,
				isDuet: state.lyricLines[lineIndex].isDuet,
			} as LyricLine;
			newLine.words.push(...selectedWords);
			normalizeLineTime(newLine);
			insertLinesInSection(
				state,
				lineIndex + 1,
				[newLine],
				state.lyricLines[lineIndex].sectionId,
			);
		});
	}

	function afterToNewLine() {
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			const word = line.words[wordIndex];
			if (!word) return;
			if (/^\s*$/.test(word.word) && !word.startTime && !word.endTime)
				line.words.splice(wordIndex, 1);
			const wordsToMove = line.words.splice(wordIndex);
			const newLine = {
				...newLyricLine(),
				isBG: line.isBG,
				isDuet: line.isDuet,
			} as LyricLine;
			newLine.words.push(...wordsToMove);
			normalizeLineTime(line);
			normalizeLineTime(newLine);
			insertLinesInSection(state, lineIndex + 1, [newLine], line.sectionId);
		});
	}
};
