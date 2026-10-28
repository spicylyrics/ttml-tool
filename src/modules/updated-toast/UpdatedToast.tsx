import { APP_VERSION } from "virtual:buildmeta";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { changelogDialogAtom } from "$/states/dialogs.ts";
import { decideUpdatedToast, LAST_SEEN_VERSION_KEY } from "./logic";
import { updatedToastEnabledAtom } from "./states";

const readLastSeen = () => {
	try {
		return localStorage.getItem(LAST_SEEN_VERSION_KEY);
	} catch {
		return null;
	}
};

const writeLastSeen = (version: string) => {
	try {
		localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
		return true;
	} catch {
		return false;
	}
};

/** Once per start: if this is a newer version than last run, say so. */
export const UpdatedToast = () => {
	const enabled = useAtomValue(updatedToastEnabledAtom);
	const setChangelogOpen = useSetAtom(changelogDialogAtom);
	const { t } = useTranslation();

	useEffect(() => {
		if (!enabled) return;
		const { show, store } = decideUpdatedToast(APP_VERSION, readLastSeen());
		if (!store) return;
		// Without storage we can't remember it was shown, so stay quiet
		// rather than repeat it on every start.
		if (!writeLastSeen(store) || !show) return;

		toast.info(
			({ closeToast }) => (
				<Flex align="center" justify="between" gap="3">
					<Text size="2" weight="medium">
						{t("updatedToast.message", "Updated to v{version}", {
							version: store,
						})}
					</Text>
					<Button
						size="1"
						variant="soft"
						onClick={() => {
							setChangelogOpen(true);
							closeToast();
						}}
					>
						{t("updatedToast.seeChanges", "See what changed")}
					</Button>
				</Flex>
			),
			{
				toastId: `updated-to-${store}`,
				autoClose: 10000,
				closeOnClick: false,
			},
		);
	}, [enabled, setChangelogOpen, t]);

	return null;
};
