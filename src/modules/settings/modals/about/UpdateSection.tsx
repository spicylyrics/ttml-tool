import {
	ArrowSyncRegular,
	BeakerRegular,
	CheckmarkCircle24Regular,
	CheckmarkCircleRegular,
	CloudArrowDown24Regular,
	ErrorCircleRegular,
	OpenRegular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Progress,
	Separator,
	Spinner,
	Switch,
	Text,
} from "@radix-ui/themes";
import type { Update } from "@tauri-apps/plugin-updater";
import { FieldRow } from "$/components/FieldRow";
import { EntryText } from "$/modules/changelog/ChangelogScreen";
import {
	type ChangeEntry,
	type ChangeSection,
	SECTION_ORDER,
	sectionOf,
} from "$/modules/changelog/model";
import { translatedVersionLabel } from "$/utils/version-label";
import { openExternal } from "./externalLinks";
import styles from "./UpdateSection.module.css";
import type { AboutSettings } from "./useAboutSettings";

const RELEASES = "https://github.com/spicylyrics/ttml-tool/releases";

/** The release's entries, which the release workflow adds to the updater file. */
function updateEntries(update: Update): ChangeEntry[] {
	const entries = update.rawJson.entries;
	if (!Array.isArray(entries)) return [];
	return entries.filter(
		(entry): entry is ChangeEntry =>
			typeof entry === "object" &&
			entry !== null &&
			typeof (entry as ChangeEntry).title === "string",
	);
}

const UpdateNotes = ({
	t,
	update,
}: Pick<AboutSettings, "t"> & { update: Update }) => {
	const entries = updateEntries(update);
	if (!entries.length) {
		// Releases from before the entries were added only have plain notes.
		return update.body ? (
			<Text size="1" color="gray" className={styles.plainNotes}>
				{update.body}
			</Text>
		) : null;
	}
	const labels: Record<ChangeSection, string> = {
		new: t("changelogScreen.sectionNew", "New"),
		changed: t("changelogScreen.sectionChanged", "Changed"),
		fixed: t("changelogScreen.sectionFixed", "Fixed"),
	};
	return (
		<Flex direction="column" gap="3" className={styles.notes}>
			{SECTION_ORDER.map((section) => {
				const items = entries.filter((entry) => sectionOf(entry) === section);
				if (!items.length) return null;
				return (
					<Flex key={section} direction="column" gap="1">
						<Text size="1" weight="medium" color="gray">
							{labels[section]}
						</Text>
						{items.map((entry) => (
							<EntryText key={entry.title} entry={entry} />
						))}
					</Flex>
				);
			})}
		</Flex>
	);
};

/** Where an install that can't update itself gets the new version. */
const DownloadInstead = ({
	t,
	update,
	installKind,
}: Pick<AboutSettings, "t" | "installKind"> & { update: Update }) =>
	installKind === "aur" ? (
		<Text size="2" color="gray">
			{t(
				"settings.about.aurUpdateHint",
				"This copy was built from the AUR, so update it with your AUR helper.",
			)}
		</Text>
	) : (
		<Flex direction="column" gap="2" align="start">
			<Text size="2" color="gray">
				{t(
					"settings.about.downloadUpdateHint",
					"This copy can't update itself. Download the new version for your system from the release page.",
				)}
			</Text>
			<Button
				onClick={() => void openExternal(`${RELEASES}/tag/v${update.version}`)}
			>
				<OpenRegular />
				{t("settings.about.openDownloadPage", "Open download page")}
			</Button>
		</Flex>
	);

/** The result of the last check, when there is no update to show. */
const CheckStatus = ({ t, status }: Pick<AboutSettings, "t" | "status">) => {
	if (status === "checking")
		return (
			<Flex align="center" gap="2">
				<Spinner />
				<Text size="2" color="gray" role="status">
					{t("settings.about.checking", "Checking for updates...")}
				</Text>
			</Flex>
		);
	if (status === "up-to-date")
		return (
			<Flex align="center" gap="2">
				<CheckmarkCircleRegular color="var(--accent-11)" aria-hidden />
				<Text size="2" role="status">
					{t("settings.about.upToDate", "You have the newest version")}
				</Text>
			</Flex>
		);
	if (status === "error")
		return (
			<Flex align="center" gap="2">
				<ErrorCircleRegular color="var(--red-11)" aria-hidden />
				<Text size="2" color="red" role="status">
					{t(
						"settings.about.checkFailed",
						"Couldn't check for updates. Check your connection and try again",
					)}
				</Text>
			</Flex>
		);
	return null;
};

/**
 * Preferences › About › Updates: what's new, the check button and the beta
 * switch in one card at the top. Desktop only; the website has no updater.
 */
export const UpdateSection = ({
	t,
	isWebsite,
	status,
	update,
	progress,
	installUpdate,
	restartApp,
	checkUpdate,
	showUpdateCard,
	canSelfUpdate,
	installKind,
	betaUpdates,
	setBetaUpdates,
}: Pick<
	AboutSettings,
	| "t"
	| "isWebsite"
	| "status"
	| "update"
	| "progress"
	| "installUpdate"
	| "restartApp"
	| "checkUpdate"
	| "showUpdateCard"
	| "canSelfUpdate"
	| "installKind"
	| "betaUpdates"
	| "setBetaUpdates"
>) =>
	!isWebsite && (
		<Card>
			<Flex direction="column" gap="3">
				<Flex align="center" justify="between" gap="3" wrap="wrap">
					<Flex align="center" gap="2">
						<Heading size="3">
							{t("settings.about.update", "Software Update")}
						</Heading>
						{status === "available" && (
							<Badge>{t("settings.about.newVersion", "New Version")}</Badge>
						)}
					</Flex>
					{!showUpdateCard && (
						<Button
							variant="soft"
							color="gray"
							disabled={status === "checking"}
							onClick={() => void checkUpdate()}
						>
							<ArrowSyncRegular />
							{t("settings.about.checkForUpdates", "Check for updates")}
						</Button>
					)}
				</Flex>

				{!showUpdateCard && <CheckStatus t={t} status={status} />}

				{showUpdateCard && (
					<Box>
						{status === "available" && update && (
							<Flex direction="column" gap="3">
								<Flex direction="column" gap="2" className={styles.release}>
									<Text weight="bold" size="2">
										{translatedVersionLabel(update.version, t)}
									</Text>
									<UpdateNotes t={t} update={update} />
								</Flex>
								{canSelfUpdate ? (
									<Flex gap="3">
										<Button onClick={installUpdate}>
											<CloudArrowDown24Regular />
											{t("settings.about.updateNow", "Update Now")}
										</Button>
									</Flex>
								) : (
									<DownloadInstead
										t={t}
										update={update}
										installKind={installKind}
									/>
								)}
							</Flex>
						)}

						{status === "downloading" && (
							<Flex direction="column" gap="2">
								<Flex justify="between">
									<Text size="2">
										{t("settings.about.downloading", "Downloading update…")}
									</Text>
									<Text size="2">{progress.toFixed(0)}%</Text>
								</Flex>
								<Progress value={progress} />
							</Flex>
						)}

						{status === "ready" && (
							<Flex direction="column" gap="2">
								<Flex align="center" gap="2">
									<CheckmarkCircle24Regular color="var(--accent-11)" />
									<Text size="2">
										{t(
											"settings.about.ready",
											"Update ready, restart application to apply",
										)}
									</Text>
								</Flex>
								<Button onClick={restartApp}>
									{t("settings.about.restart", "Restart Application")}
								</Button>
							</Flex>
						)}
					</Box>
				)}

				<Separator size="4" />

				<FieldRow
					icon={<BeakerRegular />}
					label={t("settings.about.betaUpdates", "Beta updates")}
					description={t(
						"settings.about.betaUpdatesDescription",
						"Get new versions a few days early to try them out and report problems. Turning this off keeps your version until the next stable one is newer.",
					)}
				>
					{({ controlId, descriptionId }) => (
						<Switch
							id={controlId}
							aria-describedby={descriptionId}
							checked={betaUpdates}
							onCheckedChange={setBetaUpdates}
						/>
					)}
				</FieldRow>
			</Flex>
		</Card>
	);
