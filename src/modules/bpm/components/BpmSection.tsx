import { Text, Tooltip } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RibbonSection } from "$/components/RibbonBar/common";
import { audioBufferAtom } from "$/modules/audio/states";
import { analyzeBpm, displayBpm } from "../analyze";
import { bpmDisplayEnabledAtom } from "../states";

/** Time ribbon section with the estimated tempo of the loaded audio. */
export const BpmSection: FC = () => {
	const enabled = useAtomValue(bpmDisplayEnabledAtom);
	const buffer = useAtomValue(audioBufferAtom);
	const { t } = useTranslation();
	const [bpm, setBpm] = useState<number | null>(null);

	useEffect(() => {
		setBpm(null);
		if (!enabled || !buffer) return;
		let cancelled = false;
		analyzeBpm(buffer).then((estimate) => {
			if (!cancelled) setBpm(displayBpm(estimate));
		});
		return () => {
			cancelled = true;
		};
	}, [enabled, buffer]);

	if (!enabled || bpm === null) return null;

	return (
		<RibbonSection label={t("bpm.label", "Tempo")}>
			<Tooltip
				content={t(
					"bpm.tooltip",
					"Estimated from the loaded audio. It can be off by double or half on some songs.",
				)}
			>
				<Text size="2" wrap="nowrap" tabIndex={0} mx="2">
					{t("bpm.readout", "≈ {{bpm}} BPM", { bpm })}
				</Text>
			</Tooltip>
		</RibbonSection>
	);
};
