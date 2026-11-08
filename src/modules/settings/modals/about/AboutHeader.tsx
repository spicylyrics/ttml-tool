import { APP_VERSION } from "virtual:buildmeta";
import { Badge, Flex, Heading, Text } from "@radix-ui/themes";
import { BrandMark } from "$/components/BrandBand";
import { isBetaVersion, translatedVersionLabel } from "$/utils/version-label";
import styles from "./AboutHeader.module.css";
import type { AboutSettings } from "./useAboutSettings";

/** The top of Preferences › About: which app this is, and which version. */
export const AboutHeader = ({ t }: Pick<AboutSettings, "t">) => (
	<Flex align="center" gap="4">
		<BrandMark className={styles.mark} />
		<Flex direction="column" gap="1" minWidth="0">
			<Heading size="5" className={styles.name}>
				{t("aboutModal.appName", "Spicy Lyrics TTML Tool")}
			</Heading>
			<Flex align="center" gap="2" wrap="wrap">
				<Text size="3" weight="medium" className={styles.version}>
					{translatedVersionLabel(APP_VERSION, t)}
				</Text>
				{isBetaVersion(APP_VERSION) && (
					<Badge variant="soft" radius="full">
						{t("topBar.betaBadge", "Beta")}
					</Badge>
				)}
			</Flex>
			<Text as="div" size="2" color="gray">
				{t(
					"aboutModal.description",
					"A word-by-word TTML editor and timing tool for Apple Music-like lyrics",
				)}
			</Text>
		</Flex>
	</Flex>
);
