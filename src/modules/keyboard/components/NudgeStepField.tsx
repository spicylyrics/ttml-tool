import { TimerRegular } from "@fluentui/react-icons";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, useId } from "react";
import { useTranslation } from "react-i18next";
import { DraftNumberField } from "$/components/DraftNumberField";
import {
	MAX_NUDGE_STEP_MS,
	MIN_NUDGE_STEP_MS,
} from "$/modules/lyric-editor/utils/nudge-timing";
import { nudgeStepAtom } from "$/modules/settings/states/sync";

/** The actions whose step this field sets. */
export const NUDGE_COMMANDS: ReadonlySet<string> = new Set([
	"nudgeEarlier",
	"nudgeLater",
	"nudgeEndEarlier",
	"nudgeEndLater",
]);

/** How many milliseconds Nudge earlier and Nudge later move per press. */
export const NudgeStepField: FC = () => {
	const { t } = useTranslation();
	const [step, setStep] = useAtom(nudgeStepAtom);
	const id = useId();
	const descriptionId = useId();

	return (
		<Flex align="center" justify="between" gap="3">
			<div>
				<Text as="label" htmlFor={id} size="2">
					{t("keyboardView.nudgeStep")}
				</Text>
				<Text as="div" id={descriptionId} size="1" color="gray">
					{t("keyboardView.nudgeStepDesc")}
				</Text>
			</div>
			<DraftNumberField
				id={id}
				size="1"
				integer
				min={MIN_NUDGE_STEP_MS}
				max={MAX_NUDGE_STEP_MS}
				step={1}
				value={step}
				onCommit={setStep}
				aria-describedby={descriptionId}
				style={{ width: "8em", flexShrink: 0 }}
			>
				<TextField.Slot>
					<TimerRegular />
				</TextField.Slot>
				<TextField.Slot>
					<Text size="1" color="gray">
						{t("keyboardView.nudgeStepUnit")}
					</Text>
				</TextField.Slot>
			</DraftNumberField>
		</Flex>
	);
};
