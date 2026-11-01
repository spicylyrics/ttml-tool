import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	OptionPicker,
	type PickerOption,
} from "$/components/OptionPicker/index.tsx";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import {
	segmentationEngineAtom,
	segmentationSplitEnglishAtom,
	segmentationUnsureSplitsAtom,
} from "$/modules/segmentation/states";
import type {
	SegmentationEngineId,
	UnsureSplitMode,
} from "$/modules/segmentation/types";
import { detectSyllabificationEngine } from "$/modules/segmentation/utils/detect-syllabification-engine";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { autoSegmentDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { useSegmentationConfig } from "../utils/useSegmentationConfig";
import { notifyUnsureSplits } from "./UnsureSplitsToast";

export const AutoSegmentDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(autoSegmentDialogAtom);
	const savedEngine = useAtomValue(segmentationEngineAtom);
	const setEngine = useSetAtom(segmentationEngineAtom);
	const setSplitEnglish = useSetAtom(segmentationSplitEnglishAtom);
	const [unsureSplits, setUnsureSplits] = useAtom(segmentationUnsureSplitsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();
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

	const apply = () => {
		setEngine(selectedEngine);
		setSplitEnglish(selectedEngine !== "none");
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(draft.lyricLines, {
				...config,
				engine: selectedEngine,
				splitEnglish: selectedEngine !== "none",
			});
		});
		setOpen(false);
		notifyUnsureSplits(store.get(lyricLinesAtom).lyricLines);
	};

	const unsureOptions: PickerOption<UnsureSplitMode>[] = [
		{
			value: "flag",
			label: t("unsureSplits.mode.flag", "Split and mark"),
			description: t(
				"unsureSplits.mode.flagDescription",
				"Split the word and mark it so you can check it",
			),
		},
		{
			value: "split",
			label: t("unsureSplits.mode.split", "Split without marking"),
			description: t(
				"unsureSplits.mode.splitDescription",
				"Split the word like any other",
			),
		},
		{
			value: "whole",
			label: t("unsureSplits.mode.whole", "Leave whole"),
			description: t(
				"unsureSplits.mode.wholeDescription",
				"Keep the word in one piece",
			),
		},
	];

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
					{engine.splitDetailed && (
						<Flex align="center" justify="between" gap="3">
							<Text size="2">
								{t("unsureSplits.mode.label", "When a split is unsure")}
							</Text>
							<OptionPicker
								value={unsureSplits}
								options={unsureOptions}
								onValueChange={setUnsureSplits}
								label={t("unsureSplits.mode.label", "When a split is unsure")}
								size="2"
							/>
						</Flex>
					)}
				</Flex>
				<Flex justify="end" gap="3" mt="5">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={isLoading}>
						{t("autoSegmentDialog.applyAll", "Apply to all lines")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
