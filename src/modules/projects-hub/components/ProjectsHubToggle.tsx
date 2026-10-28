import { TaskListLtr24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { projectsHubEnabledAtom } from "../states";

/** Preferences card for the projects and files feature flag. */
export const ProjectsHubToggle = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(projectsHubEnabledAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<TaskListLtr24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t("projectsHub.enable", "Song list and start screen")}
								</Text>
								<Switch checked={enabled} onCheckedChange={setEnabled} />
							</Flex>
							<Text size="1" color="gray">
								{t(
									"projectsHub.enableDesc",
									"Adds a To sync list and a folder scan to Projects, a start screen in the empty editor, a prompt to continue your last session on launch, opening TTML and audio from one drop, and plain or Genius text export.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
