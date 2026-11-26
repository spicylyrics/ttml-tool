import {
	ArrowHookUpLeft24Regular,
	Blur24Regular,
	Dismiss24Regular,
	Eye24Regular,
	Image24Regular,
	Layer24Regular,
	WeatherSunny24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Flex,
	Heading,
	IconButton,
	Slider,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "./customBackground/storage";

export {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageInitAtom,
	customBackgroundImageKeyAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
	readCustomBackgroundBlob,
	writeCustomBackgroundBlob,
} from "./customBackground/storage";
export const SettingsCustomBackgroundSettings = ({
	onClose,
}: {
	onClose: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const setCustomBackgroundImage = useSetAtom(customBackgroundImageAtom);
	const [customBackgroundOpacity, setCustomBackgroundOpacity] = useAtom(
		customBackgroundOpacityAtom,
	);
	const [customBackgroundMask, setCustomBackgroundMask] = useAtom(
		customBackgroundMaskAtom,
	);
	const [customBackgroundBlur, setCustomBackgroundBlur] = useAtom(
		customBackgroundBlurAtom,
	);
	const [customBackgroundBrightness, setCustomBackgroundBrightness] = useAtom(
		customBackgroundBrightnessAtom,
	);
	const { t } = useTranslation();
	const backgroundFileInputRef = useRef<HTMLInputElement>(null);

	const onSelectBackgroundFile = useCallback(
		(file: File) => {
			setCustomBackgroundImage(file);
		},
		[setCustomBackgroundImage],
	);

	return (
		<Flex direction="column" gap="4">
			<Flex align="center" justify="between">
				<Heading size="4">
					{t("settings.common.customBackground", "Custom background")}
				</Heading>
				<IconButton variant="ghost" onClick={onClose}>
					<Dismiss24Regular />
				</IconButton>
			</Flex>

			<Card>
				<Flex direction="column" gap="3">
					<Text size="1" color="gray">
						{t(
							"settings.common.customBackgroundDesc",
							"Select an image to use as background.",
						)}
					</Text>
					<input
						ref={backgroundFileInputRef}
						type="file"
						accept="image/*"
						style={{ display: "none" }}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							onSelectBackgroundFile(file);
							event.target.value = "";
						}}
					/>
					<Flex gap="2" align="center">
						<Button
							variant="soft"
							onClick={() => backgroundFileInputRef.current?.click()}
						>
							{t("settings.common.customBackgroundPick", "Choose image")}
						</Button>
						<Button
							variant="ghost"
							disabled={!customBackgroundImage}
							onClick={() => setCustomBackgroundImage(null)}
						>
							{t("settings.common.customBackgroundClear", "Clear")}
						</Button>
					</Flex>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-11)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Eye24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundOpacity", "Opacity")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundOpacity * 100)}%
							</Text>
							{customBackgroundOpacity !== 0.8 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundOpacity(0.8)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundOpacity]}
						onValueChange={(v) => setCustomBackgroundOpacity(v[0])}
					/>
					{customBackgroundOpacity >= 0.9 && (
						<Text size="1" color="orange">
							{t(
								"settings.common.customBackgroundOpacityWarning",
								"If this value is too high, it might obscure page content.",
							)}
						</Text>
					)}
				</Flex>
			</Card>

			<Card style={{ marginBottom: "var(--space-1)" }}>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-11)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Layer24Regular />
							</Box>
							<Text>{t("settings.common.customBackgroundMask", "Mask")}</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundMask * 100)}%
							</Text>
							{customBackgroundMask !== 0.2 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundMask(0.2)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={1}
						step={0.01}
						value={[customBackgroundMask]}
						onValueChange={(v) => setCustomBackgroundMask(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-11)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<Blur24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundBlur", "Blur radius")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{customBackgroundBlur.toFixed(0)}px
							</Text>
							{customBackgroundBlur !== 0 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBlur(0)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0}
						max={30}
						step={1}
						value={[customBackgroundBlur]}
						onValueChange={(v) => setCustomBackgroundBlur(v[0])}
					/>
				</Flex>
			</Card>

			<Card>
				<Flex direction="column" gap="2">
					<Flex align="center" justify="between">
						<Flex align="center" gap="2">
							<Box
								style={{
									color: "var(--accent-11)",
									display: "flex",
									alignItems: "center",
								}}
							>
								<WeatherSunny24Regular />
							</Box>
							<Text>
								{t("settings.common.customBackgroundBrightness", "Brightness")}
							</Text>
						</Flex>
						<Flex align="center" gap="2">
							<Text wrap="nowrap" color="gray" size="1">
								{Math.round(customBackgroundBrightness * 100)}%
							</Text>
							{customBackgroundBrightness !== 1 && (
								<IconButton
									variant="ghost"
									size="1"
									onClick={() => setCustomBackgroundBrightness(1)}
								>
									<ArrowHookUpLeft24Regular />
								</IconButton>
							)}
						</Flex>
					</Flex>
					<Slider
						min={0.5}
						max={1.5}
						step={0.01}
						value={[customBackgroundBrightness]}
						onValueChange={(v) => setCustomBackgroundBrightness(v[0])}
					/>
				</Flex>
			</Card>
		</Flex>
	);
};
export const SettingsCustomBackgroundCard = ({
	onOpen,
}: {
	onOpen: () => void;
}) => {
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const { t } = useTranslation();

	return (
		<Card style={{ width: "100%", marginBottom: "var(--space-1)" }}>
			<Flex gap="3" align="center">
				<Image24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.customBackground", "Custom background")}
							</Text>
							<Text size="1" color="gray">
								{customBackgroundImage
									? t(
											"settings.common.customBackgroundEnabled",
											"Background applied",
										)
									: t(
											"settings.common.customBackgroundDesc",
											"Select an image to use as background.",
										)}
							</Text>
						</Flex>
						<Button variant="soft" onClick={onOpen}>
							{t("settings.common.customBackgroundManage", "Manage")}
						</Button>
					</Flex>
				</Box>
			</Flex>
		</Card>
	);
};
