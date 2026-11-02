import { Keyboard20Regular } from "@fluentui/react-icons";
import { Box, Flex, Heading } from "@radix-ui/themes";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardView } from "./KeyboardView";

/** Preferences › Shortcuts: the keyboard view above the shortcut list. */
export const KeyboardViewSection: FC = () => {
	const { t } = useTranslation();

	return (
		<Box mb="5">
			<Heading size="3" mb="3" color="gray">
				<Flex align="center" gap="2">
					<Keyboard20Regular />
					<span>{t("keyboardView.title")}</span>
				</Flex>
			</Heading>
			<KeyboardView />
		</Box>
	);
};
