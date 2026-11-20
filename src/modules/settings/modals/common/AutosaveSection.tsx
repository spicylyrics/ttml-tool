import {
	ArrowUndo24Regular,
	History24Regular,
	Save24Regular,
	Stack24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	Slider,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import type { CommonSettings } from "./useCommonSettings";
export const AutosaveSection = ({
	autosaveEnabled,
	setAutosaveEnabled,
	autosaveInterval,
	setAutosaveInterval,
	autosaveLimit,
	setAutosaveLimit,
	restoreAutomatically,
	setRestoreAutomatically,
	t,
}: Pick<
	CommonSettings,
	| "autosaveEnabled"
	| "setAutosaveEnabled"
	| "autosaveInterval"
	| "setAutosaveInterval"
	| "autosaveLimit"
	| "setAutosaveLimit"
	| "restoreAutomatically"
	| "setRestoreAutomatically"
	| "t"
>) => (
	<Flex direction="column" gap="2">
		<Heading size="4">{t("settings.group.autosave", "Autosave")}</Heading>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Save24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t("settings.common.autosave.enable", "Enable autosave")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.autosave.enableDesc",
										"Saves your lyrics a few seconds after each change and keeps snapshots you can restore from the File menu.",
									)}
								</Text>
							</Flex>
							<Switch
								checked={autosaveEnabled}
								onCheckedChange={setAutosaveEnabled}
							/>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		{isTauri() && (
			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<ArrowUndo24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>
										{t(
											"settings.common.autosave.restoreAutomatically",
											"Restore unsaved work automatically",
										)}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.common.autosave.restoreAutomaticallyDesc",
											"Skip the prompt on launch and reopen what you had when you last closed with unsaved changes.",
										)}
									</Text>
								</Flex>
								<Switch
									checked={restoreAutomatically}
									disabled={!autosaveEnabled}
									onCheckedChange={setRestoreAutomatically}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>
		)}

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<History24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="2" align="start">
							<Flex direction="column" gap="1">
								<Text>
									{t(
										"settings.common.autosave.interval",
										"Save every (minutes)",
									)}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.autosave.intervalDesc",
										"Minimum time between snapshots. Your latest changes are still saved after every edit.",
									)}
								</Text>
							</Flex>
							<TextField.Root
								type="number"
								disabled={!autosaveEnabled}
								value={autosaveInterval}
								onChange={(e) =>
									setAutosaveInterval(
										Math.max(1, Number.parseInt(e.target.value, 10) || 1),
									)
								}
							/>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<Card>
			<Flex gap="3" align="center">
				<Stack24Regular />
				<Box flexGrow="1">
					<Flex direction="column" gap="2" align="start">
						<Flex
							align="center"
							justify="between"
							style={{ alignSelf: "stretch" }}
						>
							<Text>
								{t("settings.common.autosave.limit", "Snapshots to keep")}
							</Text>
							<Text wrap="nowrap" color="gray" size="1">
								{autosaveLimit}
							</Text>
						</Flex>
						<Text size="1" color="gray">
							{t(
								"settings.common.autosave.limitDesc",
								"How many snapshots to keep for each song. The oldest are deleted first.",
							)}
						</Text>
						<Slider
							min={1}
							max={50}
							disabled={!autosaveEnabled}
							value={[autosaveLimit]}
							step={1}
							onValueChange={(v) => setAutosaveLimit(v[0])}
						/>
					</Flex>
				</Box>
			</Flex>
		</Card>
	</Flex>
);
