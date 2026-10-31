import { Checkbox, Switch, TextField } from "@radix-ui/themes";
import { useAtom, type WritableAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	OptionPicker,
	type OptionPickerVariant,
} from "$/components/OptionPicker";
import { backgroundSyncLaneAtom } from "../states/background-sync";
import {
	PreviewModeType,
	previewModeTypeAtom,
	spicyBackgroundModeAtom,
} from "../states/preview";
import {
	syncCommitOffsetAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
} from "../states/sync";

// atomWithStorage setters also accept RESET/updater values; the controls only
// need the common boolean setter contract.
export function SettingToggle({
	setting,
	compact = false,
	id,
}: {
	setting: WritableAtom<boolean, [boolean], unknown>;
	compact?: boolean;
	id?: string;
}) {
	const [checked, setChecked] = useAtom(setting);
	const onCheckedChange = (value: boolean | "indeterminate") =>
		setChecked(value === true);
	return compact ? (
		<Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
	) : (
		<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
	);
}

export function parseSyncOffset(value: string): number {
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

export function SyncOffsetControl({
	commit = false,
	compact = false,
}: {
	commit?: boolean;
	compact?: boolean;
}) {
	const [value, setValue] = useAtom(
		commit ? syncCommitOffsetAtom : syncTimeOffsetAtom,
	);
	return (
		<TextField.Root
			type="number"
			step={1}
			size={compact ? "1" : "2"}
			style={compact ? { width: "8em" } : undefined}
			value={value}
			onChange={(event) => setValue(parseSyncOffset(event.target.value))}
		/>
	);
}

export function SyncLevelControl({
	variant,
}: {
	variant?: OptionPickerVariant;
} = {}) {
	const [value, setValue] = useAtom(syncLevelModeAtom);
	const { t } = useTranslation();
	return (
		<OptionPicker
			variant={variant}
			value={value}
			onValueChange={setValue}
			label={t("ribbonBar.syncMode.syncLevel", "Sync by")}
			options={[
				{ value: "word", label: t("ribbonBar.syncMode.syncLevelWord", "Word") },
				{ value: "line", label: t("ribbonBar.syncMode.syncLevelLine", "Line") },
			]}
		/>
	);
}

export function BackgroundSyncControl({
	variant,
}: {
	variant?: OptionPickerVariant;
} = {}) {
	const [value, setValue] = useAtom(backgroundSyncLaneAtom);
	const { t } = useTranslation();
	return (
		<OptionPicker
			variant={variant}
			value={value}
			onValueChange={setValue}
			label={t("ribbonBar.syncMode.bgLyricSync", "Background lines")}
			options={[
				{
					value: "all",
					label: t("ribbonBar.syncMode.bgSyncInline", "Sync with main"),
					description: t(
						"ribbonBar.syncMode.bgSyncInlineDesc",
						"Sync each background line right after its main line.",
					),
				},
				{
					value: "same",
					label: t("ribbonBar.syncMode.bgSyncSeparate", "Skip while syncing"),
					description: t(
						"ribbonBar.syncMode.bgSyncSeparateDesc",
						"G and H stay on main lines. Click a background line to sync them on their own.",
					),
				},
			]}
		/>
	);
}

export function PreviewModeControl({
	variant,
}: {
	variant?: OptionPickerVariant;
} = {}) {
	const [value, setValue] = useAtom(previewModeTypeAtom);
	const { t } = useTranslation();
	return (
		<OptionPicker
			variant={variant}
			size="2"
			value={value}
			onValueChange={setValue}
			label={t("ribbonBar.previewMode.mode", "Mode")}
			options={[
				{
					value: PreviewModeType.Standard,
					label: t("ribbonBar.previewMode.standard", "Standard"),
				},
				{ value: PreviewModeType.Toxi, label: "Toxi" },
				{
					value: PreviewModeType.Spicy,
					label: t("ribbonBar.previewMode.spicy", "Spicy Lyrics"),
				},
				{
					value: PreviewModeType.Timing,
					label: t("ribbonBar.previewMode.timing", "Timing"),
				},
			]}
		/>
	);
}

export function SpicyBackgroundControl({
	variant,
}: {
	variant?: OptionPickerVariant;
} = {}) {
	const [value, setValue] = useAtom(spicyBackgroundModeAtom);
	const { t } = useTranslation();
	return (
		<OptionPicker
			variant={variant}
			value={value}
			onValueChange={setValue}
			label={t("ribbonBar.previewMode.background", "Background")}
			options={[
				{
					value: "animated",
					label: t("ribbonBar.previewMode.backgroundAnimated", "Animated"),
				},
				{
					value: "color",
					label: t("ribbonBar.previewMode.backgroundColor", "Color"),
				},
				{
					value: "static",
					label: t("ribbonBar.previewMode.backgroundStatic", "Static"),
				},
			]}
		/>
	);
}
