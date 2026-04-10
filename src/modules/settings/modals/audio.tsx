import { ArchiveRegular, DeleteRegular, SaveRegular } from "@fluentui/react-icons";
import { Box, Button, Flex, Grid, IconButton, Select, Slider, Switch, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioEngine } from "$/modules/audio/audio-engine";
import {
	customEqualizerPresetsAtom,
	EQ_FREQUENCIES,
	EQ_PRESETS,
	equalizerEnabledAtom,
	equalizerGainsAtom,
	equalizerPresetAtom,
} from "$/modules/audio/states/index.ts";

export const AudioSettingsTab = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(equalizerEnabledAtom);
	const [gains, setGains] = useAtom(equalizerGainsAtom);
	const [preset, setPreset] = useAtom(equalizerPresetAtom);
	const [customPresets, setCustomPresets] = useAtom(customEqualizerPresetsAtom);
	const [newPresetName, setNewPresetName] = useState("");

	const allPresets = useMemo(() => ({
		...EQ_PRESETS,
		...customPresets,
	}), [customPresets]);

	const handleToggle = useCallback((val: boolean) => {
		setEnabled(val);
		setTimeout(() => audioEngine.updateEqGains(), 0);
	}, [setEnabled]);

	const handleGainChange = useCallback((index: number, val: number) => {
		const newGains = [...gains];
		newGains[index] = val;
		setGains(newGains);
		setPreset("Custom");
		audioEngine.updateEqGains();
	}, [gains, setGains, setPreset]);

	const handlePresetChange = useCallback((val: string) => {
		setPreset(val);
		if (allPresets[val]) {
			setGains(allPresets[val]);
			setTimeout(() => audioEngine.updateEqGains(), 0);
		}
	}, [setPreset, setGains, allPresets]);

	const handleSavePreset = useCallback(() => {
		if (!newPresetName.trim()) return;
		setCustomPresets((prev) => ({
			...prev,
			[newPresetName]: [...gains],
		}));
		setPreset(newPresetName);
		setNewPresetName("");
	}, [newPresetName, gains, setCustomPresets, setPreset]);

	const handleDeletePreset = useCallback((name: string) => {
		setCustomPresets((prev) => {
			const next = { ...prev };
			delete next[name];
			return next;
		});
		if (preset === name) {
			handlePresetChange("Flat");
		}
	}, [preset, setCustomPresets, handlePresetChange]);

	return (
		<Flex direction="column" gap="4">
			<Box>
				<Flex align="center" gap="4" mb="2">
					<Text weight="bold" size="3">{t("settings.audio.equalizer", "Audio Equalizer")}</Text>
					<Flex align="center" gap="2">
						<Switch checked={enabled} onCheckedChange={handleToggle} />
						<Text size="2" color="gray">{enabled ? t("settings.common.enabled", "Enabled") : t("settings.common.disabled", "Disabled")}</Text>
					</Flex>
				</Flex>
				<Text size="2" color="gray" mb="4">
					{t("settings.audio.eqDescription", "Adjust gains for different frequencies to optimize your audio experience.")}
				</Text>
			</Box>

			<Flex direction="column" gap="3" style={{ opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? "auto" : "none" }}>
				<Flex align="center" gap="3" mb="2">
					<Text size="2" weight="bold">{t("settings.audio.preset", "Presets")}</Text>
					<Select.Root value={preset} onValueChange={handlePresetChange}>
						<Select.Trigger />
						<Select.Content>
							<Select.Group>
								<Select.Label>{t("settings.audio.standardPresets", "Standard")}</Select.Label>
								<Select.Item value="Custom">{t("settings.audio.presets.custom", "Manual")}</Select.Item>
								{Object.keys(EQ_PRESETS).map((p) => (
									<Select.Item key={p} value={p}>{p}</Select.Item>
								))}
							</Select.Group>
							{Object.keys(customPresets).length > 0 && (
								<Select.Group>
									<Select.Label>{t("settings.audio.customPresets", "Custom")}</Select.Label>
									{Object.keys(customPresets).map((p) => (
										<Select.Item key={p} value={p}>
											<Flex align="center" justify="space-between" width="100%">
												{p}
											</Flex>
										</Select.Item>
									))}
								</Select.Group>
							)}
						</Select.Content>
					</Select.Root>

					{customPresets[preset] && (
						<IconButton variant="ghost" color="red" size="1" onClick={() => handleDeletePreset(preset)}>
							<DeleteRegular />
						</IconButton>
					)}

					<Button variant="soft" size="1" onClick={() => handlePresetChange("Flat")}>
						{t("settings.audio.reset", "Reset")}
					</Button>
				</Flex>

				<Flex align="center" gap="2" mb="2">
					<TextField.Root 
						placeholder={t("settings.audio.newPresetName", "New Preset Name")}
						value={newPresetName}
						onChange={(e) => setNewPresetName(e.target.value)}
						size="1"
						style={{ flexGrow: 1 }}
					>
						<TextField.Slot>
							<ArchiveRegular />
						</TextField.Slot>
					</TextField.Root>
					<Button size="1" onClick={handleSavePreset} disabled={!newPresetName.trim()}>
						<SaveRegular fontSize="14" />
						{t("settings.audio.save", "Save Preset")}
					</Button>
				</Flex>

				<Grid columns="10" gap="2" style={{ height: "200px", alignItems: "end" }}>
					{EQ_FREQUENCIES.map((freq, i) => (
						<Flex key={freq} direction="column" align="center" gap="2" height="100%">
							<Flex direction="column" justify="end" height="160px" width="100%" align="center">
								<Slider
									orientation="vertical"
									value={[gains[i]]}
									min={-12}
									max={12}
									step={1}
									onValueChange={([val]) => handleGainChange(i, val)}
								/>
							</Flex>
							<Text size="1" style={{ fontSize: "9px", textAlign: "center", width: "100%" }}>
								{freq >= 1000 ? `${freq / 1000}k` : freq}
							</Text>
							<Text size="1" color="gray" style={{ fontSize: "9px" }}>
								{gains[i] > 0 ? `+${gains[i]}` : gains[i]}dB
							</Text>
						</Flex>
					))}
				</Grid>
			</Flex>
		</Flex>
	);
};
