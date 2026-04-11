import {
	ArrowReset24Regular,
	Color24Regular,
	Sparkle24Regular,
	Target24Regular,
	TextFont24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Grid,
	Heading,
	IconButton,
	Popover,
	SegmentedControl,
	Slider,
	Switch,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { backgroundGradients } from "$/modules/settings/states/gradients";
import {
	accentColorAtom,
	appFontAtom,
	backgroundModeAtom,
	customAccentColorAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	selectedGradientAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
} from "$/modules/settings/states/index.ts";
import { fontSelectionDialogAtom } from "$/states/dialogs.ts";
import { isDarkThemeAtom } from "$/states/main.ts";
import { generateGradient, generateRadixScale } from "$/utils/colorScale";
import {
	SettingsCustomBackgroundCard,
	SettingsCustomBackgroundSettings,
} from "./customBackground";

const accentColors = [
	"gray",
	"gold",
	"bronze",
	"brown",
	"yellow",
	"amber",
	"orange",
	"tomato",
	"red",
	"ruby",
	"crimson",
	"pink",
	"plum",
	"purple",
	"violet",
	"iris",
	"indigo",
	"blue",
	"cyan",
	"teal",
	"jade",
	"green",
	"grass",
	"lime",
	"mint",
	"sky",
] as const;

export const SettingsAppearanceTab = () => {
	const [accentColor, setAccentColor] = useAtom(accentColorAtom);
	const [useCustomAccent, setUseCustomAccent] = useAtom(useCustomAccentAtom);
	const [customAccentColor, setCustomAccentColor] = useAtom(
		customAccentColorAtom,
	);
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const customScale = useMemo(
		() =>
			generateRadixScale(
				customAccentColor,
				isDarkTheme,
			),
		[
			customAccentColor,
			isDarkTheme,
		],
	);

	const [backgroundMode, setBackgroundMode] = useAtom(backgroundModeAtom);
	const [selectedGradient, setSelectedGradient] = useAtom(selectedGradientAtom);
	const [useCustomGradient, setUseCustomGradient] = useAtom(
		useCustomGradientAtom,
	);
	const [customGradientColors, setCustomGradientColors] = useAtom(
		customGradientColorsAtom,
	);
	const [customGradientType, setCustomGradientType] = useAtom(
		customGradientTypeAtom,
	);
	const [customGradientOpacity, setCustomGradientOpacity] = useAtom(
		customGradientOpacityAtom,
	);
	const [customGradientCenter, setCustomGradientCenter] = useAtom(
		customGradientCenterAtom,
	);
	const [customGradientAngle, setCustomGradientAngle] = useAtom(
		customGradientAngleAtom,
	);
	const [customGradientSize, setCustomGradientSize] = useAtom(
		customGradientSizeAtom,
	);
	const [appFont] = useAtom(appFontAtom);
	const setIsFontSelectionOpen = useSetAtom(fontSelectionDialogAtom);

	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
	const { t } = useTranslation();

	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="2">
				<Heading size="4">{t("settings.appearance.theme", "Theme")}</Heading>

				<Card>
					<Flex direction="column" gap="4">
						<Flex gap="3" align="start">
							<Color24Regular />
							<Box flexGrow="1">
								<Flex direction="column" gap="3">
									<Flex align="center" justify="between">
										<Flex direction="column" gap="1">
											<Text>
												{t(
													"settings.appearance.useCustomAccent",
													"Custom Accent Color",
												)}
											</Text>
											<Text size="1" color="gray">
												{t(
													"settings.appearance.useCustomAccentDesc",
													"Set Accent color",
												)}
											</Text>
										</Flex>
										<Switch
											checked={useCustomAccent}
											onCheckedChange={setUseCustomAccent}
										/>
									</Flex>

									{useCustomAccent ? (
										<Flex direction="column" gap="3">
											<Flex align="center" gap="3">
												<input
													type="color"
													value={customAccentColor}
													onChange={(e) => {
														const newColor = e.target.value;
														setCustomAccentColor(newColor);
													}}
													style={{
														width: "40px",
														height: "40px",
														padding: 0,
														border: "none",
														borderRadius: "var(--radius-3)",
														cursor: "pointer",
														backgroundColor: "transparent",
													}}
												/>
												<Text size="2" weight="bold">
													{customAccentColor.toUpperCase()}
												</Text>
											</Flex>
											<Grid columns="12" gap="1">
												{Array.from({ length: 12 }).map((_, i) => (
													<Box
														key={`shade-${i + 1}`}
														style={{
															height: "20px",
															borderRadius: "var(--radius-1)",
															backgroundColor: customScale[`--accent-${i + 1}`],
														}}
													/>
												))}
											</Grid>
										</Flex>
									) : (
										<Grid columns="8" gap="2">
											{accentColors.map((color) => (
												<Tooltip key={color} content={color}>
													<IconButton
														size="2"
														variant={accentColor === color ? "solid" : "soft"}
														color={color}
														style={{
															borderRadius: "var(--radius-2)",
															cursor: "pointer",
														}}
														onClick={() => setAccentColor(color)}
													>
														<Box
															style={{
																width: "12px",
																height: "12px",
																borderRadius: "50%",
																backgroundColor: "currentColor",
															}}
														/>
													</IconButton>
												</Tooltip>
											))}
										</Grid>
									)}
								</Flex>
							</Box>
						</Flex>
					</Flex>
				</Card>

			</Flex>

			<Flex direction="column" gap="3">
				<Heading size="4">
					{t("settings.appearance.background", "Background")}
				</Heading>

				<SegmentedControl.Root
					value={backgroundMode}
					onValueChange={(v) =>
						setBackgroundMode(v as "none" | "image" | "gradient")
					}
				>
					<SegmentedControl.Item value="none">
						{t("settings.appearance.mode.none", "None")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value="image">
						{t("settings.appearance.mode.image", "Image")}
					</SegmentedControl.Item>
					<SegmentedControl.Item value="gradient">
						{t("settings.appearance.mode.gradient", "Gradient")}
					</SegmentedControl.Item>
				</SegmentedControl.Root>

				{backgroundMode === "image" && (
					<SettingsCustomBackgroundCard
						onOpen={() => setShowBackgroundSettings(true)}
					/>
				)}

				{backgroundMode === "gradient" && (
					<Card>
						<Flex direction="column" gap="4">
							<Flex gap="3" align="start">
								<Sparkle24Regular />
								<Box flexGrow="1">
									<Flex direction="column" gap="3">
										<Flex align="center" justify="between">
											<Flex direction="column" gap="1">
												<Text>
													{t(
														"settings.appearance.useCustomGradient",
														"Custom Gradient Color",
													)}
												</Text>
												<Text size="1" color="gray">
													{t(
														"settings.appearance.useCustomGradientDesc",
														"Generate a gradient from a single color.",
													)}
												</Text>
											</Flex>
											<Switch
												checked={useCustomGradient}
												onCheckedChange={setUseCustomGradient}
											/>
										</Flex>

										{useCustomGradient ? (
											<Flex direction="column" gap="4">
												<Flex align="center" justify="between">
													<Text>
														{t(
															"settings.appearance.syncGradientToAccent",
															"Sync first color with Accent",
														)}
													</Text>
													<Button
														variant="soft"
														onClick={() => {
															const newGradientColors = [
																...customGradientColors,
															];
															newGradientColors[0] = customAccentColor;
															setCustomGradientColors(newGradientColors);
														}}
													>
														{t("common.sync", "Sync")}
													</Button>
												</Flex>
												<Flex align="center" gap="3" wrap="wrap">
													{customGradientColors.map((color, idx) => (
														// biome-ignore lint/suspicious/noArrayIndexKey: primitive array without unique IDs
														<Flex key={idx} align="center" gap="2">
															<input
																type="color"
																value={color}
																onChange={(e) => {
																	const newColor = e.target.value;
																	const newColors = [...customGradientColors];
																	newColors[idx] = newColor;
																	setCustomGradientColors(newColors);
																}}
																style={{
																	width: "40px",
																	height: "40px",
																	padding: 0,
																	border: "none",
																	borderRadius: "var(--radius-3)",
																	cursor: "pointer",
																	backgroundColor: "transparent",
																}}
															/>
															{customGradientColors.length > 1 && (
																<Button
																	variant="soft"
																	color="red"
																	size="1"
																	onClick={() => {
																		setCustomGradientColors(
																			customGradientColors.filter(
																				(_, i) => i !== idx,
																			),
																		);
																	}}
																>
																	{t("common.remove", "Remove")}
																</Button>
															)}
														</Flex>
													))}
													{customGradientColors.length < 4 && (
														<Button
															variant="outline"
															onClick={() => {
																setCustomGradientColors([
																	...customGradientColors,
																	"#ffffff",
																]);
															}}
														>
															{t(
																"settings.appearance.addGradientColor",
																"Add Color",
															)}
														</Button>
													)}
												</Flex>
												<Flex align="center" justify="between">
													<Text>
														{t(
															"settings.appearance.gradientType",
															"Gradient Type",
														)}
													</Text>
													<SegmentedControl.Root
														value={customGradientType}
														onValueChange={(v) =>
															setCustomGradientType(
																v as "linear" | "radial" | "conic",
															)
														}
													>
														<SegmentedControl.Item value="linear">
															{t("settings.appearance.type.linear", "Linear")}
														</SegmentedControl.Item>
														<SegmentedControl.Item value="radial">
															{t("settings.appearance.type.radial", "Radial")}
														</SegmentedControl.Item>
														<SegmentedControl.Item value="conic">
															{t("settings.appearance.type.conic", "Conic")}
														</SegmentedControl.Item>
													</SegmentedControl.Root>
												</Flex>
												<Flex direction="column" gap="2">
													<Flex align="center" justify="between">
														<Text>
															{t(
																"settings.appearance.gradientOpacity",
																"Gradient Opacity",
															)}
														</Text>
														<Text wrap="nowrap" color="gray" size="1">
															{Math.round(customGradientOpacity * 100)}%
														</Text>
													</Flex>
													<Slider
														min={0}
														max={1}
														step={0.01}
														value={[customGradientOpacity]}
														onValueChange={(v) =>
															setCustomGradientOpacity(v[0])
														}
													/>
												</Flex>
												<Flex direction="column" gap="2">
													<Flex align="center" justify="between">
														<Text>
															{t(
																"settings.appearance.gradientSize",
																"Gradient Scale",
															)}
														</Text>
														<Text wrap="nowrap" color="gray" size="1">
															{Math.round(customGradientSize * 100)}%
														</Text>
													</Flex>
													<Slider
														min={0.1}
														max={3}
														step={0.1}
														value={[customGradientSize]}
														onValueChange={(v) => setCustomGradientSize(v[0])}
													/>
												</Flex>
												<Flex align="center" gap="2">
													<Popover.Root>
														<Popover.Trigger>
															<Button variant="soft" style={{ flexGrow: 1 }}>
																<Target24Regular />
																{t(
																	"settings.appearance.gradientPositionSettings",
																	"Adjust Center & Angle",
																)}
															</Button>
														</Popover.Trigger>
														<Popover.Content size="2" style={{ width: 300 }}>
															<Flex direction="column" gap="3">
																<Text weight="bold" size="2">
																	{t(
																		"settings.appearance.gradientPositionSettings",
																		"Center & Angle",
																	)}
																</Text>

																{customGradientType !== "linear" && (
																	<>
																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientCenterX",
																				"Center X (Horizontal)",
																			)}
																			: {customGradientCenter[0]}%
																		</Text>
																		<Slider
																			min={0}
																			max={100}
																			step={1}
																			value={[customGradientCenter[0]]}
																			onValueChange={(v) =>
																				setCustomGradientCenter([
																					v[0],
																					customGradientCenter[1],
																				])
																			}
																		/>

																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientCenterY",
																				"Center Y (Vertical)",
																			)}
																			: {customGradientCenter[1]}%
																		</Text>
																		<Slider
																			min={0}
																			max={100}
																			step={1}
																			value={[customGradientCenter[1]]}
																			onValueChange={(v) =>
																				setCustomGradientCenter([
																					customGradientCenter[0],
																					v[0],
																				])
																			}
																		/>
																	</>
																)}

																{customGradientType !== "radial" && (
																	<>
																		<Text size="1" color="gray">
																			{t(
																				"settings.appearance.gradientAngle",
																				"Angle",
																			)}
																			: {customGradientAngle}°
																		</Text>
																		<Slider
																			min={0}
																			max={360}
																			step={1}
																			value={[customGradientAngle]}
																			onValueChange={(v) =>
																				setCustomGradientAngle(v[0])
																			}
																		/>
																	</>
																)}
															</Flex>
														</Popover.Content>
													</Popover.Root>
													<IconButton
														variant="outline"
														onClick={() => {
															setCustomGradientCenter([50, 50]);
															setCustomGradientAngle(45);
														}}
													>
														<ArrowReset24Regular />
													</IconButton>
												</Flex>
												<Box
													style={{
														height: "40px",
														borderRadius: "var(--radius-2)",
														background: generateGradient(
															customGradientColors,
															customGradientType,
															customGradientCenter,
															customGradientAngle,
															customGradientSize,
														),
														marginTop: "var(--space-2)",
													}}
												/>
											</Flex>
										) : (
											<Grid columns="4" gap="2">
												{backgroundGradients.map((gradient) => (
													<Tooltip key={gradient.id} content={gradient.name}>
														<Box
															style={{
																height: "40px",
																borderRadius: "var(--radius-2)",
																background: gradient.css,
																cursor: "pointer",
																outline:
																	selectedGradient === gradient.id
																		? "2px solid var(--accent-9)"
																		: "none",
																outlineOffset: "2px",
															}}
															onClick={() => setSelectedGradient(gradient.id)}
														/>
													</Tooltip>
												))}
											</Grid>
										)}
									</Flex>
								</Box>
							</Flex>
						</Flex>
					</Card>
				)}


			</Flex>
			<Flex direction="column" gap="3">
				<Heading size="4">
					{t("settings.appearance.font", "Application Font")}
				</Heading>
				<Card>
					<Flex direction="column" gap="3">
						<Flex direction="column" gap="1">
							<Text size="2" weight="bold">
								{t("settings.appearance.currentFont", "Current Font")}
							</Text>
							<Text size="1" color="gray" style={{ fontFamily: appFont }}>
								{appFont.split(",")[0].replace(/"/g, "")}
							</Text>
						</Flex>
						<Button
							variant="soft"
							style={{ cursor: "pointer" }}
							onClick={() => setIsFontSelectionOpen(true)}
						>
							<TextFont24Regular />
							{t("settings.appearance.changeFont", "Change Font...")}
						</Button>
					</Flex>
				</Card>
			</Flex>
		</Flex>
	);
};
