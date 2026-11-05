import {
	ArrowClockwiseRegular,
	ArrowImportRegular,
	DismissRegular,
} from "@fluentui/react-icons";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	BETA_COPY_COMPLETED_KEY,
	classifyMigrationOrigin,
	MIGRATION_SEND_PATH,
	OFFICIAL_TOOL_ORIGIN,
} from "$/modules/domain-migration/config";
import { guideWelcomeOpenAtom } from "$/modules/onboarding/states";

const OFFER_DISMISSED_KEY = "betaDataOfferDismissed";
// Lets the first-run guide open first, so the offer doesn't appear behind it.
const OFFER_DELAY = 1500;

const isBetaSite = () =>
	classifyMigrationOrigin(
		window.location.origin,
		Boolean(import.meta.env.TAURI_ENV_PLATFORM),
	) === "beta";

/** Offer once, until it's answered or a copy has happened. */
export function shouldOfferStableData(
	storage: Pick<Storage, "getItem">,
	beta = isBetaSite(),
) {
	return (
		beta &&
		!storage.getItem(BETA_COPY_COMPLETED_KEY) &&
		!storage.getItem(OFFER_DISMISSED_KEY)
	);
}

// The transfer runs from the stable site, the only one that can read its data.
const openStableSender = () =>
	window.open(`${OFFICIAL_TOOL_ORIGIN}${MIGRATION_SEND_PATH}`, "_blank");

/** First visit on the beta site: a toast that never blocks the editor. */
export const BringDataFromStableOffer = () => {
	const { t } = useTranslation();
	const guideOpen = useAtomValue(guideWelcomeOpenAtom);

	useEffect(() => {
		if (guideOpen || !shouldOfferStableData(localStorage)) return;
		const timer = window.setTimeout(() => {
			toast.info(
				({ closeToast }) => (
					<Flex direction="column" gap="2">
						<Text size="2" weight="medium">
							{t(
								"domainMigration.beta.offerTitle",
								"Have projects on the stable site?",
							)}
						</Text>
						<Text size="2">
							{t(
								"domainMigration.beta.note",
								"You can bring a copy here. It's a one-time copy, not a sync, so the two sites drift apart afterwards.",
							)}
						</Text>
						<Flex gap="2" wrap="wrap">
							<Button
								size="1"
								onClick={() => {
									openStableSender();
									closeToast();
								}}
							>
								<ArrowImportRegular />
								{t("domainMigration.beta.bring", "Bring my data from stable")}
							</Button>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={() => closeToast()}
							>
								<DismissRegular />
								{t("domainMigration.notice.later", "Later")}
							</Button>
						</Flex>
					</Flex>
				),
				{
					toastId: "bring-data-from-stable",
					autoClose: false,
					closeOnClick: false,
					onClose: () => localStorage.setItem(OFFER_DISMISSED_KEY, "true"),
				},
			);
		}, OFFER_DELAY);
		return () => window.clearTimeout(timer);
	}, [guideOpen, t]);

	// The copy lands from another window, so this tab has to reload to show it.
	useEffect(() => {
		if (!isBetaSite()) return;
		const onStorage = (event: StorageEvent) => {
			if (event.key !== BETA_COPY_COMPLETED_KEY || !event.newValue) return;
			toast.dismiss("bring-data-from-stable");
			toast.success(
				<Flex align="center" justify="between" gap="3">
					<Text size="2" weight="medium">
						{t("domainMigration.beta.copied", "Your data was copied here")}
					</Text>
					<Button size="1" variant="soft" onClick={() => location.reload()}>
						<ArrowClockwiseRegular />
						{t("domainMigration.beta.reload", "Reload to see it")}
					</Button>
				</Flex>,
				{ autoClose: false, closeOnClick: false },
			);
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [t]);

	return null;
};

/** Preferences › Backup on the beta site. Safe to run as often as you like. */
export const BringDataFromStableSection = () => {
	const { t } = useTranslation();
	if (!isBetaSite()) return null;
	return (
		<Box>
			<Heading size="3" mb="1">
				{t("domainMigration.beta.sectionTitle", "Data from the stable site")}
			</Heading>
			<Flex direction="column" gap="3" align="start">
				<Text as="p" size="2" color="gray">
					{t(
						"domainMigration.beta.note",
						"You can bring a copy here. It's a one-time copy, not a sync, so the two sites drift apart afterwards.",
					)}{" "}
					{t(
						"domainMigration.beta.again",
						"You can copy again later. Nothing already here gets overwritten unless you choose it.",
					)}
				</Text>
				<Button onClick={openStableSender}>
					<ArrowImportRegular />
					{t("domainMigration.beta.bring", "Bring my data from stable")}
				</Button>
			</Flex>
		</Box>
	);
};
