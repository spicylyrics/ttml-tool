import { ChevronDownRegular } from "@fluentui/react-icons";
import {
	Button,
	DropdownMenu,
	Flex,
	SegmentedControl,
	Text,
} from "@radix-ui/themes";
import styles from "./index.module.css";

export interface PickerOption<T extends string> {
	value: T;
	label: string;
	/** One line under the label in the menu; the trigger only shows the label. */
	description?: string;
}

export type OptionPickerVariant = "menu" | "segmented";

/**
 * A choice between a few named modes.
 *
 * - `menu` (default): the trigger shows only the current label and the menu
 *   explains each option. Use it where width is tight: ribbons, toolbars, popovers.
 * - `segmented`: every option side by side. Use it where there is room, since a
 *   dropdown for two or three options just hides them.
 */
export function OptionPicker<T extends string>({
	value,
	options,
	onValueChange,
	label,
	size = "1",
	variant = "menu",
	fullWidth = false,
}: {
	value: T;
	options: readonly PickerOption<T>[];
	onValueChange: (value: T) => void;
	/** Accessible name for the trigger, usually the setting's title. */
	label: string;
	size?: "1" | "2" | "3";
	variant?: OptionPickerVariant;
	/** Segmented only: stretch to the container and share the width evenly. */
	fullWidth?: boolean;
}) {
	const current = options.find((option) => option.value === value);
	const select = (next: string) => {
		const option = options.find((item) => item.value === next);
		if (option) onValueChange(option.value);
	};
	if (variant === "segmented") {
		return (
			<SegmentedControl.Root
				value={value}
				onValueChange={select}
				size={size}
				aria-label={label}
				className={fullWidth ? styles.fullWidth : undefined}
			>
				{options.map((option) => (
					<SegmentedControl.Item
						key={option.value}
						value={option.value}
						title={option.description}
					>
						{option.label}
					</SegmentedControl.Item>
				))}
			</SegmentedControl.Root>
		);
	}
	const menuSize = size === "1" ? "1" : "2";
	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<Button
					variant="soft"
					color="gray"
					size={menuSize}
					aria-label={`${label}: ${current?.label ?? value}`}
					className={styles.trigger}
					title={current?.label ?? value}
				>
					<span className={styles.triggerLabel}>{current?.label ?? value}</span>
					<ChevronDownRegular className={styles.chevron} />
				</Button>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content
				size={menuSize}
				className={`${styles.content} ${menuSize === "2" ? styles.size2 : styles.size1}`}
			>
				<DropdownMenu.RadioGroup value={value} onValueChange={select}>
					{options.map((option) => (
						<DropdownMenu.RadioItem
							key={option.value}
							value={option.value}
							className={styles.item}
						>
							<Flex direction="column" gap="0">
								<Text size={menuSize} weight="medium">
									{option.label}
								</Text>
								{option.description && (
									<Text size="1" className={styles.description}>
										{option.description}
									</Text>
								)}
							</Flex>
						</DropdownMenu.RadioItem>
					))}
				</DropdownMenu.RadioGroup>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
