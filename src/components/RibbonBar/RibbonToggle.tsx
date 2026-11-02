import { Text } from "@radix-ui/themes";
import type { Atom, WritableAtom } from "jotai";
import { type FC, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import type { ToggleAction } from "$/modules/menu-actions/ribbon-actions";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import type { KeyBindingsConfig } from "$/utils/keybindings";

/** A ribbon label that shows the control's tooltip. */
export const RibbonLabel: FC<{
	label: string;
	description?: ReactNode;
	shortcut?: Atom<KeyBindingsConfig>;
	htmlFor?: string;
	/** Shown before the text, for fields with a role icon. */
	icon?: ReactNode;
}> = ({ label, description, shortcut, htmlFor, icon }) => (
	<ActionTooltip label={label} description={description} shortcut={shortcut}>
		<Text
			wrap="nowrap"
			size="1"
			asChild
			style={{
				color: "var(--ribbon-label-color)",
				...(icon && {
					display: "inline-flex",
					alignItems: "center",
					gap: "var(--space-1)",
				}),
			}}
		>
			<label htmlFor={htmlFor}>
				{icon}
				{label}
			</label>
		</Text>
	</ActionTooltip>
);

/** A ribbon toggle drawn from its shared definition, so its label and shortcut match the command's. */
export const RibbonActionToggle: FC<{
	action: ToggleAction;
	description?: ReactNode;
	/** Shown before the label, for toggles about a role. */
	icon?: ReactNode;
}> = ({ action, description, icon }) => {
	const { t } = useTranslation();
	return (
		<RibbonToggle
			label={action.label((key, fallback) => t(key, fallback))}
			description={description}
			shortcut={action.command.atom}
			setting={action.setting}
			icon={icon}
		/>
	);
};

/** A label and checkbox pair for a two-column ribbon grid, both with the tooltip. */
export const RibbonToggle: FC<{
	label: string;
	description?: ReactNode;
	shortcut?: Atom<KeyBindingsConfig>;
	setting: WritableAtom<boolean, [boolean], unknown>;
	/** Shown before the label, for toggles about a role. */
	icon?: ReactNode;
}> = ({ label, description, shortcut, setting, icon }) => {
	const id = useId();
	return (
		<>
			<RibbonLabel
				label={label}
				description={description}
				shortcut={shortcut}
				htmlFor={id}
				icon={icon}
			/>
			<ActionTooltip
				label={label}
				description={description}
				shortcut={shortcut}
			>
				<SettingToggle setting={setting} compact id={id} />
			</ActionTooltip>
		</>
	);
};
