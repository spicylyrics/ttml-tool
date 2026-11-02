import { Text } from "@radix-ui/themes";
import classNames from "classnames";
import { type FC, type ReactNode, useId } from "react";
import styles from "./index.module.css";

/** Ids for wiring the control: `id={controlId}` and `aria-describedby={descriptionId}`. */
export interface FieldRowIds {
	controlId: string;
	/** Undefined when the row has no description. */
	descriptionId: string | undefined;
}

export interface FieldRowProps {
	label: ReactNode;
	description?: ReactNode;
	/** A Fluent icon, shown before the label. */
	icon?: ReactNode;
	/**
	 * The control. Pass a function to receive the ids, so the label points at
	 * the control and the description is announced with it.
	 */
	children: ReactNode | ((ids: FieldRowIds) => ReactNode);
	/** Put the control under the text, for wide controls such as sliders. */
	stacked?: boolean;
	className?: string;
}

/**
 * One setting: label and description on the left, its control on the right.
 * The label is a real <label> tied to the control by id, so a row can hold a
 * slider or several controls without the whole row turning into one target.
 */
export const FieldRow: FC<FieldRowProps> = ({
	label,
	description,
	icon,
	children,
	stacked = false,
	className,
}) => {
	const baseId = useId();
	const controlId = `${baseId}control`;
	const descriptionId = description ? `${baseId}description` : undefined;
	const control =
		typeof children === "function"
			? children({ controlId, descriptionId })
			: children;
	return (
		<div
			className={classNames(styles.row, stacked && styles.stacked, className)}
			data-field-row=""
			data-stacked={stacked || undefined}
		>
			{icon && (
				<span className={styles.icon} aria-hidden="true">
					{icon}
				</span>
			)}
			<div className={styles.text}>
				<Text as="label" htmlFor={controlId} size="2" className={styles.label}>
					{label}
				</Text>
				{description && (
					<Text
						as="p"
						id={descriptionId}
						size="1"
						color="gray"
						className={styles.description}
					>
						{description}
					</Text>
				)}
			</div>
			<div className={styles.control}>{control}</div>
		</div>
	);
};
