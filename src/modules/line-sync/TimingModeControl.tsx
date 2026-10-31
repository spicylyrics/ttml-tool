import { Flex } from "@radix-ui/themes";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import {
	OptionPicker,
	type OptionPickerVariant,
} from "$/components/OptionPicker";
import { RibbonSection } from "$/components/RibbonBar/common";
import { confirmDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import type { TimingMode } from "$/types/ttml";
import { songTimingModeAtom } from "./states";
import {
	hasWordTimings,
	switchToLineMode,
	switchToWordMode,
} from "./timing-mode";

/** Word/Line picker for the open song. Word → Line asks first when it would drop word timings. */
export function TimingModeControl({
	variant,
}: {
	variant?: OptionPickerVariant;
} = {}) {
	const { t } = useTranslation();
	const store = useStore();
	const value = useAtomValue(songTimingModeAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);

	const onValueChange = useCallback(
		(next: TimingMode) => {
			if (next === store.get(songTimingModeAtom)) return;
			if (next === "word") {
				store.set(lyricLinesAtom, switchToWordMode);
				return;
			}
			const apply = () => store.set(lyricLinesAtom, switchToLineMode);
			if (!hasWordTimings(store.get(lyricLinesAtom))) {
				apply();
				return;
			}
			setConfirmDialog({
				open: true,
				title: t("lineSync.confirmTitle", "Switch to Line timing?"),
				description: t(
					"lineSync.confirmDescription",
					"Every word keeps its text but loses its own timing. Each line keeps its start and end. You can undo this.",
				),
				confirmText: t("lineSync.confirmAction", "Switch to Line"),
				onConfirm: apply,
			});
		},
		[store, setConfirmDialog, t],
	);

	return (
		<OptionPicker
			variant={variant}
			value={value}
			onValueChange={onValueChange}
			label={t("lineSync.timing", "Song timing")}
			options={[
				{ value: "word", label: t("lineSync.word", "Word") },
				{ value: "line", label: t("lineSync.line", "Line") },
			]}
		/>
	);
}

/** Time ribbon section for the song's timing mode. */
export function TimingModeRibbonSection() {
	const { t } = useTranslation();
	const label = t("lineSync.timing", "Song timing");
	return (
		<RibbonSection label={label}>
			<Flex
				direction="column"
				gap="2"
				align="center"
				justify="center"
				px="2"
				style={{ height: "100%" }}
			>
				<ActionTooltip
					label={label}
					description={t(
						"lineSync.timingDesc",
						"Word: every word gets its own time. Line: only whole lines are timed, and the TTML is exported line-synced.",
					)}
				>
					<TimingModeControl />
				</ActionTooltip>
			</Flex>
		</RibbonSection>
	);
}
