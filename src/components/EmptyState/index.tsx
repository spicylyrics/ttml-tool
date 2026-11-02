import { Text } from "@radix-ui/themes";
import classNames from "classnames";
import type { FC, ReactNode } from "react";
import styles from "./index.module.css";

export interface EmptyStateProps {
	title: ReactNode;
	description?: ReactNode;
	/** A Fluent icon (24px reads best), shown on a small plate. */
	icon?: ReactNode;
	/** Buttons that fill the space. */
	actions?: ReactNode;
	/**
	 * Draw its own panel. Leave off inside a card or dialog that already is
	 * one; turn on where it sits on the bare canvas.
	 */
	framed?: boolean;
	className?: string;
}

/**
 * "Nothing here yet": names what belongs in this space and how to fill it, so
 * an empty list reads as not yet, never as broken.
 */
export const EmptyState: FC<EmptyStateProps> = ({
	title,
	description,
	icon,
	actions,
	framed = false,
	className,
}) => (
	<div
		className={classNames(styles.root, framed && styles.framed, className)}
		data-empty-state=""
	>
		{icon && (
			<span className={styles.icon} aria-hidden="true">
				{icon}
			</span>
		)}
		<Text as="p" size="3" weight="medium" className={styles.title}>
			{title}
		</Text>
		{description && (
			<Text as="p" size="2" color="gray" className={styles.description}>
				{description}
			</Text>
		)}
		{actions && <div className={styles.actions}>{actions}</div>}
	</div>
);
