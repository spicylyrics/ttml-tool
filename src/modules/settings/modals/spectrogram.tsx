import { Add20Regular, Delete20Regular } from "@fluentui/react-icons";
import { Button, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FollowPlayheadSettings } from "$/modules/spectrogram/components/FollowPlayheadSettings";
import {
	customPaletteStopsAtom,
	predefinedPalettes,
	selectedPaletteIdAtom,
} from "$/modules/spectrogram/states";
import { spectrogramLanesEnabledAtom } from "$/modules/spectrogram/states/lanes.ts";
import { SettingToggle } from "../components/WorkflowControls";

export const SettingsSpectrogramTab = () => {
	const { t } = useTranslation();
	const [selectedPaletteId, setSelectedPaletteId] = useAtom(
		selectedPaletteIdAtom,
	);
	const [globalStops, setGlobalStops] = useAtom(customPaletteStopsAtom);
	const [localStops, setLocalStops] = useState(globalStops);

	useEffect(() => {
		setLocalStops(globalStops);
	}, [globalStops]);

	const gradientCss = useMemo(() => {
		const stopsString = localStops
			.map((stop) => `${stop.color} ${stop.pos * 100}%`)
			.join(", ");
		return `linear-gradient(to right, ${stopsString})`;
	}, [localStops]);

	const handleStopColorChange = (index: number, color: string) => {
		setLocalStops(
			localStops.map((stop, i) => (i === index ? { ...stop, color } : stop)),
		);
	};

	const handleStopPosChange = (index: number, pos: number) => {
		const newPos = Number.isNaN(pos) ? 0 : Math.max(0, Math.min(1, pos));

		setLocalStops(
			localStops.map((stop, i) =>
				i === index ? { ...stop, pos: newPos } : stop,
			),
		);
	};

	const commitLocalChanges = () => {
		const sortedStops = [...localStops].sort((a, b) => a.pos - b.pos);
		setGlobalStops(sortedStops);
		setLocalStops(sortedStops);
	};

	const handleRemoveStop = (index: number) => {
		setGlobalStops(globalStops.filter((_, i) => i !== index));
	};

	const handleAddStop = () => {
		setGlobalStops(
			[
				...globalStops,
				{
					id: crypto.randomUUID(),
					pos: 1.0,
					color: "#ffffff",
				},
			].sort((a, b) => a.pos - b.pos),
		);
	};

	return (
		<Flex direction="column" gap="4">
			<FollowPlayheadSettings />
			<Text as="label">
				<Flex gap="3" align="center" justify="between">
					<Flex direction="column" gap="1">
						<Text>{t("spectrogramLanes.settingTitle", "Separate lanes")}</Text>
						<Text size="1" color="gray">
							{t(
								"spectrogramLanes.settingDesc",
								"Draw background lines in their own row under the main lines. Lanes are view-only: change a line's role in Edit mode.",
							)}
						</Text>
					</Flex>
					<SettingToggle setting={spectrogramLanesEnabledAtom} />
				</Flex>
			</Text>
			<Text as="label">
				<Flex direction="column" gap="2" align="start">
					<Text>{t("settings.spectrogram.palette", "Color palette")}</Text>
					<Select.Root
						value={selectedPaletteId}
						onValueChange={(v) => setSelectedPaletteId(v)}
					>
						<Select.Trigger />
						<Select.Content>
							{predefinedPalettes.map((palette) => (
								<Select.Item key={palette.id} value={palette.id}>
									{palette.name}
								</Select.Item>
							))}
							<Select.Separator />
							<Select.Item value="custom">
								{t("settings.spectrogram.paletteCustom", "Custom")}
							</Select.Item>
						</Select.Content>
					</Select.Root>
				</Flex>
			</Text>

			{selectedPaletteId === "custom" && (
				<Flex
					asChild
					p="2"
					style={{
						border: "1px solid var(--gray-a5)",
						borderRadius: "var(--radius-3)",
					}}
				>
					<section>
						<Flex direction="column" gap="3" width="100%">
							<Text size="1" color="gray">
								{t(
									"settings.spectrogram.gradientEditorDesc",
									"A position of 0.0 is the quietest part and 1.0 the loudest. Brighter colors at higher positions usually read best.",
								)}
							</Text>

							<div
								style={{
									width: "100%",
									height: "24px",
									backgroundImage: gradientCss,
									border: "1px solid var(--gray-a6)",
									borderRadius: "var(--radius-2)",
								}}
							/>

							{localStops.map((stop, index) => (
								<Flex key={stop.id} align="center" gap="2">
									<input
										type="color"
										value={stop.color}
										onChange={(e) =>
											handleStopColorChange(index, e.target.value)
										}
										onBlur={commitLocalChanges}
										style={{
											border: "none",
											padding: 0,
											background: "none",
											width: "28px",
											height: "28px",
										}}
									/>
									<TextField.Root
										type="number"
										min={0}
										max={1}
										step={0.01}
										value={stop.pos}
										onChange={(e) =>
											handleStopPosChange(
												index,
												e.target.value === ""
													? NaN
													: Number.parseFloat(e.target.value),
											)
										}
										onBlur={commitLocalChanges}
										style={{ maxWidth: "80px" }}
									/>
									<Text size="1">Pos: {stop.pos.toFixed(2)}</Text>
									<Button
										variant="soft"
										color="red"
										disabled={localStops.length <= 1}
										onClick={() => handleRemoveStop(index)}
										style={{ marginLeft: "auto" }}
									>
										<Delete20Regular />
										{t("common.remove", "Remove")}
									</Button>
								</Flex>
							))}
							<Button variant="outline" onClick={handleAddStop}>
								<Add20Regular />
								{t("settings.spectrogram.addStop", "Add color stop")}
							</Button>
						</Flex>
					</section>
				</Flex>
			)}
		</Flex>
	);
};
