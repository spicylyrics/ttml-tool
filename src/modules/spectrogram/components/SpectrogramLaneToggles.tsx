import { LayerRegular } from "@fluentui/react-icons";
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
} from "$/modules/spectrogram/states/lanes.ts";
import {
	LANE_LABELS,
	type SpectrogramLaneKind,
} from "$/modules/spectrogram/utils/lanes.ts";

/** Sidebar button for showing or hiding lanes. Renders nothing while lanes are off. */
function LaneToggles() {
	const { t } = useTranslation();
	const layout = useAtomValue(spectrogramLaneLayoutAtom);
	const [hiddenLanes, setHiddenLanes] = useAtom(spectrogramHiddenLanesAtom);
	const [duetLane, setDuetLane] = useAtom(spectrogramDuetLaneAtom);

	if (!layout) return null;

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
						<LayerRegular />
					</IconButton>
				</Popover.Trigger>
			</Tooltip>
			<Popover.Content side="left" align="start" style={{ width: 220 }}>
				<Flex direction="column" gap="3">
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
				</Flex>
			</Popover.Content>
		</Popover.Root>
	);
}

export const SpectrogramLaneToggles = memo(LaneToggles);
