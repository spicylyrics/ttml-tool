import { ErrorCircle20Regular } from "@fluentui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	PreviewModeType,
	previewModeTypeAtom,
} from "$/modules/settings/states/preview";
import {
	jumpToFirstTimingProblemAtom,
	previewTimingProblemsAtom,
} from "./states";

/**
 * Count of words with timing problems above the Spicy preview, with a jump to
 * the first one. Renders nothing while the flag is off or nothing is wrong.
 */
export const PreviewProblemsBanner = () => {
	const { t } = useTranslation();
	const previewModeType = useAtomValue(previewModeTypeAtom);
	const issues = useAtomValue(previewTimingProblemsAtom);
	const jump = useSetAtom(jumpToFirstTimingProblemAtom);
	if (previewModeType !== PreviewModeType.Spicy || issues.length === 0)
		return null;
	return (
		<Flex
			align="center"
			justify="between"
			gap="2"
			p="2"
			wrap="wrap"
			flexShrink="0"
			style={{ background: "var(--red-a3)" }}
		>
			<Flex align="center" gap="2">
				<ErrorCircle20Regular
					aria-hidden
					style={{ color: "var(--red-11)", flexShrink: 0 }}
				/>
				<Text size="2" role="status">
					{t(
						"previewProblems.count",
						"{count, plural, one {# word has a timing problem} other {# words have timing problems}}",
						{ count: issues.length },
					)}
				</Text>
			</Flex>
			<Button size="1" variant="soft" color="red" onClick={jump}>
				{t("previewProblems.jump", "Select the first one")}
			</Button>
		</Flex>
	);
};
