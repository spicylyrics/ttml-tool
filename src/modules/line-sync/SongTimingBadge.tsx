import { ChevronDown16Regular, Warning16Regular } from "@fluentui/react-icons";
import { Badge, Button, DropdownMenu, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { lyricLinesAtom } from "$/states/main";
import type { LyricLine } from "$/types/ttml";
import { clearWordTiming, spreadLineOnlyLines } from "./line-timing";
import { songTimingAtom } from "./states";

/**
 * How the song will export: Word, Line or Not timed, read from the timing
 * itself. Mixed (some lines timed only as a whole, others word by word) offers
 * the two ways to make it one style.
 */
export const SongTimingBadge = () => {
	const { t } = useTranslation();
	const timing = useAtomValue(songTimingAtom);
	const setLyric = useSetAtom(lyricLinesAtom);
	const apply = (fix: (lines: LyricLine[]) => LyricLine[]) =>
		setLyric((prev) => ({ ...prev, lyricLines: fix(prev.lyricLines) }));

	if (timing === "mixed") {
		return (
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<Button size="1" variant="soft" color="amber">
						<Warning16Regular aria-hidden />
						{t("lineSync.mixed", "Mixed")}
						<ChevronDown16Regular aria-hidden />
					</Button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content size="1" style={{ maxWidth: 320 }}>
					<Text as="p" size="1" color="gray" mx="2" my="1">
						{t(
							"lineSync.mixedDesc",
							"Some lines have only a start and end while others are timed word by word. Spicy Lyrics expects one style per song.",
						)}
					</Text>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => apply(spreadLineOnlyLines)}>
						{t("lineSync.spreadWords", "Spread line times across words")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={() => apply(clearWordTiming)}>
						{t("lineSync.clearWords", "Clear word timing")}
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		);
	}

	const label = {
		word: t("lineSync.word", "Word"),
		line: t("lineSync.line", "Line"),
		none: t("lineSync.none", "Not timed"),
	}[timing];
	return (
		<ActionTooltip
			label={t("lineSync.timing", "Song timing")}
			description={t(
				"lineSync.timingDesc",
				"How the song exports: Word when words have their own timing, Line when lines only have a start and end.",
			)}
		>
			<Badge size="2" color="gray" variant="soft" tabIndex={0}>
				{label}
			</Badge>
		</ActionTooltip>
	);
};
