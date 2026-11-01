import { Info20Regular } from "@fluentui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import { atom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
	PreviewModeType,
	previewModeTypeAtom,
} from "$/modules/settings/states/preview";
import { lyricLinesAtom } from "$/states/main";
import { hasHiddenLineTimedVocals } from "./spicy-preview";
import { songExportsLineTimedAtom } from "./states";

const showNoticeAtom = atom(
	(get) =>
		get(previewModeTypeAtom) === PreviewModeType.Spicy &&
		get(songExportsLineTimedAtom) &&
		hasHiddenLineTimedVocals(get(lyricLinesAtom).lyricLines),
);

/** Above the Spicy preview: says why duet sides and background vocals are missing. */
export const LineTimingPreviewNotice = () => {
	const { t } = useTranslation();
	if (!useAtomValue(showNoticeAtom)) return null;
	return (
		<Flex
			align="center"
			gap="2"
			p="2"
			flexShrink="0"
			style={{ background: "var(--gray-a3)" }}
		>
			<Info20Regular
				aria-hidden
				style={{ color: "var(--gray-11)", flexShrink: 0 }}
			/>
			<Text size="2" role="status">
				{t(
					"lineSync.previewNotice",
					"Spicy Lyrics shows line-timed songs without background vocals or duet sides. They are still saved.",
				)}
			</Text>
		</Flex>
	);
};
