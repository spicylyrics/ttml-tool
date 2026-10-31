import { ArrowRightRegular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	RadioGroup,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { currentDurationAtom } from "$/modules/audio/states";
import { timeStretchDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { openFileWithDialog } from "$/utils/fileDialog.ts";
import { DurationField } from "./TimeStretch/DurationField";
import {
	formatDurationInput,
	parseDurationInput,
	readAudioDurationMs,
	scaleTTMLTimings,
} from "./time-stretch";

type StretchScope = "all" | "selected" | "selected-following" | "custom";

export const TimeStretchDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(timeStretchDialogAtom);
	const store = useStore();
	const lyricLines = useLyricLinesWhileOpen(open);
	const selectedLines = useAtomValue(selectedLinesAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [oldDurationInput, setOldDurationInput] = useState("");
	const [newDurationInput, setNewDurationInput] = useState("");
	const [oldTemporaryFileName, setOldTemporaryFileName] = useState("");
	const [newTemporaryFileName, setNewTemporaryFileName] = useState("");
	const [oldTemporaryAudioError, setOldTemporaryAudioError] = useState("");
	const [newTemporaryAudioError, setNewTemporaryAudioError] = useState("");
	const [readingTemporaryAudio, setReadingTemporaryAudio] = useState(false);
	const [scope, setScope] = useState<StretchScope>("all");
	const [customStart, setCustomStart] = useState("1");
	const [customEnd, setCustomEnd] = useState("1");
	const durationReadId = useRef(0);

	const hasSelection = selectedLines.size > 0;
	const totalLines = lyricLines.lyricLines.length;
	const currentSongDuration = useAtomValue(currentDurationAtom);
	const currentSongAvailable = currentSongDuration > 0;
	const oldDuration = useMemo(
		() => parseDurationInput(oldDurationInput),
		[oldDurationInput],
	);
	const newDuration = useMemo(
		() => parseDurationInput(newDurationInput),
		[newDurationInput],
	);
	const durationsValid =
		oldDuration !== null &&
		oldDuration > 0 &&
		newDuration !== null &&
		newDuration > 0;
	const scaleFactor = durationsValid ? newDuration / oldDuration : null;
	const durationsMatch = scaleFactor === 1;

	useEffect(() => {
		if (open) {
			const duration = store.get(currentDurationAtom);
			setOldDurationInput(duration > 0 ? formatDurationInput(duration) : "");
			setNewDurationInput("");
			setOldTemporaryFileName("");
			setNewTemporaryFileName("");
			setOldTemporaryAudioError("");
			setNewTemporaryAudioError("");
			setReadingTemporaryAudio(false);
			setScope(hasSelection ? "selected" : "all");
			setCustomStart("1");
			setCustomEnd(totalLines.toString());
		} else {
			durationReadId.current += 1;
		}
	}, [open, store, hasSelection, totalLines]);

	const fillFromCurrentSong = (setValue: (value: string) => void) => {
		const duration = store.get(currentDurationAtom);
		if (duration > 0) setValue(formatDurationInput(duration));
	};

	const chooseTemporaryAudio = async (side: "old" | "new") => {
		const file = await openFileWithDialog({
			multiple: false,
			filters: [
				{
					name: "Audio",
					extensions: ["mp3", "flac", "wav", "ogg", "m4a", "opus", "webm"],
				},
			],
			place: "timeStretchAudio",
		});
		if (!file || Array.isArray(file)) return;

		const readId = ++durationReadId.current;
		setReadingTemporaryAudio(true);
		if (side === "old") setOldTemporaryAudioError("");
		else setNewTemporaryAudioError("");
		try {
			const duration = await readAudioDurationMs(file);
			if (readId !== durationReadId.current) return;
			if (side === "old") {
				setOldDurationInput(formatDurationInput(duration));
				setOldTemporaryFileName(file.name);
			} else {
				setNewDurationInput(formatDurationInput(duration));
				setNewTemporaryFileName(file.name);
			}
		} catch {
			if (readId !== durationReadId.current) return;
			const error = t(
				"timeStretchDialog.audioReadError",
				"Could not read the selected audio file's duration.",
			);
			if (side === "old") setOldTemporaryAudioError(error);
			else setNewTemporaryAudioError(error);
		} finally {
			if (readId === durationReadId.current) {
				setReadingTemporaryAudio(false);
			}
		}
	};

	const durationError = (value: string, duration: number | null) => {
		if (!value) return undefined;
		if (duration === null)
			return t("timeStretchDialog.invalidDuration", "Enter a valid duration.");
		if (duration <= 0)
			return t(
				"timeStretchDialog.positiveDuration",
				"Duration must be greater than zero.",
			);
		return undefined;
	};

	const handleApply = () => {
		if (!durationsValid || scaleFactor === null || durationsMatch) return;

		const targetLineIndices = new Set<number>();
		if (scope === "all") {
			for (let index = 0; index < totalLines; index++) {
				targetLineIndices.add(index);
			}
		} else if (scope === "selected") {
			lyricLines.lyricLines.forEach((line, index) => {
				if (selectedLines.has(line.id)) targetLineIndices.add(index);
			});
		} else if (scope === "selected-following") {
			const firstSelectedIndex = lyricLines.lyricLines.findIndex((line) =>
				selectedLines.has(line.id),
			);
			if (firstSelectedIndex !== -1) {
				for (let index = firstSelectedIndex; index < totalLines; index++) {
					targetLineIndices.add(index);
				}
			}
		} else {
			const start = Number.parseInt(customStart, 10);
			const end = Number.parseInt(customEnd, 10);
			if (!Number.isNaN(start) && !Number.isNaN(end)) {
				for (
					let index = Math.max(0, start - 1);
					index < Math.min(totalLines, end);
					index++
				) {
					targetLineIndices.add(index);
				}
			}
		}

		setLyricLines((draft) =>
			scaleTTMLTimings(
				draft,
				scaleFactor,
				scope === "all" ? undefined : targetLineIndices,
			),
		);
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="740px"
				style={{ minHeight: "320px", display: "flex", flexDirection: "column" }}
			>
				<Dialog.Title>
					{t("timeStretchDialog.title", "Time stretch")}
				</Dialog.Title>
				<Dialog.Description size="3" mb="7">
					{t(
						"timeStretchDialog.description",
						"Stretch or squeeze every TTML timestamp to fit a new song duration.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="5">
					<Flex gap="5" align="start">
						<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
							<DurationField
								label={t("timeStretchDialog.oldDuration", "Old song duration")}
								value={oldDurationInput}
								onChange={setOldDurationInput}
								onUseCurrent={() => fillFromCurrentSong(setOldDurationInput)}
								currentSongAvailable={currentSongAvailable}
								error={durationError(oldDurationInput, oldDuration)}
								secondaryAction={
									<Button
										variant="soft"
										onClick={() => chooseTemporaryAudio("old")}
										disabled={readingTemporaryAudio}
										style={{ flex: 1 }}
									>
										{readingTemporaryAudio
											? t("timeStretchDialog.readingAudio", "Reading audio…")
											: t("timeStretchDialog.chooseAudio", "Choose audio…")}
									</Button>
								}
								footer={
									(oldTemporaryFileName || oldTemporaryAudioError) && (
										<Flex direction="column" gap="1">
											{oldTemporaryFileName && (
												<Text size="1" color="gray">
													{oldTemporaryFileName}
												</Text>
											)}
											{oldTemporaryAudioError && (
												<Text size="1" color="red">
													{oldTemporaryAudioError}
												</Text>
											)}
										</Flex>
									)
								}
							/>
						</Flex>
						<Flex
							align="center"
							justify="center"
							style={{ flexShrink: 0, paddingTop: "2rem" }}
						>
							<ArrowRightRegular style={{ width: 54, height: 54 }} />
						</Flex>
						<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
							<DurationField
								label={t("timeStretchDialog.newDuration", "New song duration")}
								value={newDurationInput}
								onChange={(value) => {
									setNewDurationInput(value);
									setNewTemporaryFileName("");
								}}
								onUseCurrent={() => {
									fillFromCurrentSong(setNewDurationInput);
									setNewTemporaryFileName("");
								}}
								currentSongAvailable={currentSongAvailable}
								error={durationError(newDurationInput, newDuration)}
								secondaryAction={
									<Button
										variant="soft"
										onClick={() => chooseTemporaryAudio("new")}
										disabled={readingTemporaryAudio}
										style={{ flex: 1 }}
									>
										{readingTemporaryAudio
											? t("timeStretchDialog.readingAudio", "Reading audio…")
											: t("timeStretchDialog.chooseAudio", "Choose audio…")}
									</Button>
								}
								footer={
									<Flex direction="column" gap="1">
										{newTemporaryFileName && (
											<Text size="1" color="gray">
												{newTemporaryFileName}
											</Text>
										)}
										{newTemporaryAudioError && (
											<Text size="1" color="red">
												{newTemporaryAudioError}
											</Text>
										)}
									</Flex>
								}
							/>
						</Flex>
					</Flex>
					{scaleFactor !== null && (
						<Text size="2" color={durationsMatch ? "gray" : undefined}>
							{durationsMatch
								? t(
										"timeStretchDialog.noChange",
										"The durations match; no timing change is needed.",
									)
								: t(
										"timeStretchDialog.scaleFactor",
										"Scale factor: {factor}×",
										{ factor: scaleFactor.toFixed(6) },
									)}
						</Text>
					)}
					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("timeStretchDialog.scopeLabel", "Apply to")}
						</Text>
						<RadioGroup.Root
							value={scope}
							onValueChange={(value) => setScope(value as StretchScope)}
						>
							<RadioGroup.Item value="all">
								{t("timeStretchDialog.scope.all", "All lines")}
							</RadioGroup.Item>
							<RadioGroup.Item value="selected" disabled={!hasSelection}>
								{t("timeStretchDialog.scope.selected", "Selected lines")}
								{hasSelection && ` (${selectedLines.size})`}
							</RadioGroup.Item>
							<RadioGroup.Item
								value="selected-following"
								disabled={!hasSelection}
							>
								{t(
									"timeStretchDialog.scope.selectedFollowing",
									"Selected lines and following",
								)}
							</RadioGroup.Item>
							<RadioGroup.Item value="custom">
								{t("timeStretchDialog.scope.custom", "Custom range")}
							</RadioGroup.Item>
						</RadioGroup.Root>
						{scope === "custom" && (
							<Flex align="center" gap="2" ml="4">
								<Text size="2">{t("timeStretchDialog.fromLine", "From")}</Text>
								<TextField.Root
									style={{ width: "60px" }}
									size="1"
									type="number"
									value={customStart}
									onChange={(event) => setCustomStart(event.target.value)}
								/>
								<Text size="2">{t("timeStretchDialog.toLine", "to")}</Text>
								<TextField.Root
									style={{ width: "60px" }}
									size="1"
									type="number"
									value={customEnd}
									onChange={(event) => setCustomEnd(event.target.value)}
								/>
								<Text size="2">{t("timeStretchDialog.line", "lines")}</Text>
							</Flex>
						)}
					</Flex>
				</Flex>
				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button
						onClick={handleApply}
						disabled={!durationsValid || durationsMatch}
					>
						{t("common.apply", "Apply")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
