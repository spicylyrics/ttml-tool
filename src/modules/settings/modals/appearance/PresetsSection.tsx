import {
	Checkmark24Regular,
	Delete24Regular,
	Save24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	IconButton,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { confirmDialogAtom } from "$/states/dialogs";
import type { AppearanceSectionState } from "./sectionState";
export const PresetsSection = ({
	presets,
	setPresets,
	newPresetName,
	setNewPresetName,
	lastLoaded,
	t,
	handleSavePreset,
	handleLoadPreset,
}: Pick<
	AppearanceSectionState,
	| "presets"
	| "setPresets"
	| "newPresetName"
	| "setNewPresetName"
	| "lastLoaded"
	| "t"
	| "handleSavePreset"
	| "handleLoadPreset"
>) => {
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	return (
		<Flex direction="column" gap="3">
			<Heading size="4">
				<Save24Regular />{" "}
				{t("settings.appearance.presets.title", "Appearance presets")}
			</Heading>
			<Card>
				<Flex direction="column" gap="3">
					<Flex gap="3" align="center">
						<TextField.Root
							placeholder={t(
								"settings.appearance.presets.namePlaceholder",
								"Theme name…",
							)}
							value={newPresetName}
							onChange={(e) => setNewPresetName(e.target.value)}
							style={{ flexGrow: 1 }}
						>
							<TextField.Slot>
								<Save24Regular />
							</TextField.Slot>
						</TextField.Root>
						<Button onClick={handleSavePreset} disabled={!newPresetName.trim()}>
							{t("settings.appearance.presets.save", "Save current")}
						</Button>
					</Flex>

					{presets.length > 0 ? (
						<Grid columns="2" gap="2">
							{presets.map((p) => {
								const isActive = lastLoaded === p.name;
								return (
									<Card
										key={p.id}
										size="1"
										style={{
											border: isActive
												? "1px solid var(--accent-9)"
												: undefined,
											backgroundColor: isActive ? "var(--accent-2)" : undefined,
										}}
									>
										<Flex align="center" justify="between" gap="2">
											<Box flexGrow="1" overflow="hidden">
												<Text
													size="2"
													weight="bold"
													style={{
														display: "block",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{p.name}
												</Text>
												{isActive && (
													<Text
														size="1"
														weight="medium"
														style={{
															display: "block",
															color: "var(--accent-11)",
														}}
													>
														{t("settings.appearance.presets.active", "Active")}
													</Text>
												)}
											</Box>
											<Flex align="center" gap="1">
												<Tooltip
													content={t(
														"settings.appearance.presets.load",
														"Apply preset",
													)}
												>
													<IconButton
														size="1"
														variant={isActive ? "soft" : "ghost"}
														color={isActive ? undefined : "gray"}
														onClick={() => handleLoadPreset(p)}
														aria-label={t(
															"settings.appearance.presets.load",
															"Apply preset",
														)}
													>
														<Checkmark24Regular />
													</IconButton>
												</Tooltip>
												<Tooltip
													content={t(
														"settings.appearance.presets.delete",
														"Delete preset",
													)}
												>
													<IconButton
														size="1"
														variant="ghost"
														color="red"
														onClick={() =>
															setConfirmDialog({
																open: true,
																title: t("confirmDialog.delete.title", {
																	name: p.name,
																	defaultValue: 'Delete "{name}"?',
																}),
																description: t(
																	"confirmDialog.delete.description",
																	"This can't be undone.",
																),
																confirmText: t(
																	"confirmDialog.delete.confirm",
																	"Delete",
																),
																destructive: true,
																onConfirm: () =>
																	setPresets(
																		presets.filter((pr) => pr.id !== p.id),
																	),
															})
														}
														aria-label={t(
															"settings.appearance.presets.delete",
															"Delete preset",
														)}
													>
														<Delete24Regular />
													</IconButton>
												</Tooltip>
											</Flex>
										</Flex>
									</Card>
								);
							})}
						</Grid>
					) : (
						<Text size="2" color="gray" align="center">
							{t("settings.appearance.presets.empty", "No saved presets yet.")}
						</Text>
					)}
				</Flex>
			</Card>
		</Flex>
	);
};
