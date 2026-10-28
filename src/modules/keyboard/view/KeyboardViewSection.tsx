import { Keyboard20Regular } from "@fluentui/react-icons";
import { Box, Flex, Heading, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, useId } from "react";
import { useTranslation } from "react-i18next";
import { keyboardViewEnabledAtom } from "../flags";
import { KeyboardView } from "./KeyboardView";

/** Preferences › Shortcuts: the experimental keyboard view and its switch. */
export const KeyboardViewSection: FC = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(keyboardViewEnabledAtom);
	const titleId = useId();
	const descId = useId();

	return (
		<Box mb="5">
			<Heading size="3" mb="3" color="gray">
				<Flex align="center" gap="2">
					<Keyboard20Regular />
					<span>{t("keyboardView.title")}</span>
				</Flex>
			</Heading>
			<Flex align="center" justify="between" gap="4" mb={enabled ? "4" : "0"}>
				<Box>
					<Text as="div" id={titleId}>
						{t("keyboardView.flagTitle")}
					</Text>
					<Text as="div" size="1" color="gray" id={descId}>
						{t("keyboardView.flagDesc")}
					</Text>
				</Box>
				<Switch
					checked={enabled}
					onCheckedChange={setEnabled}
					aria-labelledby={titleId}
					aria-describedby={descId}
				/>
			</Flex>
			{enabled && <KeyboardView />}
		</Box>
	);
};
