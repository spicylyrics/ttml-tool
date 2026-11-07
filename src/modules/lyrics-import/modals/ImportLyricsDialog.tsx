import { ArrowLeftRegular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	ScrollArea,
	Text,
	VisuallyHidden,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	useCallback,
	useDeferredValue,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { JoinedBackgroundReview } from "$/components/JoinedBackgroundReview";
import { LyricMarkupEditor } from "$/components/LyricMarkupEditor";
import { OptionPicker } from "$/components/OptionPicker";
import { currentDurationAtom, loadedAudioAtom } from "$/modules/audio/states";
import { applyReviewedSections } from "$/modules/lyric-editor/utils/section-system.ts";
import type { ImportSourceId } from "$/modules/lyrics-import/components/ImportSourceCards";
import {
	metadataValues,
	setMetadataValues,
} from "$/modules/project/logic/metadata-fields";
import { getAudioSearchQuery } from "$/modules/project/logic/song-metadata";
import {
	type JoinedBackgroundRow,
	prepareTextImport,
	replaceTextRows,
} from "$/modules/project/logic/text-to-lines";
import {
	applyConfirmedImportMetadataAtom,
	loadedAudioSongAtom,
} from "$/modules/project/song-metadata-state";
import { useJapaneseDictionary } from "$/modules/romanization/useJapaneseDictionary";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	geniusApiKeyAtom,
	normalizeApostrophesOnImportAtom,
	normalizeCyrillicEsOnImportAtom,
} from "$/modules/settings/states/index.ts";
import { findSongwritersToAdd } from "$/modules/songwriters/logic/lookup";
import { addSongwriters } from "$/modules/songwriters/logic/merge";
import { confirmDialogAtom, importLyricsDialogAtom } from "$/states/dialogs.ts";
import {
	isDirtyAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import { newLyricWord } from "$/types/ttml";
import {
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
} from "$/utils/apostrophe-normalization";
import { error as logError } from "$/utils/logging.ts";
import { ImportOptionsPanel } from "../components/ImportOptionsPanel";
import {
	OnlineResults,
	OnlineSearchBar,
	PickedTrack,
} from "../components/OnlineSearchPanel";
import { SectionReviewPanel } from "../components/SectionReviewPanel";
import {
	detectSections,
	importTextToLines,
	mergeReviewedSections,
	type ReviewedSection,
	segmentImportText,
	toSectionOverrides,
} from "../logic/import-text";
import { type ImportTrack, searchOnlineLyrics } from "../logic/online-sources";
import {
	bgLyricPrefixAtom,
	enableSpecialPrefixAtom,
	fetchImportedSongwritersAtom,
	importLyricsSourceAtom,
	importTextFormatAtom,
	processStepsAtom,
	wordSeparatorAtom,
} from "../states";
import { prioritizeMatchingTracks } from "../track-duration";
import styles from "./ImportLyricsDialog.module.css";

// Kept outside the dialog so closing it doesn't lose a draft.
const importTextAtom = atom("");
const originalTextAtom = atom<string | null>(null);
const pickedTrackAtom = atom<ImportTrack | null>(null);
const NO_JOINED_ROWS: JoinedBackgroundRow[] = [];

/**
 * The one import screen. Online sources only fill the text area and the song
 * details; parsing, sections and syllable splitting are the same for every source.
 */
export const ImportLyricsDialog = () => {
	const { t } = useTranslation();
	const store = useStore();
	const [isOpen, setIsOpen] = useAtom(importLyricsDialogAtom);
	const [source, setSource] = useAtom(importLyricsSourceAtom);
	const [text, setText] = useAtom(importTextAtom);
	const [originalText, setOriginalText] = useAtom(originalTextAtom);
	const [pickedTrack, setPickedTrack] = useAtom(pickedTrackAtom);
	const format = useAtomValue(importTextFormatAtom);
	// Starts from the Genius sections preference each time the screen opens.
	const [makeSections, setMakeSections] = useState(true);
	// Lines Process lyrics joined ad-libs on, with the text from before it ran.
	const [joined, setJoined] = useState<{
		source: string;
		rows: JoinedBackgroundRow[];
	} | null>(null);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const setWordSeparator = useSetAtom(wordSeparatorAtom);
	const setEnableSpecialPrefix = useSetAtom(enableSpecialPrefixAtom);
	const setBgLyricPrefix = useSetAtom(bgLyricPrefixAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const { config: segmentationConfig, isLoading: segmentationLoading } =
		useSegmentationConfig();
	// Process lyrics splits Japanese into words with the dictionary.
	const japaneseDictionary = useJapaneseDictionary(text);

	const [step, setStep] = useState<"edit" | "review">("edit");
	const [reviewed, setReviewed] = useState<ReviewedSection[]>([]);
	// Hides this dialog while the unsaved-changes prompt is up.
	const [confirming, setConfirming] = useState(false);

	// Online search
	const audio = useAtomValue(loadedAudioAtom);
	const audioSong = useAtomValue(loadedAudioSongAtom);
	const audioDuration = useAtomValue(currentDurationAtom) / 1000;
	const suggestedQuery = getAudioSearchQuery(
		audioSong?.audio === audio ? audioSong.song : {},
		audio instanceof File ? audio.name : "",
	);
	const prefilledQuery = useRef("");
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ImportTrack[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [showResults, setShowResults] = useState(false);
	const [loadingId, setLoadingId] = useState<ImportTrack["id"] | null>(null);
	const sortedResults = useMemo(
		() => prioritizeMatchingTracks(results, audioDuration),
		[results, audioDuration],
	);
	const onlineSource = source === "plainText" ? null : source;

	useEffect(() => {
		if (!isOpen) return;
		setStep("edit");
		setConfirming(false);
		setMakeSections(true);
	}, [isOpen]);

	// Tags can arrive after the dialog opens; only replace a query we filled in.
	useEffect(() => {
		if (!isOpen || hasSearched) return;
		const previous = prefilledQuery.current;
		setQuery((current) =>
			current === previous || !current ? suggestedQuery : current,
		);
		prefilledQuery.current = suggestedQuery;
	}, [hasSearched, isOpen, suggestedQuery]);

	const changeSource = (next: ImportSourceId) => {
		setSource(next);
		setResults([]);
		setHasSearched(false);
		setShowResults(next !== "plainText" && !text.trim());
	};

	const handleSearch = useCallback(async () => {
		if (!onlineSource || !query.trim()) return;
		setSearching(true);
		setHasSearched(true);
		setShowResults(true);
		setResults([]);
		try {
			setResults(await searchOnlineLyrics(onlineSource, query, geniusApiKey));
		} catch (e) {
			toast.error(
				t(
					"metadataDialog.fetchSongwriters.searchError",
					"Search failed: {error}",
					{ error: e instanceof Error ? e.message : String(e) },
				),
			);
		} finally {
			setSearching(false);
		}
	}, [geniusApiKey, onlineSource, query, t]);

	const handlePick = useCallback(
		async (track: ImportTrack) => {
			setLoadingId(track.id);
			try {
				const lyrics =
					track.lyrics?.trim() ||
					(track.fetchLyrics ? (await track.fetchLyrics()).trim() : "");
				if (!lyrics) {
					toast.info(
						t(
							"onlineImport.noLyricsLabel",
							"No lyrics available for this track.",
						),
					);
					return;
				}
				setText(lyrics);
				setOriginalText(null);
				setPickedTrack(track);
				setShowResults(false);
				setStep("edit");
			} catch (e) {
				toast.error(
					t(
						"metadataDialog.fetchSongwriters.fetchError",
						"Could not fetch lyrics: {error}",
						{ error: e instanceof Error ? e.message : String(e) },
					),
				);
			} finally {
				setLoadingId(null);
			}
		},
		[setOriginalText, setPickedTrack, setText, t],
	);

	// Text transforms keep the text from before the first one, to restore.
	const transformText = (next: string) => {
		if (next === text) return false;
		setOriginalText((current) => current ?? text);
		setText(next);
		return true;
	};

	const handleProcess = () => {
		const rows: JoinedBackgroundRow[] = [];
		transformText(
			prepareTextImport(text, true, store.get(processStepsAtom), rows),
		);
		if (rows.length) setJoined({ source: text, rows });
		// Process lyrics writes this format.
		setWordSeparator("\\");
		setEnableSpecialPrefix(true);
		setBgLyricPrefix("<");
		toast.success(
			t(
				"textImportDialog.processedSuccess",
				"Lyrics prepared for syllable syncing.",
			),
		);
	};

	const handleSplit = () => {
		const changed = transformText(
			segmentImportText(text, format, (word) =>
				segmentWord({ ...newLyricWord(), word }, segmentationConfig).map(
					(part) => part.word,
				),
			),
		);
		if (changed)
			toast.success(
				t(
					"importLyrics.splitDone",
					"Syllables marked. Check them before importing.",
				),
			);
		else toast.info(t("importLyrics.splitNothing", "Nothing to split."));
	};

	const handleRestore = () => {
		if (originalText === null) return;
		setText(originalText);
		setOriginalText(null);
	};

	const deferredText = useDeferredValue(text);
	const detectedSections = useMemo(
		() => detectSections(deferredText),
		[deferredText],
	);
	const willMakeSections = makeSections && detectedSections.length > 0;
	const markupFormat = useMemo(
		() => ({ ...format, makeSections }),
		[format, makeSections],
	);
	const lineCount = useMemo(() => {
		try {
			return importTextToLines(deferredText, format, willMakeSections).length;
		} catch {
			return 0;
		}
	}, [deferredText, format, willMakeSections]);

	// Keep review edits while the text under them changes.
	useEffect(() => {
		if (step !== "review") return;
		setReviewed((current) => mergeReviewedSections(current, detectedSections));
	}, [detectedSections, step]);

	const performImport = useCallback(
		async (sections: ReviewedSection[]) => {
			const lines = importTextToLines(text, format, willMakeSections);
			if (lines.length === 0) {
				toast.error(
					t(
						"metadataDialog.fetchSongwriters.noLyricsError",
						"No lyrics to import.",
					),
				);
				return;
			}
			const normalized = normalizeImportedLyricCyrillicEs(
				normalizeImportedLyricApostrophes(
					{ lyricLines: lines, metadata: [], sections: [] },
					store.get(normalizeApostrophesOnImportAtom),
				),
				store.get(normalizeCyrillicEsOnImportAtom),
			);
			// Song details already in the project stay; the import fills empty ones.
			const next = {
				...store.get(lyricLinesAtom),
				lyricLines: normalized.lyricLines,
				sections: [],
			};
			if (willMakeSections)
				applyReviewedSections(next, toSectionOverrides(sections));
			store.set(lyricLinesAtom, next);
			store.set(selectedLinesAtom, new Set([lines[0].id]));
			store.set(
				selectedWordsAtom,
				new Set(lines[0].words[0] ? [lines[0].words[0].id] : []),
			);

			const track = pickedTrack;
			if (track) {
				store.set(applyConfirmedImportMetadataAtom, {
					title: track.name,
					artist: track.artist,
					album: track.album,
					cover: track.cover,
				});
			}

			toast.success(
				t(
					"importLyrics.importSuccess",
					"{count, plural, one {Imported # line.} other {Imported # lines.}}",
					{ count: lines.length },
				),
			);
			setIsOpen(false);
			setText("");
			setOriginalText(null);
			setPickedTrack(null);

			// Runs after the dialog closes; adds to the songwriters, never replaces.
			if (track && store.get(fetchImportedSongwritersAtom)) {
				try {
					const existing = metadataValues(
						store.get(lyricLinesAtom).metadata,
						"songwriter",
					);
					const names = await findSongwritersToAdd(
						{
							title: track.name,
							artist: track.artist,
							geniusId:
								track.source === "genius" ? String(track.id) : undefined,
						},
						geniusApiKey,
						existing,
					);
					if (names.length) {
						// Re-read: the user may have edited while the lookup ran.
						const current = store.get(lyricLinesAtom);
						const metadata = current.metadata.map((entry) => ({
							...entry,
							value: [...entry.value],
						}));
						setMetadataValues(
							metadata,
							"songwriter",
							addSongwriters(metadataValues(metadata, "songwriter"), names),
						);
						store.set(lyricLinesAtom, { ...current, metadata });
					}
				} catch (e) {
					console.error("Songwriter lookup failed", e);
				}
			}
		},
		[
			format,
			geniusApiKey,
			pickedTrack,
			setIsOpen,
			setOriginalText,
			setPickedTrack,
			setText,
			store,
			t,
			text,
			willMakeSections,
		],
	);

	const confirmAndImport = (sections: ReviewedSection[]) => {
		const run = () => {
			setConfirming(false);
			performImport(sections).catch((e) => {
				toast.error(
					t(
						"importLyrics.importFailed",
						"Couldn't read these lyrics. Check the text and the text format settings.",
					),
				);
				logError(e);
			});
		};
		if (!store.get(isDirtyAtom)) {
			run();
			return;
		}
		setConfirming(true);
		setConfirmDialog({
			open: true,
			title: t("confirmDialog.importFile.title", "Import new lyrics?"),
			description: t(
				"confirmDialog.importFile.description",
				"This project has unsaved changes. Importing will replace its lyrics. Continue?",
			),
			onConfirm: run,
			onCancel: () => setConfirming(false),
		});
	};

	const handlePrimary = () => {
		if (step === "edit" && willMakeSections) {
			setReviewed(detectSections(text));
			setStep("review");
			return;
		}
		confirmAndImport(step === "review" ? reviewed : detectSections(text));
	};

	const sourceOptions = [
		{ value: "plainText" as const, label: t("importLyrics.paste", "Paste") },
		{
			value: "lrclib" as const,
			label: t("importChooser.options.lrclib.title", "LRCLIB"),
		},
		{
			value: "genius" as const,
			label: t("importChooser.options.genius.title", "Genius"),
		},
	];
	const resultsVisible =
		!!onlineSource &&
		showResults &&
		!(onlineSource === "genius" && !geniusApiKey);

	return (
		<Dialog.Root open={isOpen && !confirming} onOpenChange={setIsOpen}>
			<Dialog.Content className={styles.content} maxWidth="1120px">
				<Flex align="center" justify="between" gap="4" wrap="wrap">
					<Dialog.Title mb="0">
						{t("importLyrics.title", "Import lyrics")}
					</Dialog.Title>
					<OptionPicker
						variant="segmented"
						size="2"
						label={t("importLyrics.sourceLabel", "Lyrics source")}
						value={source}
						onValueChange={changeSource}
						options={sourceOptions}
					/>
				</Flex>
				<VisuallyHidden>
					<Dialog.Description>
						{t(
							"importLyrics.description",
							"Paste lyrics or find them online, tidy them up, then import.",
						)}
					</Dialog.Description>
				</VisuallyHidden>

				<div className={styles.body}>
					<Flex direction="column" gap="2" className={styles.main}>
						{onlineSource && (
							<OnlineSearchBar
								source={onlineSource}
								query={query}
								onQueryChange={setQuery}
								onSearch={handleSearch}
								searching={searching}
							/>
						)}
						{resultsVisible ? (
							<>
								<OnlineResults
									results={sortedResults}
									searching={searching}
									hasSearched={hasSearched}
									audioDuration={audioDuration}
									loadingId={loadingId}
									onPick={handlePick}
								/>
								{text.trim() && (
									<Button
										variant="ghost"
										color="gray"
										className={styles.backButton}
										onClick={() => setShowResults(false)}
									>
										<ArrowLeftRegular />
										{t("importLyrics.backToText", "Back to text")}
									</Button>
								)}
							</>
						) : (
							<>
								{onlineSource && hasSearched && (
									<Button
										variant="ghost"
										color="gray"
										className={styles.backButton}
										onClick={() => setShowResults(true)}
									>
										{t("importLyrics.showResults", "Show search results")}
									</Button>
								)}
								<LyricMarkupEditor
									value={text}
									onChange={setText}
									format={markupFormat}
									ariaLabel={t("importLyrics.textLabel", "Lyrics text")}
									placeholder={t(
										"importLyrics.textPlaceholder",
										"Paste lyrics here, one line per row. Section headers like [Chorus] go on their own row.",
									)}
								/>
							</>
						)}
						{pickedTrack && (
							<PickedTrack
								track={pickedTrack}
								onDrop={() => setPickedTrack(null)}
							/>
						)}
					</Flex>

					<ScrollArea type="auto" scrollbars="vertical" className={styles.side}>
						<div className={styles.sideInner}>
							{step === "review" ? (
								<SectionReviewPanel
									sections={reviewed}
									wordSeparator={format.wordSeparator}
									onChange={(occurrence, patch) =>
										setReviewed((current) =>
											current.map((section) =>
												section.occurrence === occurrence
													? { ...section, ...patch }
													: section,
											),
										)
									}
								/>
							) : (
								<ImportOptionsPanel
									headerCount={detectedSections.length}
									makeSections={makeSections}
									onMakeSectionsChange={setMakeSections}
									canProcess={!!text.trim() && !japaneseDictionary.loading}
									canRestore={originalText !== null}
									canSplit={
										!!text.trim() &&
										!!format.wordSeparator &&
										!segmentationLoading
									}
									showSongwriters={!!pickedTrack}
									onProcess={handleProcess}
									onSplit={handleSplit}
									onRestore={handleRestore}
								/>
							)}
						</div>
					</ScrollArea>
				</div>

				<Flex align="center" justify="between" gap="3">
					<Flex align="center" gap="4" minWidth="0">
						{willMakeSections && (
							<ol
								className={styles.steps}
								aria-label={t("importLyrics.stepsLabel", "Import steps")}
							>
								<li aria-current={step === "edit" ? "step" : undefined}>
									<span className={styles.stepNumber}>1</span>
									{t("importLyrics.stepText", "Edit text")}
								</li>
								<li aria-current={step === "review" ? "step" : undefined}>
									<span className={styles.stepNumber}>2</span>
									{t("importLyrics.reviewSections", "Review sections")}
								</li>
							</ol>
						)}
						<Text size="1" color="gray">
							{t(
								"genius.linesCount",
								"{count, plural, one {# line} other {# lines}}",
								{
									count: lineCount,
								},
							)}
						</Text>
					</Flex>
					<Flex gap="2">
						{step === "review" ? (
							<Button
								variant="soft"
								color="gray"
								onClick={() => setStep("edit")}
							>
								{t("common.back", "Back")}
							</Button>
						) : (
							<Dialog.Close>
								<Button variant="soft" color="gray">
									{t("common.cancel", "Cancel")}
								</Button>
							</Dialog.Close>
						)}
						<Button onClick={handlePrimary} disabled={lineCount === 0}>
							{step === "edit" && willMakeSections
								? t("importLyrics.reviewSections", "Review sections")
								: t("genius.importButton", "Import lyrics")}
						</Button>
					</Flex>
				</Flex>
				<JoinedBackgroundReview
					rows={joined?.rows ?? NO_JOINED_ROWS}
					onKeep={() => setJoined(null)}
					onApply={(edits) => {
						if (joined)
							setText(
								prepareTextImport(
									replaceTextRows(joined.source, edits),
									true,
									store.get(processStepsAtom),
								),
							);
						setJoined(null);
					}}
				/>
			</Dialog.Content>
		</Dialog.Root>
	);
};
