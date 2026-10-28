import { Clock24Regular, Cut24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Separator, Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import {
	timeModeDoubleClickTimestampAtom,
	timeModeWordEditingEnabledAtom,
} from "./states";

function Row({
	icon,
	title,
	description,
	children,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<Text as="label">
			<Flex gap="3" align="center">
				{icon}
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>{title}</Text>
							<Text size="1" color="gray">
								{description}
							</Text>
						</Flex>
						{children}
					</Flex>
				</Box>
			</Flex>
		</Text>
	);
}

/**
 * Preferences card for the Time-mode word editing flag. The double-click
 * option only appears while the flag is on, in the same card.
 */
export function TimeModeEditingSettings() {
	const { t } = useTranslation();
	const enabled = useAtomValue(timeModeWordEditingEnabledAtom);
	return (
		<Card>
			<Flex direction="column" gap="3">
				<Row
					icon={<Cut24Regular />}
					title={t("timeModeEditing.flagTitle", "Word editing in Time mode")}
					description={t(
						"timeModeEditing.flagDesc",
						"Split, combine and replace words from the right-click menu in Time mode.",
					)}
				>
					<SettingToggle setting={timeModeWordEditingEnabledAtom} />
				</Row>
				{enabled && (
					<>
						<Separator size="4" />
						<Row
							icon={<Clock24Regular />}
							title={t(
								"timeModeEditing.doubleClickTimestamp",
								"Double-click edits the timestamp",
							)}
							description={t(
								"timeModeEditing.doubleClickTimestampDesc",
								"Double-click a word in Time mode to type its start time instead of its text. Needs timestamps shown.",
							)}
						>
							<SettingToggle setting={timeModeDoubleClickTimestampAtom} />
						</Row>
					</>
				)}
			</Flex>
		</Card>
	);
}
