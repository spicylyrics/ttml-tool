import { RadioGroup } from "radix-ui";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export interface ChoiceTile<T extends string> {
	value: T;
	icon: ReactNode;
	title: ReactNode;
	/** One short line under the title. */
	detail?: ReactNode;
}

/**
 * The main choice of a dialog, as two or three tiles side by side, each with
 * an icon and a line saying what it does. Arrow keys move between tiles; the
 * picked tile gets a tint and a ring rather than a radio dot.
 */
export function ChoiceTiles<T extends string>({
	value,
	choices,
	onValueChange,
	label,
}: {
	value: T;
	choices: readonly ChoiceTile<T>[];
	onValueChange: (value: T) => void;
	/** Accessible name for the group. */
	label: string;
}) {
	return (
		<RadioGroup.Root
			className={styles.tiles}
			style={{ gridTemplateColumns: `repeat(${choices.length}, 1fr)` }}
			value={value}
			onValueChange={(next) => onValueChange(next as T)}
			aria-label={label}
			orientation="horizontal"
		>
			{choices.map((choice) => (
				<RadioGroup.Item
					key={choice.value}
					value={choice.value}
					className={styles.tile}
				>
					<span className={styles.icon} aria-hidden>
						{choice.icon}
					</span>
					<span className={styles.text}>
						<span className={styles.title}>{choice.title}</span>
						{choice.detail && (
							<span className={styles.detail}>{choice.detail}</span>
						)}
					</span>
				</RadioGroup.Item>
			))}
		</RadioGroup.Root>
	);
}
