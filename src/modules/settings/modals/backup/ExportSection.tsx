import {
	ArrowDownload24Regular,
	ChevronDownRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	Text,
} from "@radix-ui/themes";
import {
	EXPORT_PREVIEW_ITEM_LIMIT,
	formatPreviewBytes,
} from "$/modules/settings/backup/preview";
import { BACKUP_CATEGORY_IDS } from "$/modules/settings/backup/types";
import { CATEGORY_ICONS } from "./categoryIcons";
import type { BackupSettings } from "./useBackupSettings";
export const ExportSection = ({
	t,
	labels,
	exportSelected,
	setExportSelected,
	exporting,
	expanded,
	setExpanded,
	previewLoading,
	preview,
	toggle,
	exportHint,
	handleExport,
}: Pick<
	BackupSettings,
	| "t"
	| "labels"
	| "exportSelected"
	| "setExportSelected"
	| "exporting"
	| "expanded"
	| "setExpanded"
	| "previewLoading"
	| "preview"
	| "toggle"
	| "exportHint"
	| "handleExport"
>) => (
	<Box>
		<Heading size="3" mb="1">
			{t("settings.backup.exportTitle", "Export")}
		</Heading>
		<Text size="2" color="gray" mb="2" as="div">
			{t(
				"settings.backup.exportDesc",
				"Save your settings and data to a file you can restore later or move to another device.",
			)}
		</Text>
		<Card variant="surface">
			<Flex direction="column" gap="3">
				{BACKUP_CATEGORY_IDS.map((id) => {
					const category = preview?.categories.find((c) => c.id === id);
					const open = expanded.has(id);
					return (
						<Box key={id}>
							<Flex align="center" gap="3">
								<Checkbox
									checked={exportSelected.has(id)}
									onCheckedChange={(v) =>
										toggle(setExportSelected, id, v === true)
									}
								/>
								<Box
									style={{
										color: "var(--accent-11)",
										display: "flex",
										alignItems: "center",
									}}
								>
									{CATEGORY_ICONS[id]}
								</Box>
								<Flex direction="column" flexGrow="1">
									<Text size="2">{labels[id]}</Text>
									<Text size="1" color="gray">
										{exportHint(id)}
									</Text>
								</Flex>
								<Button
									variant="ghost"
									color="gray"
									size="1"
									onClick={() => toggle(setExpanded, id, !open)}
									aria-expanded={open}
								>
									<ChevronDownRegular
										style={{
											transform: open ? "rotate(180deg)" : undefined,
											transition: "transform 0.15s ease",
										}}
									/>
									{category ? formatPreviewBytes(category.bytes) : null}
								</Button>
							</Flex>
							{open && (
								<Box
									ml="6"
									mt="1"
									style={{ maxHeight: 160, overflowY: "auto" }}
								>
									{previewLoading ? (
										<Text size="1" color="gray">
											{t("settings.backup.previewLoading", "Loading preview…")}
										</Text>
									) : !category || category.items.length === 0 ? (
										<Text size="1" color="gray">
											{t(
												"settings.backup.previewCategoryEmpty",
												"Nothing to export in this category",
											)}
										</Text>
									) : (
										<Flex direction="column" gap="1">
											{category.items
												.slice(0, EXPORT_PREVIEW_ITEM_LIMIT)
												.map((item) => (
													<Flex
														key={item.key}
														align="center"
														justify="between"
														gap="2"
													>
														<Text size="1" truncate>
															{item.label}
														</Text>
														<Text size="1" color="gray" wrap="nowrap">
															{item.detail}
														</Text>
													</Flex>
												))}
											{category.items.length > EXPORT_PREVIEW_ITEM_LIMIT && (
												<Text size="1" color="gray">
													{t("settings.backup.previewMore", "+{count} more", {
														count:
															category.items.length - EXPORT_PREVIEW_ITEM_LIMIT,
													})}
												</Text>
											)}
										</Flex>
									)}
								</Box>
							)}
						</Box>
					);
				})}
				{exportSelected.has("apiKeys") && (
					<Text size="1" color="orange">
						{t(
							"settings.backup.apiKeysWarning",
							"API keys are saved as plain text in the backup file. Keep it private.",
						)}
					</Text>
				)}
				<Flex justify="between" align="center">
					<Text size="2" weight="bold">
						{t("settings.backup.previewTotal", "Estimated total size")}:{" "}
						{formatPreviewBytes(
							(preview?.categories ?? [])
								.filter((c) => exportSelected.has(c.id))
								.reduce((sum, c) => sum + c.bytes, 0),
						)}
					</Text>
					<Button
						onClick={handleExport}
						disabled={exportSelected.size === 0}
						loading={exporting}
					>
						<ArrowDownload24Regular />
						{t("settings.backup.exportButton", "Export backup")}
					</Button>
				</Flex>
			</Flex>
		</Card>
	</Box>
);
