import { Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type FC, useId } from "react";
import { useTranslation } from "react-i18next";
import { doublePressAtom } from "../states";
import type { KeyBindingCommand } from "../types";

/** "Press twice to run" for one action. */
export const DoublePressToggle: FC<{ command: KeyBindingCommand }> = ({
	command,
}) => {
	const { t } = useTranslation();
	const [on, setOn] = useAtom(doublePressAtom(command.id));
	const id = useId();
	const descriptionId = useId();

	return (
		<Flex align="center" justify="between" gap="3">
			<div>
				<Text as="label" htmlFor={id} size="2">
					{t("keyboardView.doublePress")}
				</Text>
				<Text as="div" id={descriptionId} size="1" color="gray">
					{t("keyboardView.doublePressDesc")}
				</Text>
			</div>
			<Switch
				id={id}
				size="1"
				checked={on}
				onCheckedChange={setOn}
				aria-describedby={descriptionId}
			/>
		</Flex>
	);
};
