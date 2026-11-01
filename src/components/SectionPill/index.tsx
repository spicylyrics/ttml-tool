import type { ComponentPropsWithoutRef } from "react";
import styles from "./index.module.css";

/** For pills built outside React, like the markup editor's header widget. */
export const sectionPillClassName = styles.pill;

/** A section's name as a pill in its type's colour. A button when it has a click handler. */
export function SectionPill({
	category,
	className,
	children,
	...props
}: {
	category: string | undefined;
} & ComponentPropsWithoutRef<"button">) {
	const shared = {
		className: className ? `${styles.pill} ${className}` : styles.pill,
		"data-category": category ?? "other",
	};
	if (!props.onClick)
		return (
			<span {...shared} style={props.style} title={props.title}>
				{children}
			</span>
		);
	return (
		<button type="button" {...props} {...shared}>
			{children}
		</button>
	);
}
