import { BookOpen24Regular, DismissRegular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	Progress,
	Text,
} from "@radix-ui/themes";
import { AnimatePresence, motion } from "framer-motion";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { BrandBandMark, brandBandClassName } from "$/components/BrandBand";
import { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import { useLoadAudio } from "$/hooks/useLoadAudio";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentDurationAtom } from "$/modules/audio/states";
import {
	ImportSourceCards,
	type ImportSourceId,
} from "$/modules/lyrics-import/components/ImportSourceCards";
import { openImportLyricsAtom } from "$/modules/lyrics-import/states";
import { type ExportTranslation, saveTTML } from "$/modules/project/ttml-save";
import { geniusApiKeyAtom } from "$/modules/settings/states";
import {
	metadataEditorDialogAtom,
	settingsDialogAtom,
	settingsTabAtom,
} from "$/states/dialogs";
import { ToolMode, toolModeAtom } from "$/states/main";
import {
	GUIDE_STEP_IDS,
	getGuideProgress,
	getGuideStepNumber,
	getGuideUrl,
	getWordTimingProgress,
	hasCompleteTiming,
	hasImportedLyrics,
	hasNoEmptyLyricLines,
	hasSongwriters,
} from "./logic";
import {
	exitBeginnerGuideAtom,
	guideCompletionAtom,
	guideExportedAtom,
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "./states";

const GUIDE_COPY = {
	intro: {
		title: "Read the full guide first",
		text: "This built-in guide is a hands-on companion to the full TTML guide. Read the full guide for the concepts, then keep this panel open while you apply them in the editor.",
	},
	audio: {
		title: "Import the song",
		text: "Choose the exact recording you are making lyrics for. The guide will continue once the audio finishes loading.",
	},
	lyrics: {
		title: "Import the lyrics",
		text: "Choose a lyrics source below. It opens the import screen, where you can switch between Paste, LRCLIB and Genius at the top, clean up the text and import it.",
	},
	review: {
		title: "Check lyrics and line types",
		text: "Read every line against the recording. Double-click words to fix them; select lines to mark background or duet vocals. Remove empty lines, then confirm below.",
	},
	sync: {
		title: "Sync every word",
		text: "Enter Time mode, select the first word, press Space, then use F to start, G between words, and H at pauses or line endings. Every word must receive a valid time.",
	},
	songwriters: {
		title: "Add songwriters",
		text: "Open metadata and use Find songwriters, or type each songwriter's real name. The guide detects when at least one is saved.",
	},
	export: {
		title: "Export the TTML",
		text: "Save the finished TTML. This step completes only after a file is actually written.",
	},
	test: {
		title: "Test locally",
		text: "Upload the saved file in Spicy Lyrics and check parsing, formatting, and timing.",
	},
} as const;

export const startBeginnerGuide = (
	setWelcome: (open: boolean) => void,
	setPanel: (open: boolean) => void,
	setStep: (step: number) => void,
) => {
	setWelcome(false);
	setStep(0);
	setPanel(true);
};

export const BeginnerGuide = () => {
	const { t } = useTranslation();
	const exportT = useCallback<ExportTranslation>(
		(key, fallback, options) => t(key, fallback ?? key, options),
		[t],
	);
	const store = useStore();
	const duration = useAtomValue(currentDurationAtom);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const [showGeniusSetup, setShowGeniusSetup] = useState(false);
	const [welcomeOpen, setWelcomeOpen] = useAtom(guideWelcomeOpenAtom);
	const [panelOpen, setPanelOpen] = useAtom(guidePanelOpenAtom);
	const lyrics = useLyricLinesWhileOpen(welcomeOpen || panelOpen);
	const [step, setStep] = useAtom(guideStepAtom);
	const [exported, setExported] = useAtom(guideExportedAtom);
	const [completion, setCompletion] = useAtom(guideCompletionAtom);
	const [tucked, setTucked] = useState(false);
	const [position, setPosition] = useState(() => ({
		x: Math.max(8, window.innerWidth - 336),
		y: 200,
	}));
	const dragOffset = useRef({ x: 0, y: 0 });
	const openImport = useSetAtom(openImportLyricsAtom);
	const setMetadata = useSetAtom(metadataEditorDialogAtom);
	const setToolMode = useSetAtom(toolModeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const { loadAudio: pickAudio } = useLoadAudio();
	const { onOpenFile } = useTopMenuActions();
	const exitGuide = useSetAtom(exitBeginnerGuideAtom);
	const timingProgress = getWordTimingProgress(lyrics);

	useEffect(() => {
		const keepOnScreen = () =>
			setPosition((current) => ({
				x: Math.min(
					Math.max(8, current.x),
					Math.max(8, window.innerWidth - 328),
				),
				y: Math.min(
					Math.max(8, current.y),
					Math.max(8, window.innerHeight - 80),
				),
			}));
		window.addEventListener("resize", keepOnScreen);
		return () => window.removeEventListener("resize", keepOnScreen);
	}, []);

	const startDragging = useCallback(
		(event: ReactPointerEvent<HTMLElement>) => {
			if ((event.target as HTMLElement).closest("button, a")) return;
			event.preventDefault();
			dragOffset.current = {
				x: event.clientX - position.x,
				y: event.clientY - position.y,
			};
			const move = (moveEvent: PointerEvent) => {
				setPosition({
					x: Math.min(
						Math.max(8, moveEvent.clientX - dragOffset.current.x),
						Math.max(8, window.innerWidth - 328),
					),
					y: Math.min(
						Math.max(8, moveEvent.clientY - dragOffset.current.y),
						Math.max(8, window.innerHeight - 80),
					),
				});
			};
			const stop = () => {
				window.removeEventListener("pointermove", move);
				window.removeEventListener("pointerup", stop);
			};
			window.addEventListener("pointermove", move);
			window.addEventListener("pointerup", stop, { once: true });
		},
		[position.x, position.y],
	);

	useEffect(() => {
		if (completion !== "new") return;
		setCompletion("dismissed");
		setWelcomeOpen(true);
	}, [completion, setCompletion, setWelcomeOpen]);

	const start = useCallback(() => {
		setExported(false);
		startBeginnerGuide(setWelcomeOpen, setPanelOpen, setStep);
	}, [setExported, setPanelOpen, setStep, setWelcomeOpen]);

	const openExisting = useCallback(() => {
		void onOpenFile();
		setCompletion("dismissed");
		setWelcomeOpen(false);
	}, [onOpenFile, setCompletion, setWelcomeOpen]);

	const stepComplete = useMemo(() => {
		const id = GUIDE_STEP_IDS[step];
		if (id === "audio") return duration > 0 || audioEngine.musicLoaded;
		if (id === "lyrics") return hasImportedLyrics(lyrics);
		if (id === "review") return false;
		if (id === "sync") return hasCompleteTiming(lyrics);
		if (id === "songwriters") return hasSongwriters(lyrics);
		if (id === "export") return exported;
		return false;
	}, [duration, exported, lyrics, step]);

	const openImportSource = useCallback(
		(source: ImportSourceId) => {
			if (source === "genius" && !geniusApiKey) setShowGeniusSetup(true);
			else openImport(source);
		},
		[geniusApiKey, openImport],
	);

	const doAction = useCallback(async () => {
		const id = GUIDE_STEP_IDS[step];
		if (id === "audio") pickAudio();
		if (id === "review") {
			setToolMode(ToolMode.Edit);
			if (hasNoEmptyLyricLines(lyrics)) setStep(step + 1);
		}
		if (id === "sync") setToolMode(ToolMode.Sync);
		if (id === "songwriters") setMetadata(true);
		if (id === "export") {
			await saveTTML(store, exportT, { onSaved: () => setExported(true) });
		}
		if (id === "test")
			window.open(getGuideUrl("test"), "_blank", "noopener,noreferrer");
	}, [
		lyrics,
		pickAudio,
		setExported,
		setMetadata,
		setStep,
		setToolMode,
		step,
		store,
		exportT,
	]);

	const finish = () => {
		setCompletion("completed");
		setPanelOpen(false);
	};
	const continueGuide = () => {
		if (step < GUIDE_STEP_IDS.length - 1) setStep(step + 1);
	};

	const currentId = GUIDE_STEP_IDS[Math.min(step, GUIDE_STEP_IDS.length - 1)];
	const copy = GUIDE_COPY[currentId];
	const stepNumber = getGuideStepNumber(step);
	const waitingKey =
		currentId === "review" && !hasNoEmptyLyricLines(lyrics)
			? "beginnerGuide.steps.review.waitingEmptyLines"
			: `beginnerGuide.steps.${currentId}.waiting`;
	const waitingText =
		currentId === "intro"
			? "Read the full guide, then continue when you are ready to begin."
			: currentId === "audio"
				? "Use “Choose audio” below, then wait for loading to finish."
				: currentId === "lyrics"
					? "Choose a source below and import the lyrics from the import screen."
					: currentId === "review"
						? hasNoEmptyLyricLines(lyrics)
							? "The structure is valid. Finish reading the lyrics, then confirm your review."
							: "At least one empty lyric line remains. Delete or fill it before confirming."
						: currentId === "sync"
							? "Open Time mode and keep timing; this completes when every applicable word has a valid start and end."
							: currentId === "songwriters"
								? "Open metadata and add at least one songwriter."
								: currentId === "export"
									? "Choose Save TTML and complete the file picker."
									: "Open the local testing instructions, verify the file in Spicy Lyrics, then finish the guide.";

	useEffect(() => {
		if (!panelOpen) return;
		const ribbon = document.querySelector('[data-guide-target="ribbon"]');
		if (ribbon) {
			const bottom = ribbon.getBoundingClientRect().bottom + 12;
			setPosition((current) => ({
				...current,
				y: Math.max(current.y, bottom),
			}));
		}
		const selector =
			currentId === "audio"
				? '[data-guide-target="audio"]'
				: currentId === "review"
					? '[data-guide-target="editor"]'
					: currentId === "sync"
						? '[data-guide-target="ribbon"]'
						: undefined;
		if (!selector) return;
		const target = document.querySelector<HTMLElement>(selector);
		if (!target) return;
		const previousOutline = target.style.outline;
		const previousOffset = target.style.outlineOffset;
		target.style.outline = "3px solid var(--accent-9)";
		target.style.outlineOffset = "-3px";
		target.scrollIntoView({ behavior: "smooth", block: "nearest" });
		return () => {
			target.style.outline = previousOutline;
			target.style.outlineOffset = previousOffset;
		};
	}, [currentId, panelOpen]);

	return (
		<>
			<Dialog.Root open={welcomeOpen} onOpenChange={setWelcomeOpen}>
				<Dialog.Content maxWidth="560px" className={brandBandClassName}>
					<BrandBandMark />
					<Dialog.Title>
						{t("beginnerGuide.welcome.title", "Make your first synced TTML")}
					</Dialog.Title>
					<Dialog.Description>
						{t(
							"beginnerGuide.welcome.description",
							"The guide stays with you, opens the right tools, and waits until each required task is actually complete.",
						)}
					</Dialog.Description>
					<Flex direction="column" gap="2" mt="4">
						<Button size="3" onClick={start}>
							{t("beginnerGuide.welcome.own", "Guide me through my first TTML")}
						</Button>
						<Button variant="outline" onClick={openExisting}>
							{t("beginnerGuide.welcome.open", "Open lyrics file")}
						</Button>
						<Button
							variant="ghost"
							color="gray"
							onClick={() => {
								setCompletion("dismissed");
								setWelcomeOpen(false);
							}}
						>
							{t("beginnerGuide.welcome.skip", "Skip for now")}
						</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
			<AnimatePresence>
				{panelOpen && tucked && (
					<motion.div
						key="tucked-button"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						style={{
							position: "fixed",
							right: 0,
							top: "45%",
							zIndex: 10000,
							paddingLeft: "40px",
							paddingTop: "10px",
							paddingBottom: "10px",
							transition:
								"transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s",
							transform: "translateX(60%)",
							opacity: 0.7,
							cursor: "pointer",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateX(0)";
							e.currentTarget.style.opacity = "1";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateX(60%)";
							e.currentTarget.style.opacity = "0.7";
						}}
					>
						<Button
							style={{
								borderRadius: "var(--radius-3) 0 0 var(--radius-3)",
								boxShadow: "var(--shadow-4)",
								cursor: "pointer",
							}}
							onClick={() => setTucked(false)}
						>
							<BookOpen24Regular style={{ marginRight: "4px" }} />
							{t("beginnerGuide.restore", "Show guide")}
						</Button>
					</motion.div>
				)}
				{panelOpen && !tucked && (
					<motion.div
						key="guide-card"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{ duration: 0.2 }}
						style={{
							position: "fixed",
							left: position.x,
							top: position.y,
							width: 320,
							zIndex: 10000,
						}}
					>
						<Card
							data-beginner-guide
							style={{
								width: "100%",
								boxShadow: "var(--shadow-5)",
								backgroundColor: "var(--color-panel-solid)",
								backdropFilter: "none",
								maxHeight: `calc(100vh - ${position.y + 12}px)`,
								overflowY: "auto",
							}}
						>
							<Flex direction="column" gap="3">
								<Flex
									justify="between"
									align="center"
									onPointerDown={startDragging}
									style={{
										cursor: "grab",
										userSelect: "none",
										touchAction: "none",
									}}
								>
									<Text size="1" color="gray">
										{t("beginnerGuide.progress", "Step {current} of {total}", {
											current: stepNumber.current,
											total: stepNumber.total,
										})}
									</Text>
									<Flex gap="1">
										<Button
											size="1"
											variant="ghost"
											color="gray"
											onClick={() => setTucked(true)}
										>
											{t("beginnerGuide.tuck", "Tuck")}
										</Button>
										<Button
											size="1"
											variant="ghost"
											color="gray"
											onClick={exitGuide}
										>
											<DismissRegular /> {t("beginnerGuide.exit", "Exit guide")}
										</Button>
									</Flex>
								</Flex>
								<Progress value={getGuideProgress(step)} />
								{currentId === "sync" && (
									<Text size="2" role="status">
										{t(
											"beginnerGuide.sync.wordProgress",
											"{timed} / {total} words timed",
											timingProgress,
										)}
									</Text>
								)}
								<Box>
									<Heading size="4">
										{t(`beginnerGuide.steps.${currentId}.title`, copy.title)}
									</Heading>
									<Text size="2" color="gray">
										{t(
											`beginnerGuide.steps.${currentId}.description`,
											copy.text,
										)}
									</Text>
									{currentId === "intro" && (
										<Box
											mt="2"
											p="2"
											style={{
												borderLeft: "2px solid var(--accent-8)",
												background: "var(--gray-a3)",
												borderRadius: "var(--radius-1)",
											}}
										>
											<Text
												size="1"
												weight="bold"
												style={{
													display: "block",
													marginBottom: "2px",
													color: "var(--accent-11)",
												}}
											>
												{t(
													"beginnerGuide.beforeStart.title",
													"Before you start:",
												)}
											</Text>
											<Text size="1" color="gray">
												{t(
													"beginnerGuide.beforeStart.text",
													"You can change how the editor looks to suit you. Click below to open the settings. Try the simple layout, or switch to the advanced layout for full control.",
												)}{" "}
												<a
													href="#"
													onClick={(e) => {
														e.preventDefault();
														setSettingsTab("appearance");
														setSettingsOpen(true);
													}}
													style={{
														color: "var(--accent-11)",
														textDecoration: "underline",
														fontWeight: "bold",
													}}
												>
													{t(
														"beginnerGuide.beforeStart.link",
														"Customize editor appearance",
													)}
												</a>
											</Text>
										</Box>
									)}
								</Box>
								<Card
									variant="surface"
									style={{
										background: stepComplete
											? "var(--green-3)"
											: "var(--accent-3)",
									}}
								>
									<Text size="2" weight="medium">
										{stepComplete
											? t(
													"beginnerGuide.status.complete",
													"Done. The tool detected that this step is complete.",
												)
											: t(waitingKey, waitingText)}
									</Text>
								</Card>
								{currentId === "lyrics" && !stepComplete && (
									<ImportSourceCards compact onSelect={openImportSource} />
								)}
								<Flex gap="1" justify="between" align="center">
									<Button
										size="2"
										variant="soft"
										disabled={step === 0}
										onClick={() => setStep(Math.max(0, step - 1))}
									>
										{t("common.back", "Back")}
									</Button>
									<Button
										size="2"
										variant="ghost"
										onClick={() =>
											window.open(
												getGuideUrl(currentId),
												"_blank",
												"noopener,noreferrer",
											)
										}
									>
										<BookOpen24Regular />{" "}
										{t("beginnerGuide.readMore", "Full guide")}
									</Button>
									{currentId === "intro" || stepComplete ? (
										<Button
											size="2"
											color={stepComplete ? "green" : undefined}
											onClick={continueGuide}
										>
											{t("beginnerGuide.continue", "Continue")}
										</Button>
									) : currentId === "lyrics" ? null : (
										<Button size="2" onClick={() => void doAction()}>
											{currentId === "review"
												? t(
														"beginnerGuide.review.confirm",
														"I checked the lyrics",
													)
												: currentId === "test"
													? t("beginnerGuide.test.open", "Open testing steps")
													: currentId === "audio"
														? t("beginnerGuide.audio.choose", "Choose audio")
														: currentId === "sync"
															? t("beginnerGuide.sync.open", "Open Time mode")
															: currentId === "songwriters"
																? t(
																		"beginnerGuide.songwriters.open",
																		"Open metadata",
																	)
																: t("beginnerGuide.export.save", "Save TTML")}
										</Button>
									)}
								</Flex>
								{currentId === "lyrics" && showGeniusSetup && !geniusApiKey && (
									<Card variant="surface">
										<Flex direction="column" gap="2">
											<Flex justify="between" align="center">
												<Text weight="bold">
													{t(
														"beginnerGuide.genius.title",
														"Create a Genius access token",
													)}
												</Text>
												<Button
													size="1"
													variant="ghost"
													color="gray"
													aria-label={t("common.close", "Close")}
													onClick={() => setShowGeniusSetup(false)}
												>
													<DismissRegular />
												</Button>
											</Flex>
											<Text size="2">
												{t(
													"beginnerGuide.genius.step1",
													"1. Open Genius API Clients and sign in.",
												)}
											</Text>
											<Text size="2">
												{t(
													"beginnerGuide.genius.step2",
													"2. Select New API Client, give it any recognizable app name, and fill the required app website field.",
												)}
											</Text>
											<Text size="2">
												{t(
													"beginnerGuide.genius.step3",
													"3. Save the client, then select Generate Access Token.",
												)}
											</Text>
											<Text size="2">
												{t(
													"beginnerGuide.genius.step4",
													"4. Copy the Client Access Token, not the Client ID or Client Secret.",
												)}
											</Text>
											<Text size="1" color="gray">
												{t(
													"beginnerGuide.genius.reuse",
													"The tool stores this token locally and reuses it for lyric imports and songwriter lookup.",
												)}
											</Text>
											<Flex gap="2" wrap="wrap">
												<Button
													variant="soft"
													onClick={() =>
														window.open(
															"https://genius.com/api-clients",
															"_blank",
															"noopener,noreferrer",
														)
													}
												>
													{t(
														"beginnerGuide.genius.openPortal",
														"Open Genius API Clients",
													)}
												</Button>
												<Button onClick={() => openImport("genius")}>
													{t(
														"beginnerGuide.genius.paste",
														"Paste token in Genius import",
													)}
												</Button>
											</Flex>
										</Flex>
									</Card>
								)}
								{currentId === "test" && (
									<Button color="green" onClick={finish}>
										{t("beginnerGuide.finish", "Finish guide")}
									</Button>
								)}
							</Flex>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
};
