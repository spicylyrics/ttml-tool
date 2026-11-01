import { Button, Flex, Text } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import type { LyricLine } from "$/types/ttml";
import {
	findUnsureSplitWords,
	selectNextUnsureSplitAtom,
} from "../utils/unsure-splits";

const UnsureSplitsToast = ({
	count,
	closeToast,
}: {
	count: number;
	closeToast: () => void;
}) => {
	const { t } = useTranslation();
	const selectNext = useSetAtom(selectNextUnsureSplitAtom);
	return (
		<Flex align="center" justify="between" gap="3">
			<Text size="2" weight="medium">
				{t("unsureSplits.toast", {
					count,
					defaultValue: "{count} unsure splits marked",
				})}
			</Text>
			<Button
				size="1"
				variant="soft"
				onClick={() => {
					selectNext();
					closeToast();
				}}
			>
				{t("unsureSplits.review", "Review")}
			</Button>
		</Flex>
	);
};

/** After an auto-split, says how many splits were marked unsure. */
export function notifyUnsureSplits(lines: LyricLine[]) {
	const count = findUnsureSplitWords(lines).length;
	if (count === 0) return;
	toast.info(
		({ closeToast }) => (
			<UnsureSplitsToast count={count} closeToast={closeToast} />
		),
		{ toastId: "unsure-splits", autoClose: 8000, closeOnClick: false },
	);
}
