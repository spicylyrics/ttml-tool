import { useAtomValue } from "jotai";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	spectrogramHiddenLanesAtom,
	spectrogramLaneLayoutAtom,
} from "$/modules/spectrogram/states/lanes.ts";
import {
	getLaneBands,
	LANE_LABELS,
} from "$/modules/spectrogram/utils/lanes.ts";
import styles from "./SpectrogramLanes.module.css";

/**
 * Lane names pinned to the left edge. Rendered outside the scrolling content,
 * so they stay put while the spectrogram scrolls, and never take the pointer.
 * Only shown when there is more than one lane to tell apart.
 */
function LaneLabels() {
	const { t } = useTranslation();
	const layout = useAtomValue(spectrogramLaneLayoutAtom);
	const hiddenLanes = useAtomValue(spectrogramHiddenLanesAtom);
	const bands = useMemo(
		() => (layout ? getLaneBands(layout, hiddenLanes) : []),
		[layout, hiddenLanes],
	);

	if (bands.length < 2) return null;

	return (
		<div className={styles.labels} aria-hidden="true">
			{bands.map((band) => (
				<span
					key={band.kind}
					className={styles.label}
					style={{ top: `${band.top}%` }}
				>
					{t(LANE_LABELS[band.kind].key, LANE_LABELS[band.kind].fallback)}
				</span>
			))}
		</div>
	);
}

export const SpectrogramLaneLabels = memo(LaneLabels);
