import { ErrorCircle16Regular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	Spinner,
	Text,
	TextArea,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ChoiceList } from "$/components/ChoiceList";
import { OptionPicker } from "$/components/OptionPicker";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { alignRomanizedPage } from "./align-romanized";
import {
	type ExistingMode,
	hasRomanization,
	isLineRomanized,
	type LineRomanization,
	mergeLineRomanization,
	romanizableLines,
	romanizeLines,
} from "./fill";
import { GeniusRomanizedFinder } from "./GeniusRomanizedFinder";
import {
	detectSongLanguage,
	lineLanguage,
	type RomanizationLanguage,
	type SongLanguage,
} from "./language";
import styles from "./RomanizationPanel.module.css";
import { romanizationPanelAtom } from "./states";

const lineIsJapanese = (line: LyricLine, songLanguage?: SongLanguage) =>
	!!songLanguage &&
	lineLanguage(line.words.map((word) => word.word).join(""), songLanguage) ===
		"ja";

type Source = "auto" | "paste";
type Scope = "song" | "selection";

/**
 * The one place to romanize a song: automatically or from a pasted page, for
 * the whole song or the selected lines. Writes each word's romanization (what
 * Spicy Lyrics shows) and keeps the line's romanization in step with it.
 */
export const RomanizationPanel = memo(() => {
	const [open, setOpen] = useAtom(romanizationPanelAtom);
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="560px">
				<PanelBody onClose={() => setOpen(false)} />
			</Dialog.Content>
		</Dialog.Root>
	);
});

// Mounted only while the dialog shows: its choices start fresh on each open,
// and it stops following lyric edits once closed.
const PanelBody = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const store = useStore();
	const lines = useAtomValue(lyricLinesAtom).lyricLines;
	const selectedLines = useAtomValue(selectedLinesAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);

	const [source, setSource] = useState<Source>("auto");
	const [language, setLanguage] = useState<RomanizationLanguage>("auto");
	// The editor nearly always has a line selected, so the whole song is the
	// default and a selection is something to pick on purpose.
	const [scope, setScope] = useState<Scope>("song");
	const [mode, setMode] = useState<ExistingMode>("fillEmpty");
	const [pasted, setPasted] = useState("");
	const [problem, setProblem] = useState("");
	const [busy, setBusy] = useState(false);

	const selectedLineIds = useMemo(() => {
		const ids = new Set(selectedLines);
		for (const line of lines)
			if (line.words.some((word) => selectedWords.has(word.id)))
				ids.add(line.id);
		return ids;
	}, [lines, selectedLines, selectedWords]);

	const detected = useMemo(() => detectSongLanguage(lines), [lines]);
	const songLanguage: SongLanguage | undefined =
		language === "auto" ? detected : language;

	const romanizable = useMemo(
		() => (songLanguage ? romanizableLines(lines, songLanguage) : []),
		[lines, songLanguage],
	);
	const romanizedCount = romanizable.filter(isLineRomanized).length;
	const targets: LyricLine[] =
		source === "auto" && scope === "selection" && selectedLineIds.size > 0
			? romanizable.filter((line) => selectedLineIds.has(line.id))
			: romanizable;
	const existingInTargets = targets.reduce(
		(count, line) =>
			count +
			line.words.filter((word) => hasRomanization(word.romanWord)).length,
		0,
	);

	const languageName = (value: SongLanguage) =>
		({
			ja: t("ribbonBar.editMode.romanization.ja", "Japanese (Romaji)"),
			zh: t("ribbonBar.editMode.romanization.zh", "Chinese (Pinyin)"),
			yue: t("ribbonBar.editMode.romanization.yue", "Cantonese (Jyutping)"),
			ko: t(
				"ribbonBar.editMode.romanization.ko",
				"Korean (Revised Romanization)",
			),
			cyrillic: t(
				"romanizationPanel.languageCyrillic",
				"Cyrillic (Russian, Ukrainian and others)",
			),
			greek: t("romanizationPanel.languageGreek", "Greek"),
		})[value];

	const apply = (updates: LineRomanization[]) => {
		const byLine = new Map(updates.map((update) => [update.lineId, update]));
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				const update = byLine.get(line.id);
				if (!update) continue;
				line.romanLyric = update.romanLyric;
				for (const word of line.words)
					word.romanWord = update.romanWords[word.id] ?? word.romanWord;
			}
		});
		if (updates.length > 0) {
			toast.success(
				t(
					"romanizationPanel.done",
					"{count, plural, one {Romanized # line.} other {Romanized # lines.}}",
					{ count: updates.length },
				),
			);
		} else {
			toast.info(
				t(
					"romanizationPanel.nothingChanged",
					"Nothing changed: those lines already have romanization.",
				),
			);
		}
	};

	const romanizeAutomatically = async () => {
		if (!songLanguage) return;
		setBusy(true);
		try {
			apply(await romanizeLines(targets, songLanguage, mode));
			onClose();
		} catch (error) {
			console.error(error);
			setProblem(
				t(
					"romanizationPanel.failed",
					"Romanization didn't load. Check your connection and try again.",
				),
			);
		} finally {
			setBusy(false);
		}
	};

	const romanizeFromPage = () => {
		const { lyricLines: current, sections } = store.get(lyricLinesAtom);
		const result = alignRomanizedPage(current, pasted, sections);
		if (!result.ok) {
			setProblem(
				result.firstDifference
					? t(
							"romanizationPanel.lineCountMismatchFrom",
							"The page has {received} lines and the lyrics have {expected}. They stop lining up in the section at line {line}.",
							{
								received: result.received,
								expected: result.expected,
								line: result.firstDifference.lineNumber,
							},
						)
					: t(
							"romanizationPanel.lineCountMismatch",
							"The page has {received} lines and the lyrics have {expected}. Add or remove lines so they match.",
							{ received: result.received, expected: result.expected },
						),
			);
			return;
		}
		if (result.lines.length === 0 && result.skipped.length > 0) {
			setProblem(
				t(
					"romanizationPanel.noSectionMatches",
					"No section has the same number of lines on the page and in the lyrics.",
				),
			);
			return;
		}
		const byId = new Map(current.map((line) => [line.id, line]));
		const updates = result.lines.flatMap((aligned) => {
			const line = byId.get(aligned.lineId);
			const update =
				line && mergeLineRomanization(line, aligned.romanWords, mode);
			return update ? [update] : [];
		});
		apply(updates);
		if (result.skipped.length > 0) {
			toast.warn(
				t(
					"romanizationPanel.skippedSections",
					"Left out the sections at lines {lines}: the page has a different number of lines there.",
					{
						lines: result.skipped
							.map((section) => section.lineNumber)
							.join(", "),
					},
				),
			);
		}
		const uncertain = [
			...new Set(
				result.lines
					.filter((line) => line.uncertain)
					.map((line) => line.lineNumber),
			),
		];
		if (uncertain.length > 0) {
			toast.warn(
				t(
					"romanizationPanel.check",
					"Some words were guessed. Check lines {lines}.",
					{ lines: uncertain.join(", ") },
				),
			);
		}
		onClose();
	};

	const sourceLabel = t("romanizationPanel.source", "Source");
	const languageLabel = t("romanizationPanel.language", "Language");
	const scopeLabel = t("romanizationPanel.scope", "Lines");
	const existingLabel = t(
		"romanizationPanel.existing",
		"{count, plural, one {# word already has romanization} other {# words already have romanization}}",
		{ count: existingInTargets },
	);
	const nothingToRomanize = romanizable.length === 0;
	const canRun =
		!busy &&
		(source === "paste"
			? !!pasted.trim()
			: !!songLanguage && targets.length > 0);

	return (
		<>
			<Dialog.Title>
				{t("romanizationPanel.title", "Romanization")}
			</Dialog.Title>
			<Dialog.Description size="2" color="gray" mb="4">
				{t(
					"romanizationPanel.description",
					"Spicy Lyrics shows romanization under each word. Fill it automatically or from a romanized lyric page, then fix anything odd by hand.",
				)}
			</Dialog.Description>

			<Flex direction="column" gap="4">
				{nothingToRomanize ? (
					<div className={styles.coverage}>
						<Text size="2">
							{t(
								"romanizationPanel.empty",
								"Nothing to romanize. Romanization works for Japanese, Chinese, Cantonese, Korean, Cyrillic and Greek lyrics.",
							)}
						</Text>
					</div>
				) : (
					<div className={styles.coverage}>
						<Flex justify="between" align="baseline" gap="3">
							<Text size="3" weight="medium" className={styles.count}>
								{t(
									"romanizationPanel.coverage",
									"{romanized} of {total} lines romanized",
									{ romanized: romanizedCount, total: romanizable.length },
								)}
							</Text>
							{songLanguage && (
								<Text size="2" color="gray">
									{languageName(songLanguage)}
								</Text>
							)}
						</Flex>
						<div
							className={styles.track}
							role="meter"
							aria-valuemin={0}
							aria-valuemax={romanizable.length}
							aria-valuenow={romanizedCount}
							aria-label={t(
								"romanizationPanel.coverageLabel",
								"Lines romanized",
							)}
						>
							<div
								className={styles.fill}
								style={{
									transform: `scaleX(${romanizedCount / romanizable.length})`,
								}}
							/>
						</div>
					</div>
				)}

				<div className={styles.field}>
					<Text size="2" as="div">
						{sourceLabel}
					</Text>
					<OptionPicker<Source>
						variant="segmented"
						fullWidth
						size="2"
						label={sourceLabel}
						value={source}
						onValueChange={(value) => {
							setSource(value);
							setProblem("");
						}}
						options={[
							{
								value: "auto",
								label: t("romanizationPanel.sourceAuto", "Automatic"),
							},
							{
								value: "paste",
								label: t("romanizationPanel.sourcePaste", "From a lyric page"),
							},
						]}
					/>
				</div>

				{source === "auto" ? (
					<>
						<div className={styles.field}>
							<Text size="2" as="div">
								{languageLabel}
							</Text>
							<div className={styles.start}>
								<OptionPicker<RomanizationLanguage>
									size="2"
									label={languageLabel}
									value={language}
									onValueChange={setLanguage}
									options={[
										{
											value: "auto",
											label: t("common.autoDetect", "Auto-detect"),
											description: detected
												? t(
														"romanizationPanel.detected",
														"Detected: {language}. Lines in another script still use their own.",
														{ language: languageName(detected) },
													)
												: undefined,
										},
										...(
											["ja", "zh", "yue", "ko", "cyrillic", "greek"] as const
										).map((value) => ({
											value,
											label: languageName(value),
										})),
									]}
								/>
							</div>
						</div>
						<div className={styles.field}>
							<Text size="2" as="div">
								{scopeLabel}
							</Text>
							<OptionPicker<Scope>
								variant="segmented"
								fullWidth
								size="2"
								label={scopeLabel}
								value={scope}
								onValueChange={setScope}
								options={[
									{
										value: "song",
										label: t("romanizationPanel.scopeSong", "Whole song"),
									},
									...(selectedLineIds.size > 0
										? [
												{
													value: "selection" as const,
													label: t(
														"romanizationPanel.scopeSelection",
														"{count, plural, one {# selected line} other {# selected lines}}",
														{ count: selectedLineIds.size },
													),
												},
											]
										: []),
								]}
							/>
						</div>
					</>
				) : (
					<Flex direction="column" gap="2">
						<GeniusRomanizedFinder
							onLyrics={(lyrics) => {
								setPasted(lyrics);
								setProblem("");
							}}
						/>
						<TextArea
							value={pasted}
							onChange={(event) => {
								setPasted(event.currentTarget.value);
								setProblem("");
							}}
							placeholder={t(
								"romanizationPanel.pastePlaceholder",
								"Or paste a romanized lyric page, one line per lyric line. [Section] headers line it up with your sections, and (parentheses) go to background lines.",
							)}
							aria-label={t(
								"romanizationPanel.pasteLabel",
								"Romanized lyric page",
							)}
							rows={10}
						/>
					</Flex>
				)}

				{existingInTargets > 0 && (
					<Flex direction="column" gap="2">
						<Text size="2" weight="medium">
							{existingLabel}
						</Text>
						<ChoiceList<ExistingMode>
							label={existingLabel}
							value={mode}
							onValueChange={setMode}
							choices={[
								{
									value: "fillEmpty",
									title: t(
										"romanizationPanel.fillEmpty",
										"Fill empty words only",
									),
									detail: t(
										"romanizationPanel.fillEmptyDesc",
										"Words you already romanized stay as they are",
									),
								},
								{
									value: "replace",
									title: t("romanizationPanel.replace", "Replace all"),
									detail: t(
										"romanizationPanel.replaceDesc",
										"Every word gets new romanization",
									),
								},
							]}
						/>
					</Flex>
				)}

				{busy && targets.some((line) => lineIsJapanese(line, songLanguage)) && (
					<Text size="2" color="gray" role="status">
						{t(
							"romanizationPanel.loadingDictionary",
							"Loading the Japanese dictionary. The first time takes a moment.",
						)}
					</Text>
				)}
				{problem && (
					<Flex gap="2" align="start" role="alert">
						<Text color="red" asChild>
							<ErrorCircle16Regular aria-hidden />
						</Text>
						<Text size="2" color="red">
							{problem}
						</Text>
					</Flex>
				)}
			</Flex>

			<Flex gap="3" mt="5" justify="end">
				<Dialog.Close>
					<Button variant="soft" color="gray">
						{t("common.cancel", "Cancel")}
					</Button>
				</Dialog.Close>
				<Button
					disabled={!canRun}
					onClick={
						source === "paste" ? romanizeFromPage : romanizeAutomatically
					}
				>
					{busy && <Spinner size="1" />}
					{source === "paste"
						? t("romanizationPanel.runPaste", "Romanize from page")
						: t(
								"romanizationPanel.run",
								"{count, plural, one {Romanize # line} other {Romanize # lines}}",
								{ count: targets.length },
							)}
				</Button>
			</Flex>
		</>
	);
};
