import { Button, Flex, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { PreviewProblemsBanner } from "$/modules/preview-problems/PreviewProblemsBanner";
import {
	PreviewModeType,
	previewModeTypeAtom,
} from "$/modules/settings/states/preview";
import { lazy } from "$/utils/lazy.ts";
import { jumpToFirstUntimedLineAtom, untimedPreviewLinesAtom } from "./states";

const AMLLWrapper = lazy(() => import("$/components/AMLLWrapper"));
const TimingOverview = lazy(() => import("$/components/TimingOverview"));
const SpicyLyrics = lazy(() => import("$/components/SpicyLyrics"));

export const PreviewModeSwitcher = () => {
	const previewModeType = useAtomValue(previewModeTypeAtom);
	const untimedLines = useAtomValue(untimedPreviewLinesAtom);
	const jumpToUntimed = useSetAtom(jumpToFirstUntimedLineAtom);
	const { t } = useTranslation();

	return (
		<Flex
			direction="column"
			height="100%"
			width="100%"
			style={{ minHeight: 0 }}
		>
			<Flex
				flexGrow="1"
				direction="column"
				style={{ minHeight: 0, position: "relative" }}
			>
				{/* Over the Spicy preview, whose top is empty space, so it doesn't
				    jump as banners come and go while lines get timed. The list
				    previews start at the top, so there they stay in flow. */}
				<Flex
					direction="column"
					flexShrink="0"
					style={
						previewModeType === PreviewModeType.Spicy
							? {
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									zIndex: 1,
								}
							: undefined
					}
				>
					{untimedLines.length > 0 && (
						<Flex
							align="center"
							justify="between"
							gap="2"
							p="2"
							wrap="wrap"
							flexShrink="0"
							style={{
								background:
									"linear-gradient(var(--gray-a3), var(--gray-a3)), var(--color-panel-solid)",
							}}
						>
							<Text size="2" role="status">
								{t("preview.untimedLines", "{count} lines have no timing yet", {
									count: untimedLines.length,
								})}
							</Text>
							<Button size="1" variant="soft" onClick={jumpToUntimed}>
								{t("preview.jumpToUntimed", "Time the first untimed line")}
							</Button>
						</Flex>
					)}
					<PreviewProblemsBanner />
				</Flex>
				<Suspense fallback={<SuspensePlaceHolder />}>
					{previewModeType === PreviewModeType.Standard && (
						<AMLLWrapper variant="standard" />
					)}
					{previewModeType === PreviewModeType.Toxi && (
						<AMLLWrapper variant="toxi" />
					)}
					{previewModeType === PreviewModeType.Spicy && <SpicyLyrics />}
					{previewModeType === PreviewModeType.Timing && <TimingOverview />}
				</Suspense>
			</Flex>
		</Flex>
	);
};

export default PreviewModeSwitcher;
