import { Flex } from "@radix-ui/themes";
import { memo } from "react";
import { BringDataFromStableSection } from "$/components/BringDataFromStable";
import { ExportSection } from "./backup/ExportSection";
import { ImportSection } from "./backup/ImportSection";
import { useBackupSettings } from "./backup/useBackupSettings";
export const SettingsBackupTab = memo(() => {
	const state = useBackupSettings();
	return (
		<Flex direction="column" gap="4">
			<BringDataFromStableSection />
			<ExportSection {...state} />
			<ImportSection {...state} />
		</Flex>
	);
});
