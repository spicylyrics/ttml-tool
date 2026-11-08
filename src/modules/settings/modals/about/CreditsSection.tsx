import { Badge, Card, Flex, Heading, Text } from "@radix-ui/themes";
import styles from "./AboutSections.module.css";
import { ExternalLink } from "./externalLinks";
import type { AboutSettings } from "./useAboutSettings";

type Translate = AboutSettings["t"];

interface Credit {
	name: string;
	url?: string;
	/** SPDX id, left untranslated. */
	license?: string;
	/** A notice the license asks us to keep, left untranslated. */
	notice?: string;
	role: (t: Translate) => string;
}

/** Third-party work this app includes, with the attribution its license asks for. */
const CREDITS: Credit[] = [
	{
		name: "Spicy Lyrics",
		url: "https://github.com/Spikerko/Spicy-Lyrics",
		license: "AGPL-3.0-or-later",
		role: (t) =>
			t(
				"aboutModal.creditRoles.spicyLyrics",
				"Lyrics renderer and font, by Spikerko and contributors",
			),
	},
	{
		name: "AMLL TTML Tool",
		url: "https://github.com/amll-dev/amll-ttml-tool",
		license: "GPL-3.0-or-later",
		role: (t) =>
			t("aboutModal.creditRoles.fork", "The editor this tool is forked from"),
	},
	{
		name: "amll-editor",
		url: "https://github.com/amll-dev/amll-editor",
		license: "AGPL-3.0-only",
		role: (t) =>
			t(
				"aboutModal.creditRoles.prosodic",
				"Syllable splitting engine and dictionary",
			),
	},
	{
		name: "spr.lua",
		license: "MIT",
		role: (t) =>
			t(
				"aboutModal.creditRoles.spring",
				"Spring animation math, by Fraktality",
			),
	},
	{
		name: "kuromoji",
		url: "https://github.com/takuyaa/kuromoji.js",
		license: "Apache-2.0",
		role: (t) =>
			t(
				"aboutModal.creditRoles.kuromoji",
				"Reads Japanese text for romanization",
			),
	},
	{
		name: "mecab-ipadic",
		notice: "Copyright 2000-2003 Nara Institute of Science and Technology",
		role: (t) =>
			t(
				"aboutModal.creditRoles.ipadic",
				"The Japanese dictionary kuromoji reads with",
			),
	},
	{
		name: "kuroshiro",
		url: "https://github.com/hexenq/kuroshiro",
		license: "MIT",
		role: (t) =>
			t(
				"aboutModal.creditRoles.kuroshiro",
				"Rules for writing Japanese in Latin letters",
			),
	},
	{
		name: "ToJyutping",
		url: "https://github.com/CanCLID/to-jyutping",
		license: "BSD-2-Clause",
		role: (t) => t("aboutModal.creditRoles.jyutping", "Cantonese romanization"),
	},
];

export const CreditsSection = ({ t }: Pick<AboutSettings, "t">) => (
	<Card>
		<Flex direction="column" gap="2">
			<Heading size="3">
				{t("aboutModal.credits", "Credits & third-party notices")}
			</Heading>
			<Text size="2" color="gray">
				{t(
					"aboutModal.creditsIntro",
					"This project includes work adapted from the following open-source projects.",
				)}
			</Text>
			<div className={styles.list}>
				{CREDITS.map((credit) => (
					<Flex
						key={credit.name}
						className={styles.row}
						align="start"
						justify="between"
						gap="3"
					>
						<Flex direction="column" gap="1" minWidth="0">
							<Text size="2" weight="medium">
								{credit.url ? (
									<ExternalLink href={credit.url}>{credit.name}</ExternalLink>
								) : (
									credit.name
								)}
							</Text>
							<Text size="1" color="gray">
								{credit.role(t)}
							</Text>
							{credit.notice && (
								<Text size="1" color="gray">
									{credit.notice}
								</Text>
							)}
						</Flex>
						{credit.license && (
							<Badge
								variant="soft"
								color="gray"
								radius="full"
								className={styles.license}
							>
								{credit.license}
							</Badge>
						)}
					</Flex>
				))}
			</div>
		</Flex>
	</Card>
);
