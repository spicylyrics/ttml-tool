import {
	Button,
	Checkbox,
	Dialog,
	Flex,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { replaceRomanizationDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { replaceRomanizationMatchCaseAtom } from "./combine-words-options";
import { replaceRomanization } from "./replace-romanization";

export const ReplaceRomanizationDialog = memo(() => {
	const { t } = useTranslation();
	const [dialogState, setDialogState] = useAtom(replaceRomanizationDialogAtom);
	const lyricState = useLyricLinesWhileOpen(dialogState.open);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [replacementText, setReplacementText] = useState("");
	const [applyToAll, setApplyToAll] = useState(false);
	const [caseSensitive, setCaseSensitive] = useAtom(
		replaceRomanizationMatchCaseAtom,
	);

	const targetWord =
		lyricState.lyricLines[dialogState.lineIndex]?.words[dialogState.wordIndex];

	useEffect(() => {
		if (!dialogState.open) return;
		setReplacementText(targetWord?.romanWord ?? "");
	}, [dialogState.open, targetWord?.romanWord]);

	const close = () => setDialogState((state) => ({ ...state, open: false }));
	const handleConfirm = () => {
		if (!targetWord) {
			close();
			return;
		}

		editLyricLines((state) => {
			replaceRomanization(state.lyricLines, {
				lineIndex: dialogState.lineIndex,
				wordIndex: dialogState.wordIndex,
				targetWord: targetWord.word,
				replacement: replacementText,
				applyToAll,
				caseSensitive,
			});
		});
		close();
	};

	return (
		<Dialog.Root
			open={dialogState.open}
			onOpenChange={(open) => setDialogState((state) => ({ ...state, open }))}
		>
			<Dialog.Content maxWidth="400px">
				<Dialog.Title>
					{t("replaceRomanizationDialog.title", "Replace romanization")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{t("replaceRomanizationDialog.description", "New romanization:")}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<TextField.Root
						value={replacementText}
						onChange={(event) => setReplacementText(event.currentTarget.value)}
						placeholder={t(
							"replaceRomanizationDialog.placeholder",
							"New romanization",
						)}
						onKeyDown={(event) => {
							if (event.key === "Enter") handleConfirm();
						}}
						autoFocus
					/>

					<Flex direction="column" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={applyToAll}
									onCheckedChange={(checked) => setApplyToAll(checked === true)}
								/>
								{t(
									"replaceRomanizationDialog.applyToAll",
									"Apply to all identical words",
								)}
							</Flex>
						</Text>

						<Text
							as="label"
							size="2"
							style={{
								opacity: applyToAll ? 1 : 0.5,
								pointerEvents: applyToAll ? "auto" : "none",
							}}
						>
							<Flex gap="2" align="center">
								<Checkbox
									checked={caseSensitive}
									onCheckedChange={(checked) =>
										setCaseSensitive(checked === true)
									}
									disabled={!applyToAll}
								/>
								{t("replaceRomanizationDialog.caseSensitive", "Match case")}
							</Flex>
						</Text>
					</Flex>
				</Flex>

				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={handleConfirm} disabled={!targetWord}>
						{t("common.confirm", "Confirm")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
