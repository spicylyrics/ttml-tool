import { ContextMenu } from "@radix-ui/themes";
import type { CSSProperties, ReactNode } from "react";
import styles from "./index.module.css";

/**
 * A context menu row for a few related actions that would otherwise take a
 * line each: a label where item text starts, and icon buttons ending where
 * item shortcuts end. The buttons are real menu items, so the arrow keys and
 * Enter reach them like any other.
 */
export function MenuIconRow({
	label,
	children,
}: {
	/** Shown at the start of the row and names the group. */
	label: string;
	children: ReactNode;
}) {
	return (
		<div role="group" aria-label={label} className={styles.row}>
			<span className={styles.label} aria-hidden="true">
				{label}
			</span>
			<div className={styles.controls}>{children}</div>
		</div>
	);
}

/** Toggles that belong together, drawn on one shared track. */
function Track({ children }: { children: ReactNode }) {
	return <div className={styles.track}>{children}</div>;
}

/**
 * An on/off icon button. It's a plain menu item that announces itself as a
 * checkbox: Radix's own checkbox items would indent the whole menu for a
 * checkmark column this row doesn't use.
 */
function Toggle({
	icon,
	label,
	checked,
	onCheckedChange,
	color,
	disabled,
}: {
	icon: ReactNode;
	label: string;
	checked: boolean | "indeterminate";
	onCheckedChange: (checked: boolean) => void;
	/** The role's colour, used for the icon and the fill when on. */
	color?: string;
	disabled?: boolean;
}) {
	return (
		<ContextMenu.Item
			className={styles.button}
			role="menuitemcheckbox"
			aria-checked={checked === "indeterminate" ? "mixed" : checked}
			data-on={checked === true ? "" : undefined}
			data-mixed={checked === "indeterminate" ? "" : undefined}
			onSelect={() => onCheckedChange(checked !== true)}
			disabled={disabled}
			aria-label={label}
			title={label}
			style={
				color ? ({ "--menu-icon-color": color } as CSSProperties) : undefined
			}
		>
			{icon}
		</ContextMenu.Item>
	);
}

/** A one-off action as an icon button, set apart from the toggles. */
function Action({
	icon,
	label,
	onSelect,
	disabled,
}: {
	icon: ReactNode;
	label: string;
	onSelect: () => void;
	disabled?: boolean;
}) {
	return (
		<ContextMenu.Item
			className={styles.button}
			onSelect={onSelect}
			disabled={disabled}
			aria-label={label}
			title={label}
		>
			{icon}
		</ContextMenu.Item>
	);
}

MenuIconRow.Track = Track;
MenuIconRow.Toggle = Toggle;
MenuIconRow.Action = Action;
