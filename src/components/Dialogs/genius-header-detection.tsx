import { Info24Regular } from "@fluentui/react-icons";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	geniusCategorizationEnabledAtom,
	geniusHeaderDetectionDialogOpenAtom,
	geniusHeaderDetectionDialogShownAtom,
} from "$/modules/settings/states/index.ts";

export const GeniusHeaderDetectionDialog = () => {
	const { t } = useTranslation();
	const setGeniusCategorizationEnabled = useSetAtom(
		geniusCategorizationEnabledAtom,
	);
	const setDialogShown = useSetAtom(geniusHeaderDetectionDialogShownAtom);
	const [isOpen, setIsOpen] = useAtom(geniusHeaderDetectionDialogOpenAtom);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 500 }}>
				<Dialog.Title>
					{t(
						"experimentalFeatures.geniusCategorization.dialogTitle",
						"Genius section headers found",
					)}
				</Dialog.Title>
				<Dialog.Description mb="4">
					{t(
						"experimentalFeatures.geniusCategorization.dialogDesc",
						"Your lyrics have section headers like [Verse] and [Chorus]. Turn on the experimental Genius sections feature to use them?",
					)}
				</Dialog.Description>

				<Flex direction="column" gap="3">
					<Box
						p="3"
						style={{
							backgroundColor: "var(--gray-2)",
							borderRadius: "var(--radius-2)",
						}}
					>
						<Flex gap="2" align="start">
							<Info24Regular
								style={{ color: "var(--accent-9)", marginTop: "2px" }}
							/>
							<Text size="1">
								{t(
									"experimentalFeatures.geniusCategorization.usageInfo",
									"Section headers then get their own style in the editor, with tools like Apply timings and Snap to playhead.",
								)}
							</Text>
						</Flex>
					</Box>

					<Flex justify="end" gap="2">
						<Button
							variant="soft"
							color="gray"
							onClick={() => {
								setIsOpen(false);
								setDialogShown(true);
							}}
						>
							{t(
								"experimentalFeatures.geniusCategorization.maybeLater",
								"Maybe later",
							)}
						</Button>
						<Button
							onClick={() => {
								setGeniusCategorizationEnabled(true);
								setDialogShown(true);
								setIsOpen(false);
							}}
						>
							{t(
								"experimentalFeatures.geniusCategorization.enableNow",
								"Enable now",
							)}
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
