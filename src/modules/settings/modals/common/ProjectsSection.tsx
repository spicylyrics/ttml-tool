import { Folder24Regular, Save24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Switch, Text } from "@radix-ui/themes";
import { ProjectsHubToggle } from "$/modules/projects-hub/components/ProjectsHubToggle";
import type { CommonSettings } from "./useCommonSettings";
export const ProjectsSection = ({
	folderProjectsAutosave,
	setFolderProjectsAutosave,
	folderProjectsEnabled,
	setFolderProjectsEnabled,
	t,
}: Pick<
	CommonSettings,
	| "folderProjectsAutosave"
	| "setFolderProjectsAutosave"
	| "folderProjectsEnabled"
	| "setFolderProjectsEnabled"
	| "t"
>) => (
	<Flex direction="column" gap="2">
		<Heading size="4">{t("settings.group.projects", "Projects")}</Heading>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Folder24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t("settings.files.folderProjects", "Folder projects")}
								</Text>
								<Switch
									checked={folderProjectsEnabled}
									onCheckedChange={setFolderProjectsEnabled}
								/>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"settings.files.folderProjectsDesc",
									"Open, save, and organize lyrics as project folders with a project.json manifest.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Save24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t(
										"settings.files.folderProjectsAutosave",
										"Save project file on auto save",
									)}
								</Text>
								<Switch
									checked={folderProjectsAutosave}
									onCheckedChange={setFolderProjectsAutosave}
									disabled={!folderProjectsEnabled}
								/>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"settings.files.folderProjectsAutosaveDesc",
									"Write the open project lyric file to disk on every auto save.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<ProjectsHubToggle />
	</Flex>
);
