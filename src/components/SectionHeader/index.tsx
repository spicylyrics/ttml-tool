import { Heading, Text } from "@radix-ui/themes";
import classNames from "classnames";
import type { FC, ReactNode } from "react";
import styles from "./index.module.css";

export interface SectionHeaderProps {
	title: ReactNode;
	description?: ReactNode;
	/** A Fluent icon before the title. */
	icon?: ReactNode;
	/** Buttons or a picker at the end of the row. */
	actions?: ReactNode;
	/** Radix Heading size: "4" for Preferences groups, "3" inside dialogs. */
	size?: "2" | "3" | "4" | "5";
	as?: "h2" | "h3" | "h4";
	/** Id for the heading, for `aria-labelledby` on the section. */
	id?: string;
	className?: string;
}

/** The title row of a group: a heading, an optional line under it, and actions. */
export const SectionHeader: FC<SectionHeaderProps> = ({
	title,
	description,
	icon,
	actions,
	size = "4",
	as = "h3",
	id,
	className,
}) => (
	<div className={classNames(styles.header, className)} data-section-header="">
		<div className={styles.text}>
			<Heading as={as} size={size} id={id} className={styles.title}>
				{icon && (
					<span className={styles.icon} aria-hidden="true">
						{icon}
					</span>
				)}
				{title}
			</Heading>
			{description && (
				<Text as="p" size="1" color="gray" className={styles.description}>
					{description}
				</Text>
			)}
		</div>
		{actions && <div className={styles.actions}>{actions}</div>}
	</div>
);
