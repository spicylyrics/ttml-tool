import { ArrowReset24Regular } from "@fluentui/react-icons";
import { Box, Flex, IconButton, Slider, Text, Tooltip } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
export const ResetColorButton = ({ onClick }: { onClick: () => void }) => {
	const { t } = useTranslation();
	const label = t(
		"settings.appearance.advanced.resetToDefault",
		"Reset to default",
	);
	return (
		<Tooltip content={label}>
			<IconButton
				size="1"
				variant="ghost"
				color="gray"
				onClick={onClick}
				aria-label={label}
			>
				<ArrowReset24Regular />
			</IconButton>
		</Tooltip>
	);
};
export const AdvancedColorItem = ({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) => (
	<Flex direction="column" gap="1">
		<Flex align="center" justify="between">
			<Text size="1" color="gray" weight="bold">
				{label}
			</Text>
			{value && <ResetColorButton onClick={() => onChange("")} />}
		</Flex>
		<input
			type="color"
			value={value || "#000000"}
			onChange={(e) => onChange(e.target.value)}
			style={{
				width: "100%",
				height: "24px",
				border: "1px solid var(--gray-5)",
				borderRadius: "4px",
				cursor: "pointer",
				padding: 0,
			}}
		/>
	</Flex>
);
export const AdvancedSliderItem = ({
	label,
	icon,
	value,
	min,
	max,
	step = 1,
	onChange,
	unit,
}: {
	label: string;
	icon: React.ReactNode;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (v: number) => void;
	unit: string;
}) => (
	<Box>
		<Flex align="center" justify="between" mb="1">
			<Flex align="center" gap="2">
				<Box
					style={{
						color: "var(--accent-11)",
						display: "flex",
						alignItems: "center",
					}}
				>
					{icon}
				</Box>
				<Text size="1" weight="bold">
					{label}
				</Text>
			</Flex>
			<Text size="1" color="gray">
				{value}
				{unit}
			</Text>
		</Flex>
		<Slider
			min={min}
			max={max}
			step={step}
			value={[value]}
			onValueChange={(v) => onChange(v[0])}
		/>
	</Box>
);
