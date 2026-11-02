import { Flex, Grid, Text } from "@radix-ui/themes";
import { OptionPicker } from "$/components/OptionPicker";
import { Panel } from "$/components/Panel";
import type { FontSelection } from "./useFontSelection";
export const FontStyleSection = ({
	t,
	appFontWeight,
	setAppFontWeight,
	appFontStyle,
	setAppFontStyle,
}: Pick<
	FontSelection,
	| "t"
	| "appFontWeight"
	| "setAppFontWeight"
	| "appFontStyle"
	| "setAppFontStyle"
>) => (
	<Panel tone="sunken" style={{ padding: "var(--space-7)" }}>
		<Grid columns="2" gap="6" width="100%">
			<Flex direction="column" gap="3">
				<Text size="4" weight="bold" mb="2">
					{t("settings.appearance.fontWeight", "Font weight")}
				</Text>
				<OptionPicker
					variant="segmented"
					size="3"
					fullWidth
					value={appFontWeight}
					onValueChange={setAppFontWeight}
					label={t("settings.appearance.fontWeight", "Font weight")}
					options={[
						{
							value: "400",
							label: t("settings.appearance.weight.regular", "Regular"),
						},
						{
							value: "700",
							label: t("settings.appearance.weight.bold", "Bold"),
						},
					]}
				/>
			</Flex>
			<Flex direction="column" gap="3">
				<Text size="4" weight="bold" mb="2">
					{t("settings.appearance.fontStyle", "Font style")}
				</Text>
				<OptionPicker
					variant="segmented"
					size="3"
					fullWidth
					value={appFontStyle}
					onValueChange={setAppFontStyle}
					label={t("settings.appearance.fontStyle", "Font style")}
					options={[
						{
							value: "normal",
							label: t("settings.appearance.style.normal", "Normal"),
						},
						{
							value: "italic",
							label: t("settings.appearance.style.italic", "Italic"),
						},
					]}
				/>
			</Flex>
		</Grid>
	</Panel>
);
