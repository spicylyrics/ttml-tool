import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import { Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Children, Fragment, type ReactNode } from "react";
import { ExternalLink } from "./externalLinks";
import type { AboutSettings } from "./useAboutSettings";

/**
 * ICU returns [text, link] for an element value. Children.toArray would copy
 * React's pending missing-key flag onto the keyed clones, so wrap each part in
 * a fresh Fragment; Children.map keys the Fragments by position.
 */
const keyedParts = (parts: ReactNode) =>
	Children.map(parts, (part) => <Fragment>{part}</Fragment>);

/** Build details for bug reports. The version itself is in the header. */
export const VersionSection = ({ t }: Pick<AboutSettings, "t">) => (
	<Card>
		<Flex direction="column" gap="2">
			<Heading size="3">
				{t("aboutModal.buildDetails", "Build details")}
			</Heading>
			<Flex direction="column" gap="1">
				<Text as="div" size="2" color="gray">
					{t("aboutModal.buildDate", "Build date: {date}", {
						date: BUILD_TIME,
					})}
				</Text>
				<Text as="div" size="2" color="gray">
					{t("aboutModal.platform", "Platform: {platform}", {
						platform: window.navigator.platform,
					})}
				</Text>
				<Text as="div" size="2" color="gray">
					{keyedParts(
						t("aboutModal.gitCommit", "Git commit: {commit}", {
							commit:
								GIT_COMMIT === "unknown" ? (
									t("aboutModal.unknown", "Unknown")
								) : (
									<ExternalLink
										href={`https://github.com/spicylyrics/ttml-tool/commit/${GIT_COMMIT}`}
									>
										{GIT_COMMIT}
									</ExternalLink>
								),
						}),
					)}
				</Text>
			</Flex>
		</Flex>
	</Card>
);
