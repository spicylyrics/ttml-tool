import {
	BugRegular,
	LightbulbRegular,
	StarRegular,
} from "@fluentui/react-icons";
import { Button, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { reportDialogAtom } from "$/states/dialogs";
import { openExternal } from "./externalLinks";
import type { AboutSettings } from "./useAboutSettings";

export const CommunitySection = ({ t }: Pick<AboutSettings, "t">) => {
	const openReport = useSetAtom(reportDialogAtom);
	return (
		<Card>
			<Flex direction="column" gap="3">
				<Heading size="3">
					{t("aboutModal.community", "Community & contributions")}
				</Heading>
				<Text size="2" color="gray">
					{t(
						"aboutModal.communityDesc",
						"Help us make the tool better by contributing code, reporting issues, or providing translations.",
					)}
				</Text>
				<Flex gap="2" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						onClick={() => openReport("problem")}
					>
						<BugRegular />
						{t("reportDialog.problemTitle", "Report a problem")}
					</Button>
					<Button
						variant="soft"
						color="gray"
						onClick={() => openReport("suggestion")}
					>
						<LightbulbRegular />
						{t("reportDialog.suggestionTitle", "Suggest something")}
					</Button>
					<Button
						variant="soft"
						onClick={() =>
							void openExternal("https://github.com/spicylyrics/ttml-tool")
						}
					>
						<StarRegular />
						{t("aboutModal.github", "Star on GitHub")}
					</Button>
				</Flex>
			</Flex>
		</Card>
	);
};
