import { ErrorCircle24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { showPreviewTimingProblemsAtom } from "./states";

/** Preferences row for the "show timing problems" preview flag. */
export const PreviewProblemsSetting = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(showPreviewTimingProblemsAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<ErrorCircle24Regular />
					<Box flexGrow="1">
						<Flex align="center" justify="between" gap="4">
							<Flex direction="column" gap="1">
								<Text>
									{t("previewProblems.setting", "Show timing problems")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"previewProblems.settingDesc",
										"Mark words the Spicy preview would hide or play wrong because of their timing, in red with a dashed outline.",
									)}
								</Text>
							</Flex>
							<Switch checked={enabled} onCheckedChange={setEnabled} />
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
