import {
	ArrowStepInRightFilled,
	ArrowStepInRightRegular,
} from "@fluentui/react-icons";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { cmdToggleSpectrogramFollow } from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
import {
	spectrogramFollowFeatureAtom,
	spectrogramFollowOnAtom,
} from "../states/follow-playhead";

/** Toolbar toggle (and shortcut) for following the playhead. Hidden while the feature is off. */
export function FollowPlayheadButton() {
	const { t } = useTranslation();
	const featureEnabled = useAtomValue(spectrogramFollowFeatureAtom);
	const [followOn, setFollowOn] = useAtom(spectrogramFollowOnAtom);
	const toggle = () => setFollowOn((prev) => !prev);

	useCommand(cmdToggleSpectrogramFollow, toggle, [], featureEnabled);

	if (!featureEnabled) return null;

	const label = t("spectrogramFollow.toggle", "Follow playhead");
	return (
		<Tooltip content={label} side="left">
			<IconButton
				variant={followOn ? "solid" : "outline"}
				onClick={toggle}
				aria-label={label}
				aria-pressed={followOn}
			>
				{followOn ? <ArrowStepInRightFilled /> : <ArrowStepInRightRegular />}
			</IconButton>
		</Tooltip>
	);
}
