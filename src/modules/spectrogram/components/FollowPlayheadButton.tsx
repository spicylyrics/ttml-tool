import {
	ArrowStepInRightFilled,
	ArrowStepInRightRegular,
} from "@fluentui/react-icons";
import { IconButton, Tooltip } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { cmdToggleSpectrogramFollow } from "$/modules/keyboard/commands";
import { useCommand } from "$/modules/keyboard/hooks";
import { spectrogramFollowOnAtom } from "../states/follow-playhead";

/** Toolbar toggle (and shortcut) for following the playhead. */
export function FollowPlayheadButton() {
	const { t } = useTranslation();
	const [followOn, setFollowOn] = useAtom(spectrogramFollowOnAtom);
	const toggle = () => setFollowOn((prev) => !prev);

	useCommand(cmdToggleSpectrogramFollow, toggle);

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
