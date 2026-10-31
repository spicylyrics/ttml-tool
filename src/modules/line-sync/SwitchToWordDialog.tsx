import { Button, Dialog, Flex, RadioGroup, Text } from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { lyricLinesAtom } from "$/states/main";
import { switchToWordDialogAtom } from "./states";
import { switchToWordMode } from "./timing-mode";

type WordTimes = "untimed" | "spread";

/** Line → Word always asks first: it splits every line into words. */
export const SwitchToWordDialog = () => {
	const { t } = useTranslation();
	const store = useStore();
	const [open, setOpen] = useAtom(switchToWordDialogAtom);
	const [wordTimes, setWordTimes] = useState<WordTimes>("untimed");

	const confirm = () => {
		const spread = wordTimes === "spread";
		store.set(lyricLinesAtom, (lyric) => switchToWordMode(lyric, { spread }));
		setOpen(false);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="480px">
				<Dialog.Title>
					{t("lineSync.toWordTitle", "Switch to Word timing?")}
				</Dialog.Title>
				<Dialog.Description size="2">
					{t(
						"lineSync.toWordDescription",
						"Each line is split into words at its spaces. Word syncing stays inside each line's start and end. You can undo this.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="2" mt="4">
					<Text as="div" size="2" weight="medium" id="line-sync-word-times">
						{t("lineSync.wordTimes", "Word times")}
					</Text>
					<RadioGroup.Root
						value={wordTimes}
						onValueChange={(value) => setWordTimes(value as WordTimes)}
						aria-labelledby="line-sync-word-times"
					>
						<RadioGroup.Item value="untimed">
							{t("lineSync.wordTimesUntimed", "Leave words untimed")}
						</RadioGroup.Item>
						<RadioGroup.Item value="spread">
							<Flex direction="column">
								<Text>
									{t(
										"lineSync.wordTimesSpread",
										"Spread each line's time across its words",
									)}
								</Text>
								<Text size="1" color="gray">
									{t(
										"lineSync.wordTimesSpreadDesc",
										"Longer words get more time. Untimed lines stay untimed.",
									)}
								</Text>
							</Flex>
						</RadioGroup.Item>
					</RadioGroup.Root>
				</Flex>
				<Flex gap="3" mt="5" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("confirmDialog.cancel", "取消")}
						</Button>
					</Dialog.Close>
					<Button onClick={confirm}>
						{t("lineSync.toWordAction", "Switch to Word")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
