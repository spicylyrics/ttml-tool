import {
	BookRegular,
	BoxRegular,
	MusicNote1Regular,
	SettingsRegular,
	StarRegular,
} from "@fluentui/react-icons";
import { Box, Card, Flex, Grid, Heading, Link, Text } from "@radix-ui/themes";
import type { AboutSettings } from "./useAboutSettings";
export const CreditsSection = ({ t }: Pick<AboutSettings, "t">) => (
	<Card>
		<Flex direction="column" gap="3">
			<Heading size="3">
				{t("aboutModal.credits", "Credits & third-party notices")}
			</Heading>
			<Text size="2" color="gray">
				{t(
					"aboutModal.creditsIntro",
					"This project includes work adapted from the following open-source projects.",
				)}
			</Text>
			<Grid columns="2" gap="3">
				<Card variant="classic" style={{ padding: "var(--space-3)" }}>
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Box style={{ color: "var(--crimson-11)" }}>
								<StarRegular />
							</Box>
							<Heading size="3">Spicy Lyrics</Heading>
						</Flex>
						<Text size="2" color="gray">
							Renderer and font adapted from{" "}
							<Link
								href="https://github.com/Spikerko/Spicy-Lyrics"
								target="_blank"
								rel="noreferrer"
							>
								Spicy Lyrics
							</Link>{" "}
							by Spikerko and contributors, licensed under AGPL-3.0-or-later.
						</Text>
					</Flex>
				</Card>
				<Card variant="classic" style={{ padding: "var(--space-3)" }}>
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Box style={{ color: "var(--violet-11)" }}>
								<SettingsRegular />
							</Box>
							<Heading size="3">Fraktality Spring</Heading>
						</Flex>
						<Text size="2" color="gray">
							Analytic spring implementation derived from Fraktality&apos;s{" "}
							<code>spr.lua</code>, licensed under the MIT License.
						</Text>
					</Flex>
				</Card>
				<Card variant="classic" style={{ padding: "var(--space-3)" }}>
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Box style={{ color: "var(--cyan-11)" }}>
								<MusicNote1Regular />
							</Box>
							<Heading size="3">Prosodic Engine</Heading>
						</Flex>
						<Text size="2" color="gray">
							Syllabification engine and dictionary adapted from{" "}
							<Link
								href="https://github.com/amll-dev/amll-editor"
								target="_blank"
								rel="noreferrer"
							>
								amll-dev/amll-editor
							</Link>
							, licensed under GNU AGPL-3.0-only.
						</Text>
					</Flex>
				</Card>
				<Card variant="classic" style={{ padding: "var(--space-3)" }}>
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Box style={{ color: "var(--gold-11)" }}>
								<BoxRegular />
							</Box>
							<Heading size="3">AMLL TTML Tool</Heading>
						</Flex>
						<Text size="2" color="gray">
							Forked from{" "}
							<Link
								href="https://github.com/amll-dev/amll-ttml-tool"
								target="_blank"
								rel="noreferrer"
							>
								amll-dev/amll-ttml-tool
							</Link>
							, licensed under GPL-3.0-or-later.
						</Text>
					</Flex>
				</Card>
				<Card variant="classic" style={{ padding: "var(--space-3)" }}>
					<Flex direction="column" gap="2">
						<Flex align="center" gap="2">
							<Box style={{ color: "var(--grass-11)" }}>
								<BookRegular />
							</Box>
							<Heading size="3">Romanization</Heading>
						</Flex>
						<Text size="2" color="gray">
							Japanese read with{" "}
							<Link
								href="https://github.com/takuyaa/kuromoji.js"
								target="_blank"
								rel="noreferrer"
							>
								kuromoji
							</Link>{" "}
							(Apache-2.0) and the mecab-ipadic dictionary, Copyright 2000-2003
							Nara Institute of Science and Technology, and written with{" "}
							<Link
								href="https://github.com/hexenq/kuroshiro"
								target="_blank"
								rel="noreferrer"
							>
								kuroshiro
							</Link>
							&apos;s rules (MIT). Cantonese from{" "}
							<Link
								href="https://github.com/CanCLID/to-jyutping"
								target="_blank"
								rel="noreferrer"
							>
								ToJyutping
							</Link>{" "}
							(BSD-2-Clause).
						</Text>
					</Flex>
				</Card>
			</Grid>
		</Flex>
	</Card>
);
