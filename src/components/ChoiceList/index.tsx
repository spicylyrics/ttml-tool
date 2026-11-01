import { RadioGroup } from "radix-ui";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export interface Choice<T extends string> {
	value: T;
	title: ReactNode;
	/** Beside the title, quieter: a time, a count. */
	meta?: ReactNode;
	/** The second line, truncated to one row. */
	detail?: ReactNode;
	/** Right-aligned, e.g. a score. */
	trailing?: ReactNode;
}

/**
 * Pick one of a short list of things that need a second line to tell apart,
 * like sections with the same name. Arrow keys move between rows; the picked
 * row gets a fill rather than a radio dot.
 */
export function ChoiceList<T extends string>({
	value,
	choices,
	onValueChange,
	label,
}: {
	value: T | undefined;
	choices: readonly Choice<T>[];
	onValueChange: (value: T) => void;
	/** Accessible name for the group. */
	label: string;
}) {
	return (
		<RadioGroup.Root
			className={styles.list}
			value={value ?? ""}
			onValueChange={(next) => onValueChange(next as T)}
			aria-label={label}
		>
			{choices.map((choice) => (
				<RadioGroup.Item
					key={choice.value}
					value={choice.value}
					className={styles.row}
				>
					<span className={styles.main}>
						<span className={styles.head}>
							<span className={styles.title}>{choice.title}</span>
							{choice.meta && (
								<span className={styles.meta}>{choice.meta}</span>
							)}
						</span>
						{choice.detail && (
							<span className={styles.detail}>{choice.detail}</span>
						)}
					</span>
					{choice.trailing && (
						<span className={styles.trailing}>{choice.trailing}</span>
					)}
				</RadioGroup.Item>
			))}
		</RadioGroup.Root>
	);
}
