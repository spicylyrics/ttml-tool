import { Open16Regular, PeopleTeam24Regular } from "@fluentui/react-icons";
import {
	Avatar,
	Badge,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	IconButton,
	Separator,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import styles from "./AboutSections.module.css";
import { CONTRIBUTORS_URL, openExternal } from "./externalLinks";
import type { AboutSettings } from "./useAboutSettings";

const MAINTAINERS = [
	{
		name: "NaeNaeTart",
		avatar: "https://avatars.githubusercontent.com/u/191877009?v=4",
		website: "https://yoursit.ee/naenaetart",
	},
	{
		name: "TX24",
		avatar: "https://avatars.githubusercontent.com/u/55551133?v=4",
		website: "https://tx24.dev",
	},
];

export const MaintainersSection = ({
	t,
	contributors,
}: Pick<AboutSettings, "t" | "contributors">) => (
	<Card>
		<Flex direction="column" gap="3">
			<Heading size="3">
				{t("aboutModal.maintainers", "Maintainers & contributors")}
			</Heading>
			<Grid columns="2" gap="2">
				{MAINTAINERS.map((maintainer) => (
					<Flex
						key={maintainer.name}
						align="center"
						gap="2"
						className={styles.person}
					>
						<Avatar
							src={maintainer.avatar}
							fallback={maintainer.name.slice(0, 1)}
							size="3"
							radius="full"
						/>
						<Flex direction="column" flexGrow="1" minWidth="0">
							<Text as="div" size="2" weight="medium" truncate>
								{maintainer.name}
							</Text>
							<Text as="div" size="1" color="gray" truncate>
								{t("aboutModal.forkMaintainer", "Maintainer & contributor")}
							</Text>
						</Flex>
						<Tooltip content={t("aboutModal.visitWebsite", "Visit website")}>
							<IconButton
								variant="soft"
								color="gray"
								radius="full"
								aria-label={t("aboutModal.visitWebsite", "Visit website")}
								onClick={() => void openExternal(maintainer.website)}
							>
								<Open16Regular />
							</IconButton>
						</Tooltip>
					</Flex>
				))}
			</Grid>

			<Separator size="4" />

			<Flex align="center" justify="between" gap="3" wrap="wrap">
				<Flex align="center" gap="2">
					<PeopleTeam24Regular color="var(--accent-11)" aria-hidden />
					<Text weight="medium" size="2">
						{t("aboutModal.contributors", "Contributors")}
					</Text>
					<Badge variant="soft" radius="full">
						{contributors.length}
					</Badge>
				</Flex>
				<Button
					variant="ghost"
					size="1"
					onClick={() => void openExternal(CONTRIBUTORS_URL)}
				>
					{t("aboutModal.viewContributors", "View contributors")}
					<Open16Regular />
				</Button>
			</Flex>
			{contributors.length > 0 && (
				<Flex
					gap="2"
					wrap="wrap"
					role="list"
					aria-label={t(
						"aboutModal.contributorProfiles",
						"Contributor profiles",
					)}
				>
					{contributors.map((contributor) => (
						<Tooltip
							key={contributor.login}
							content={t("aboutModal.contributorTooltip", {
								defaultValue: "{name} - {count} contributions",
								name: contributor.login,
								count: contributor.contributions,
							})}
						>
							<a
								role="listitem"
								href={contributor.profileUrl}
								target="_blank"
								rel="noreferrer"
								className={styles.avatarLink}
								aria-label={t("aboutModal.openContributorProfile", {
									defaultValue: "Open {name}'s GitHub profile",
									name: contributor.login,
								})}
								onClick={(event) => {
									if (import.meta.env.TAURI_ENV_PLATFORM) {
										event.preventDefault();
										void openExternal(contributor.profileUrl);
									}
								}}
							>
								<Avatar
									src={contributor.avatarUrl}
									fallback={contributor.login.slice(0, 1).toUpperCase()}
									alt={contributor.login}
									size="2"
									radius="full"
								/>
							</a>
						</Tooltip>
					))}
				</Flex>
			)}
		</Flex>
	</Card>
);
