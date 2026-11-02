import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { loadedJapaneseWordFinder } from "$/modules/romanization/engines/japanese";
import { useJapaneseDictionary } from "$/modules/romanization/useJapaneseDictionary";
import {
	segmentationEngineAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import type { SegmentationEngineId } from "$/modules/segmentation/types";
import { detectSyllabificationEngine } from "$/modules/segmentation/utils/detect-syllabification-engine";
import { hasKana } from "$/modules/segmentation/utils/japanese-split";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { autoSegmentDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";

type JapaneseSplit = "sound" | "words";

export const AutoSegmentDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(autoSegmentDialogAtom);
	const savedEngine = useAtomValue(segmentationEngineAtom);
	const setEngine = useSetAtom(segmentationEngineAtom);
	const setSplitEnglish = useSetAtom(segmentationSplitEnglishAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const lyrics = useLyricLinesWhileOpen(open);
	const { config, isLoading } = useSegmentationConfig();
	const [selectedEngine, setSelectedEngine] =
		useState<SegmentationEngineId>(savedEngine);
	const suggestedEngine = useMemo(
		() => detectSyllabificationEngine(lyrics.lyricLines),
		[lyrics.lyricLines],
	);

	useEffect(() => {
		if (open) setSelectedEngine(suggestedEngine ?? savedEngine);
	}, [open, savedEngine, suggestedEngine]);

	const engine = useMemo(
		() =>
			SYLLABIFICATION_ENGINES.find(({ id }) => id === selectedEngine) ??
			SYLLABIFICATION_ENGINES[0],
		[selectedEngine],
	);

	// Japanese splits by sound on its own; a song imported without Process
	// lyrics can be split into words here instead.
	const lyricsText = useMemo(
		() =>
			lyrics.lyricLines
				.map((line) => line.words.map((word) => word.word).join(""))
				.join("\n"),
		[lyrics.lyricLines],
	);
	const japanese = hasKana(lyricsText);
	const [japaneseSplit, setJapaneseSplit] = useState<JapaneseSplit>("sound");
	useEffect(() => {
		if (open) setJapaneseSplit("sound");
	}, [open]);
	const dictionary = useJapaneseDictionary(
		japanese && japaneseSplit === "words" ? lyricsText : "",
	);

	const apply = () => {
		setEngine(selectedEngine);
		setSplitEnglish(selectedEngine !== "none");
		const japaneseWords =
			japanese && japaneseSplit === "words"
				? loadedJapaneseWordFinder(lyricsText)
				: undefined;
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(draft.lyricLines, {
				...config,
				engine: selectedEngine,
				splitEnglish: selectedEngine !== "none",
				japaneseWords,
			});
		});
		setOpen(false);
	};
	const japaneseLabel = t("autoSegmentDialog.japanese", "Japanese");

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="500px">
				<Dialog.Title>
					{t("autoSegmentDialog.title", "Auto segment")}
				</Dialog.Title>
				<Dialog.Description>
					{t(
						"autoSegmentDialog.description",
						"Choose a syllabification engine for all lyric lines.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="3" mt="4">
					<Select.Root
						value={selectedEngine}
						onValueChange={(value) =>
							setSelectedEngine(value as SegmentationEngineId)
						}
					>
						<Select.Trigger />
						<Select.Content>
							{SYLLABIFICATION_ENGINES.map(({ id, name }) => (
								<Select.Item key={id} value={id}>
									{name}
								</Select.Item>
							))}
						</Select.Content>
					</Select.Root>
					<Text size="2" color="gray">
						{engine.description}
					</Text>
					{suggestedEngine && (
						<Text size="2" color="gray">
							{t("autoSegmentDialog.suggested", "Suggested from lyrics:")}{" "}
							{
								SYLLABIFICATION_ENGINES.find(({ id }) => id === suggestedEngine)
									?.name
							}
						</Text>
					)}
					{japanese && (
						<Flex direction="column" gap="2" mt="2">
							<Text size="2" weight="medium">
								{japaneseLabel}
							</Text>
							<OptionPicker<JapaneseSplit>
								variant="segmented"
								fullWidth
								label={japaneseLabel}
								value={japaneseSplit}
								onValueChange={setJapaneseSplit}
								options={[
									{
										value: "sound",
										label: t("autoSegmentDialog.japaneseSound", "By sound"),
									},
									{
										value: "words",
										label: t("autoSegmentDialog.japaneseWords", "Into words"),
									},
								]}
							/>
							<Text size="2" color="gray">
								{japaneseSplit === "sound"
									? t(
											"autoSegmentDialog.japaneseSoundDesc",
											"One part per sound as it's sung: koo|hii, is|sho.",
										)
									: t(
											"autoSegmentDialog.japaneseWordsDesc",
											"Whole words, like Process lyrics: 君|の|名前|を. Split them by sound later.",
										)}
							</Text>
						</Flex>
					)}
				</Flex>
				<Flex justify="end" gap="3" mt="5">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={isLoading || dictionary.loading}>
						{t("autoSegmentDialog.applyAll", "Apply to all lines")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
