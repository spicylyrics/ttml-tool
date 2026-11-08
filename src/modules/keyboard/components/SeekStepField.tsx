import { TimerRegular } from "@fluentui/react-icons";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { seekStepAtom } from "$/modules/audio/states";
import {
	clampSeekStep,
	MAX_SEEK_STEP,
	MIN_SEEK_STEP,
} from "$/modules/audio/utils/seek-step";

/** The actions whose jump length this field sets. */
export const SEEK_COMMANDS: ReadonlySet<string> = new Set([
	"seekForward",
	"seekBackward",
]);

/** How many seconds Seek forward and Seek backward jump. */
export const SeekStepField: FC = () => {
	const { t } = useTranslation();
	const [step, setStep] = useAtom(seekStepAtom);
	// Typing "0." or clearing the field mid-edit shouldn't snap the value, so
	// the draft only commits on blur or Enter.
	const [draft, setDraft] = useState(String(step));
	useEffect(() => setDraft(String(step)), [step]);
	const id = useId();
	const descriptionId = useId();

	const commit = () => {
		const parsed = Number.parseFloat(draft.replace(",", "."));
		const next = Number.isFinite(parsed) ? clampSeekStep(parsed) : step;
		setStep(next);
		setDraft(String(next));
	};

	return (
		<Flex align="center" justify="between" gap="3">
			<div>
				<Text as="label" htmlFor={id} size="2">
					{t("keyboardView.seekStep")}
				</Text>
				<Text as="div" id={descriptionId} size="1" color="gray">
					{t("keyboardView.seekStepDesc")}
				</Text>
			</div>
			<TextField.Root
				id={id}
				size="1"
				type="number"
				inputMode="decimal"
				min={MIN_SEEK_STEP}
				max={MAX_SEEK_STEP}
				step={0.5}
				value={draft}
				onChange={(event) => setDraft(event.currentTarget.value)}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") commit();
				}}
				aria-describedby={descriptionId}
				style={{ width: "8em", flexShrink: 0 }}
			>
				<TextField.Slot>
					<TimerRegular />
				</TextField.Slot>
				<TextField.Slot>
					<Text size="1" color="gray">
						{t("keyboardView.seekStepUnit")}
					</Text>
				</TextField.Slot>
			</TextField.Root>
		</Flex>
	);
};
