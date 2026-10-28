import {
	ArrowImportRegular,
	ChevronDownRegular,
	CopyRegular,
	SaveRegular,
	TextGrammarWandRegular,
} from "@fluentui/react-icons";
import {
	Button,
	DropdownMenu,
	Flex,
	Heading,
	Kbd,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type KeyboardEvent,
	memo,
	useCallback,
	useDeferredValue,
	useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LyricMarkupEditor } from "$/components/LyricMarkupEditor";
import { audioEngine } from "$/modules/audio/audio-engine";
import { playbackRateAtom } from "$/modules/audio/states";
import { stepPlaybackRate } from "$/modules/audio/utils/playback-rate";
import {
	importTextFormatAtom,
	openImportWithTextAtom,
} from "$/modules/lyrics-import/states";
import { ToolMode, toolModeAtom } from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import { error } from "$/utils/logging";
import {
	toGeniusText,
	toPlainText,
	transcriptStats,
} from "../logic/transcript-export";
import {
	TRANSCRIPTION_SEEK_SECONDS,
	type TranscriptionKeyAction,
	transcriptionKeyAction,
} from "../logic/transcription-keys";
import { transcriptTextAtom } from "../states";
import styles from "./TranscriptionWorkspace.module.css";

type ExportKind = "genius" | "plain";

const exportText = (kind: ExportKind, text: string) =>
	kind === "genius" ? toGeniusText(text) : toPlainText(text);

/**
 * Plain-text transcription with the audio bar below it. The transport keys
 * work from inside the text box, so typing never stops for the mouse.
 */
export const TranscriptionWorkspace = memo(() => {
	const { t } = useTranslation();
	const store = useStore();
	const [text, setText] = useAtom(transcriptTextAtom);
	const format = useAtomValue(importTextFormatAtom);
	const openImportWithText = useSetAtom(openImportWithTextAtom);
	const setToolMode = useSetAtom(toolModeAtom);
	const deferredText = useDeferredValue(text);
	const stats = useMemo(() => transcriptStats(deferredText), [deferredText]);
	const isEmpty = stats.lines === 0;
	// Same markup as the import screen, so what is styled here is what imports.
	const markupFormat = useMemo(
		() => ({ ...format, makeSections: true }),
		[format],
	);

	const runAction = useCallback(
		(action: TranscriptionKeyAction) => {
			switch (action) {
				case "playPause":
					if (audioEngine.musicPlaying) audioEngine.pauseMusic();
					else audioEngine.resumeOrSeekMusic();
					return;
				case "seekBackward":
					audioEngine.seekMusic(
						Math.max(
							audioEngine.musicCurrentTime - TRANSCRIPTION_SEEK_SECONDS,
							0,
						),
					);
					return;
				case "seekForward":
					audioEngine.seekMusic(
						Math.min(
							audioEngine.musicCurrentTime + TRANSCRIPTION_SEEK_SECONDS,
							audioEngine.musicDuration,
						),
					);
					return;
				case "slower":
					store.set(playbackRateAtom, (v) => stepPlaybackRate(v, -1));
					return;
				case "faster":
					store.set(playbackRateAtom, (v) => stepPlaybackRate(v, 1));
					return;
				case "resetSpeed":
					store.set(playbackRateAtom, 1);
					return;
			}
		},
		[store],
	);

	// Capture runs before the editor's own key handling.
	const onKeyDownCapture = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			// A menu or popover inside the editor keeps its own Esc.
			if (!(event.target as HTMLElement).closest?.(".cm-content")) return;
			const action = transcriptionKeyAction(event.nativeEvent);
			if (!action) return;
			event.preventDefault();
			event.stopPropagation();
			if (!event.repeat || action !== "playPause") runAction(action);
		},
		[runAction],
	);

	const copy = useCallback(
		async (kind: ExportKind) => {
			try {
				await navigator.clipboard.writeText(exportText(kind, text));
				toast.success(t("transcription.copied", "Copied to the clipboard."));
			} catch (e) {
				error("Failed to copy the transcript", e);
				toast.error(t("transcription.copyFailed", "Couldn't copy the text."));
			}
		},
		[text, t],
	);

	const save = useCallback(
		async (kind: ExportKind) => {
			try {
				await saveFile(`${exportText(kind, text)}\n`, {
					suggestedName: kind === "genius" ? "lyrics-genius.txt" : "lyrics.txt",
					types: [
						{
							description: t("transcription.textFiles", "Text files"),
							accept: { "text/plain": [".txt"] },
						},
					],
				});
			} catch (e) {
				error("Failed to save the transcript", e);
				toast.error(t("transcription.saveFailed", "Couldn't save the file."));
			}
		},
		[text, t],
	);

	const sendToImport = useCallback(() => {
		setToolMode(ToolMode.Edit);
		openImportWithText(toGeniusText(text));
	}, [openImportWithText, setToolMode, text]);

	const shortcuts: [string[], string][] = [
		[["Esc"], t("transcription.keys.playPause", "Play or pause")],
		[["Alt", "J"], t("transcription.keys.back", "Back 3 seconds")],
		[["Alt", "L"], t("transcription.keys.forward", "Forward 3 seconds")],
		[["Alt", ","], t("transcription.keys.slower", "Slower")],
		[["Alt", "."], t("transcription.keys.faster", "Faster")],
		[["Alt", "/"], t("transcription.keys.resetSpeed", "Normal speed")],
	];

	return (
		<Flex direction="column" gap="3" p="3" className={styles.workspace}>
			<Flex align="center" justify="between" gap="3" wrap="wrap">
				<Flex direction="column" gap="1" className={styles.heading}>
					<Heading size="3" className={styles.title}>
						{t("transcription.title", "Transcribe")}
					</Heading>
					<Text size="1" color="gray">
						{t(
							"transcription.stats",
							"{lines, plural, one {# line} other {# lines}}, {words, plural, one {# word} other {# words}}",
							{ lines: stats.lines, words: stats.words },
						)}
					</Text>
				</Flex>
				<Flex align="center" gap="2" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						disabled={isEmpty}
						onClick={() => setText(toGeniusText(text))}
					>
						<TextGrammarWandRegular />
						{t("transcription.tidy", "Tidy layout")}
					</Button>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger disabled={isEmpty}>
							<Button variant="soft" color="gray">
								{t("transcription.export", "Export")}
								<ChevronDownRegular />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<DropdownMenu.Item onSelect={() => copy("genius")}>
								<CopyRegular />
								{t("transcription.copyGenius", "Copy as Genius text")}
							</DropdownMenu.Item>
							<DropdownMenu.Item onSelect={() => copy("plain")}>
								<CopyRegular />
								{t("transcription.copyPlain", "Copy as plain text")}
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onSelect={() => save("genius")}>
								<SaveRegular />
								{t("transcription.saveGenius", "Save as Genius text...")}
							</DropdownMenu.Item>
							<DropdownMenu.Item onSelect={() => save("plain")}>
								<SaveRegular />
								{t("transcription.savePlain", "Save as plain text...")}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<Button disabled={isEmpty} onClick={sendToImport}>
						<ArrowImportRegular />
						{t("transcription.sendToImport", "Import into the editor...")}
					</Button>
				</Flex>
			</Flex>
			{/* Forwards the transport keys from the editor inside. */}
			<div className={styles.editor} onKeyDownCapture={onKeyDownCapture}>
				<LyricMarkupEditor
					value={text}
					onChange={setText}
					format={markupFormat}
					ariaLabel={t("transcription.textLabel", "Transcript")}
					placeholder={t(
						"transcription.placeholder",
						"Type the lyrics as you hear them, one line per row. Put section headers like [Verse 1] on their own row.",
					)}
				/>
			</div>
			<Flex
				asChild
				align="center"
				gap="4"
				wrap="wrap"
				className={styles.shortcuts}
			>
				<ul
					aria-label={t(
						"transcription.keys.label",
						"Shortcuts in the text box",
					)}
				>
					{shortcuts.map(([keys, label]) => (
						<li key={label}>
							<Text size="1" color="gray">
								{keys.map((key) => (
									<Kbd key={key} size="1">
										{key}
									</Kbd>
								))}{" "}
								{label}
							</Text>
						</li>
					))}
				</ul>
			</Flex>
		</Flex>
	);
});

export default TranscriptionWorkspace;
