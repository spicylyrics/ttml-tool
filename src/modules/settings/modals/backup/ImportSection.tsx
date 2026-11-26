import { ArrowUpload24Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	Text,
} from "@radix-ui/themes";
import { getPresentCategories } from "$/modules/settings/backup/import";
import { CATEGORY_ICONS } from "./categoryIcons";
import type { BackupSettings } from "./useBackupSettings";
export const ImportSection = ({
	t,
	labels,
	fileInputRef,
	pendingImport,
	setPendingImport,
	importSelected,
	setImportSelected,
	importing,
	toggle,
	handleFilePicked,
	handleApplyImport,
	importHint,
}: Pick<
	BackupSettings,
	| "t"
	| "labels"
	| "fileInputRef"
	| "pendingImport"
	| "setPendingImport"
	| "importSelected"
	| "setImportSelected"
	| "importing"
	| "toggle"
	| "handleFilePicked"
	| "handleApplyImport"
	| "importHint"
>) => (
	<Box>
		<Heading size="3" mb="1">
			{t("settings.backup.importTitle", "Import")}
		</Heading>
		<Text size="2" color="gray" mb="2" as="div">
			{t(
				"settings.backup.importDesc",
				"Restore settings and data from a backup file. Existing values will be replaced.",
			)}
		</Text>
		<Card variant="surface">
			<input
				ref={fileInputRef}
				type="file"
				accept=".json,application/json"
				style={{ display: "none" }}
				onChange={handleFilePicked}
			/>
			{!pendingImport ? (
				<Flex justify="start">
					<Button variant="soft" onClick={() => fileInputRef.current?.click()}>
						<ArrowUpload24Regular />
						{t("settings.backup.importButton", "Choose backup file…")}
					</Button>
				</Flex>
			) : (
				<Flex direction="column" gap="3">
					<Text size="2" weight="bold">
						{t("settings.backup.confirmTitle", "Confirm import")}
					</Text>
					<Text size="1" color="gray">
						{t("settings.backup.exportedAt", "Exported")}:{" "}
						{new Date(pendingImport.exportedAt).toLocaleString()}
					</Text>
					{getPresentCategories(pendingImport).map((id) => (
						<Flex key={id} align="center" gap="3">
							<Checkbox
								checked={importSelected.has(id)}
								onCheckedChange={(v) =>
									toggle(setImportSelected, id, v === true)
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
							<Flex direction="column">
								<Text size="2">{labels[id]}</Text>
								<Text size="1" color="gray">
									{importHint(id)}
								</Text>
							</Flex>
						</Flex>
					))}
					<Text size="1" color="orange">
						{t(
							"settings.backup.confirmReplaceWarning",
							"Imported values will replace your current ones. The app will reload after importing.",
						)}
					</Text>
					<Flex justify="end" gap="2">
						<Button
							variant="soft"
							color="gray"
							onClick={() => setPendingImport(null)}
							disabled={importing}
						>
							{t("settings.backup.cancelButton", "Cancel")}
						</Button>
						<Button
							onClick={handleApplyImport}
							disabled={importSelected.size === 0}
							loading={importing}
						>
							{t("settings.backup.applyButton", "Import & reload")}
						</Button>
					</Flex>
				</Flex>
			)}
		</Card>
	</Box>
);
