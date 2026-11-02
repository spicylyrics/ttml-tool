import { Separator, Text } from "@radix-ui/themes";
import classNames from "classnames";
import type { FC, ReactNode } from "react";
import styles from "./index.module.css";

export interface ToolbarGroupProps {
	/** Accessible name for the group. Shown as a caption when `showLabel` is on. */
	label: string;
	showLabel?: boolean;
	/** Draw a hairline before the group, to split it from the one before. */
	separated?: boolean;
	/** Let controls wrap onto a second line when the row is too narrow. */
	wrap?: boolean;
	children: ReactNode;
	className?: string;
}

/**
 * A row of related controls (search plus import, zoom in and out). Only a
 * labelled group: Tab still moves through each control, there is no arrow-key
 * roving like a full toolbar.
 */
export const ToolbarGroup: FC<ToolbarGroupProps> = ({
	label,
	showLabel = false,
	separated = false,
	wrap = false,
	children,
	className,
}) => (
	<div className={classNames(styles.wrapper, className)}>
		{separated && (
			<Separator orientation="vertical" size="1" className={styles.separator} />
		)}
		<div className={styles.column}>
			{showLabel && (
				<Text as="span" size="1" color="gray" aria-hidden="true">
					{label}
				</Text>
			)}
			<div
				role="group"
				aria-label={label}
				className={classNames(styles.group, wrap && styles.wrap)}
				data-toolbar-group=""
			>
				{children}
			</div>
		</div>
	</div>
);
