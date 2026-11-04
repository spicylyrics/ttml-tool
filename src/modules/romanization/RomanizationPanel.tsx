import {
	ChevronRight16Regular,
	DocumentText20Regular,
	ErrorCircle16Regular,
	LocalLanguage16Regular,
	Sparkle20Regular,
} from "@fluentui/react-icons";
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
import { ChoiceTiles } from "$/components/ChoiceTiles";
import { OptionPicker } from "$/components/OptionPicker";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { alignRomanizedPage } from "./align-romanized";
import {
	getLoadedJapaneseTokenizer,
	loadJapaneseTokenizer,
	needsJapaneseDictionary,
	romanizeJapaneseLine,
} from "./engines/japanese";
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
	const [optionsOpen, setOptionsOpen] = useState(false);

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

	const romanizeFromPage = async () => {
		const current = store.get(lyricLinesAtom).lyricLines;
		// The dictionary's readings place the page's romaji over runs of kanji.
		// Without it the page is still shared out, just by sound.
		const text = current
			.map((line) => line.words.map((word) => word.word).join(""))
			.join("\n");
		let tokenizer = getLoadedJapaneseTokenizer();
		if (!tokenizer && needsJapaneseDictionary(text)) {
			setBusy(true);
			tokenizer = await loadJapaneseTokenizer()
				.catch((error) => {
					console.warn("Japanese dictionary didn't load", error);
					return undefined;
				})
				.finally(() => setBusy(false));
		}
		const tk = tokenizer;
		const result = alignRomanizedPage(
			current,
			pasted,
			tk &&
				((line) =>
					romanizeJapaneseLine(
						tk,
						line.words.map((word) => word.word),
					)),
		);
		if (!result.ok) {
			setProblem(
				t(
					"romanizationPanel.pageMismatch",
					"This page doesn't match the lyrics. Check that it's the same song.",
				),
			);
			return;
		}
		const byId = new Map(current.map((line) => [line.id, line]));
		const updates = result.lines.flatMap((aligned) => {
			const line = byId.get(aligned.lineId);
			const update =
				line &&
				mergeLineRomanization(
					line,
					aligned.romanWords,
					mode,
					aligned.romanLine,
				);
			return update ? [update] : [];
		});
		apply(updates);
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
	const scopeName =
		scope === "selection" && selectedLineIds.size > 0
			? t(
					"romanizationPanel.scopeSelection",
					"{count, plural, one {# selected line} other {# selected lines}}",
					{ count: selectedLineIds.size },
				)
			: t("romanizationPanel.scopeSong", "Whole song");
	const nothingToRomanize = romanizable.length === 0;
	const canRun =
		!busy &&
		(source === "paste"
			? !!pasted.trim()
			: !!songLanguage && targets.length > 0);

	return (
		<>
			<Flex justify="between" align="center" gap="4">
				<Dialog.Title mb="0" trim="normal">
					{t("romanizationPanel.title", "Romanization")}
				</Dialog.Title>
				{!nothingToRomanize && (
					<Text size="2" color="gray" className={styles.count}>
						{t(
							"romanizationPanel.coverage",
							"{romanized} of {total} lines romanized",
							{ romanized: romanizedCount, total: romanizable.length },
						)}
					</Text>
				)}
			</Flex>
			{!nothingToRomanize && (
				<div
					className={styles.track}
					role="meter"
					aria-valuemin={0}
					aria-valuemax={romanizable.length}
					aria-valuenow={romanizedCount}
					aria-label={t("romanizationPanel.coverageLabel", "Lines romanized")}
				>
					<div
						className={styles.fill}
						style={{
							transform: `scaleX(${romanizedCount / romanizable.length})`,
						}}
					/>
				</div>
			)}
			<Dialog.Description size="2" color="gray" mt="3" mb="4">
				{nothingToRomanize
					? t(
							"romanizationPanel.empty",
							"Nothing to romanize. Romanization works for Japanese, Chinese, Cantonese, Korean, Cyrillic and Greek lyrics.",
						)
					: t(
							"romanizationPanel.description",
							"With romanization on, Spicy Lyrics shows each word's romanization in place of the lyrics.",
						)}
			</Dialog.Description>

			<Flex direction="column" gap="4">
				<ChoiceTiles<Source>
					label={sourceLabel}
					value={source}
					onValueChange={(value) => {
						setSource(value);
						setProblem("");
					}}
					choices={[
						{
							value: "auto",
							icon: <Sparkle20Regular />,
							title: t("romanizationPanel.sourceAuto", "Automatic"),
							detail: t("romanizationPanel.sourceAutoDetail", "On this device"),
						},
						{
							value: "paste",
							icon: <DocumentText20Regular />,
							title: t("romanizationPanel.sourcePaste", "From a lyric page"),
							detail: t(
								"romanizationPanel.sourcePasteDetail",
								"Genius or any romanized page",
							),
						},
					]}
				/>

				{source === "auto" ? (
					<Flex direction="column" gap="3">
						<button
							type="button"
							className={styles.disclosure}
							aria-expanded={optionsOpen}
							onClick={() => setOptionsOpen(!optionsOpen)}
						>
							<ChevronRight16Regular className={styles.chevron} />
							<Text size="2" weight="medium">
								{t("romanizationPanel.options", "Options")}
							</Text>
							{!optionsOpen && songLanguage && (
								<Text size="2" color="gray" truncate>
									{t(
										"romanizationPanel.optionsSummary",
										"{language}, {lines}",
										{
											language: languageName(songLanguage),
											lines: scopeName,
										},
									)}
								</Text>
							)}
						</button>
						{optionsOpen && (
							<div className={styles.options}>
								<div className={styles.field}>
									<Text size="2" as="div" color="gray">
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
													[
														"ja",
														"zh",
														"yue",
														"ko",
														"cyrillic",
														"greek",
													] as const
												).map((value) => ({
													value,
													label: languageName(value),
												})),
											]}
										/>
									</div>
								</div>
								<div className={styles.field}>
									<Text size="2" as="div" color="gray">
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
							</div>
						)}
					</Flex>
				) : (
					<Flex direction="column" gap="3">
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
								"Or paste a romanized lyric page. Its lines don't have to break where yours do, [Section] headers help it line up, and (parentheses) go to background lines.",
							)}
							aria-label={t(
								"romanizationPanel.pasteLabel",
								"Romanized lyric page",
							)}
							className={styles.page}
						/>
					</Flex>
				)}

				{existingInTargets > 0 && (
					<div className={styles.existing}>
						<Text size="2" color="gray">
							{existingLabel}
						</Text>
						<OptionPicker<ExistingMode>
							variant="segmented"
							size="1"
							label={existingLabel}
							value={mode}
							onValueChange={setMode}
							options={[
								{
									value: "fillEmpty",
									label: t("romanizationPanel.keepExisting", "Keep them"),
								},
								{
									value: "replace",
									label: t("romanizationPanel.replace", "Replace all"),
								},
							]}
						/>
					</div>
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
					{busy ? <Spinner size="1" /> : <LocalLanguage16Regular aria-hidden />}
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
