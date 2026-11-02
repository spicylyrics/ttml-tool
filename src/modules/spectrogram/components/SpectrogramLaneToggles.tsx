import { LayerFilled, LayerRegular } from "@fluentui/react-icons";
import {
	Checkbox,
	Flex,
	IconButton,
	Popover,
	Switch,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import {
	spectrogramDuetLaneAtom,
	spectrogramHiddenLanesAtom,
	spectrogramLaneLayoutAtom,
	spectrogramLanesEnabledAtom,
} from "$/modules/spectrogram/states/lanes.ts";
import {
	LANE_LABELS,
	type SpectrogramLaneKind,
} from "$/modules/spectrogram/utils/lanes.ts";

/** Sidebar button: turns lanes on or off, and shows or hides each lane while they're on. */
function LaneToggles() {
	const { t } = useTranslation();
	const [lanesEnabled, setLanesEnabled] = useAtom(spectrogramLanesEnabledAtom);
	const layout = useAtomValue(spectrogramLaneLayoutAtom);
	const [hiddenLanes, setHiddenLanes] = useAtom(spectrogramHiddenLanesAtom);
	const [duetLane, setDuetLane] = useAtom(spectrogramDuetLaneAtom);

	const menuLabel = t("spectrogramLanes.menu", "Lanes");
	const setLaneVisible = (kind: SpectrogramLaneKind, visible: boolean) => {
		setHiddenLanes((previous) => {
			const next = new Set(previous);
			if (visible) next.delete(kind);
			else next.add(kind);
			return next;
		});
	};

	return (
		<Popover.Root>
			<Tooltip content={menuLabel} side="left">
				<Popover.Trigger>
					<IconButton variant="ghost" color="gray" aria-label={menuLabel}>
						{lanesEnabled ? <LayerFilled /> : <LayerRegular />}
					</IconButton>
				</Popover.Trigger>
			</Tooltip>
			<Popover.Content side="left" align="start" style={{ width: 220 }}>
				<Flex direction="column" gap="3">
					<Text as="label" size="2" weight="bold">
						<Flex gap="2" align="center" justify="between">
							{t("spectrogramLanes.settingTitle", "Separate lanes")}
							<Switch
								checked={lanesEnabled}
								onCheckedChange={(value) => setLanesEnabled(value)}
							/>
						</Flex>
					</Text>
					{layout && (
						<>
							<Text size="2" weight="bold">
								{t("spectrogramLanes.visibleLanes", "Show lanes")}
							</Text>
							<Flex direction="column" gap="2">
								{layout.lanes.map((kind) => (
									<Text as="label" size="2" key={kind}>
										<Flex gap="2" align="center">
											<Checkbox
												checked={!hiddenLanes.has(kind)}
												onCheckedChange={(value) =>
													setLaneVisible(kind, value === true)
												}
											/>
											{t(LANE_LABELS[kind].key, LANE_LABELS[kind].fallback)}
										</Flex>
									</Text>
								))}
							</Flex>
							<Text as="label" size="2">
								<Flex gap="2" align="center" justify="between">
									{t("spectrogramLanes.duetLane", "Separate duet lane")}
									<Switch
										checked={duetLane}
										onCheckedChange={(value) => setDuetLane(value)}
									/>
								</Flex>
							</Text>
						</>
					)}
				</Flex>
			</Popover.Content>
		</Popover.Root>
	);
}

export const SpectrogramLaneToggles = memo(LaneToggles);
