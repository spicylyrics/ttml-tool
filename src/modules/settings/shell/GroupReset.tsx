import { AlertDialog, Button, Flex, Text } from "@radix-ui/themes";
import { atom, useSetAtom } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { type ResettableSetting, resetSettings } from "./group-reset";

/** Puts every setting of one shell page back to its default, after a confirm. */
export const GroupReset = ({
	settings,
	groupLabel,
}: {
	settings: readonly ResettableSetting[];
	groupLabel: string;
}) => {
	const { t } = useTranslation();
	const resetAtom = useMemo(
		() => atom(null, (_get, set) => resetSettings(set, settings)),
		[settings],
	);
	const reset = useSetAtom(resetAtom);
	return (
		<AlertDialog.Root>
			<AlertDialog.Trigger>
				<Button
					size="1"
					variant="soft"
					color="red"
					data-reset-group=""
					aria-label={t(
						"preferencesPages.resetGroupLabel",
						"Reset {group} settings to their defaults",
						{ group: groupLabel },
					)}
				>
					{t("preferencesPages.resetGroup", "Reset to defaults")}
				</Button>
			</AlertDialog.Trigger>
			<AlertDialog.Content maxWidth="420px">
				<AlertDialog.Title>
					{t("preferencesPages.resetGroupTitle", "Reset {group} settings?", {
						group: groupLabel,
					})}
				</AlertDialog.Title>
				<AlertDialog.Description size="2">
					{t(
						"preferencesPages.resetGroupDesc",
						"These settings go back to their defaults:",
					)}
				</AlertDialog.Description>
				<Flex asChild direction="column" gap="1" mt="2" pl="4">
					<ul>
						{settings.map((setting) => (
							<Text as="span" size="2" key={setting.labelKey} asChild>
								<li>{t(setting.labelKey, setting.label)}</li>
							</Text>
						))}
					</ul>
				</Flex>
				<Flex gap="3" mt="4" justify="end">
					<AlertDialog.Cancel>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</AlertDialog.Cancel>
					<AlertDialog.Action>
						<Button variant="soft" color="red" onClick={reset}>
							{t("preferencesPages.resetGroupConfirm", "Reset")}
						</Button>
					</AlertDialog.Action>
				</Flex>
			</AlertDialog.Content>
		</AlertDialog.Root>
	);
};
