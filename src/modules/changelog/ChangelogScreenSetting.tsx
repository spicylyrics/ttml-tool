import { Card, Flex, Heading, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { changelogScreenAtom } from "./states";

/** Preferences › About toggle for the `changelogScreen` flag. */
export function ChangelogScreenSetting() {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(changelogScreenAtom);
	const id = useId();
	return (
		<Card>
			<Flex align="center" justify="between" gap="4">
				<Flex direction="column" gap="1">
					<Heading as="h3" size="3">
						<label htmlFor={id}>
							{t("changelogScreen.setting", "New changelog screen")}
						</label>
					</Heading>
					<Text size="2" color="gray">
						{t(
							"changelogScreen.settingDesc",
							"Show each release as a card with its highlights first, then what's new, changed and fixed. Off keeps the current changelog.",
						)}
					</Text>
				</Flex>
				<Switch id={id} checked={enabled} onCheckedChange={setEnabled} />
			</Flex>
		</Card>
	);
}
