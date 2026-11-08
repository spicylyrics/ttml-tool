import { Text } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import type { FC } from "react";
import { audioBufferAtom } from "$/modules/audio/states";
import { spectrogramFrequencyScaleAtom } from "../states";
import {
	frequencyRulerLabels,
	ratioAtFrequency,
} from "../utils/frequency-scale";

export const FrequencyRuler: FC = () => {
	const audioBuffer = useAtomValue(audioBufferAtom);
	const scale = useAtomValue(spectrogramFrequencyScaleAtom);

	if (!audioBuffer) return null;

	const nyquist = audioBuffer.sampleRate / 2;
	const uniqueLabels = frequencyRulerLabels(scale, nyquist);

	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				bottom: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				padding: "4px 0",
			}}
		>
			{uniqueLabels.map((freq) => {
				const yPercent = (1 - ratioAtFrequency(scale, freq, nyquist)) * 100;
				return (
					<div
						key={freq}
						style={{
							position: "absolute",
							top: `${yPercent}%`,
							width: "100%",
							borderTop: "1px solid var(--gray-5)",
							paddingLeft: "4px",
						}}
					>
						<Text
							size="1"
							color="gray"
							style={{
								fontSize: "9px",
								lineHeight: "1",
								transform: "translateY(-50%)",
								backgroundColor: "var(--gray-2)",
								paddingRight: "2px",
							}}
						>
							{freq >= 1000 ? `${freq / 1000}k` : freq}
						</Text>
					</div>
				);
			})}
		</div>
	);
};
