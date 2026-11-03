import { BeakerRegular } from "@fluentui/react-icons";
import { Card, Switch } from "@radix-ui/themes";
import { FieldRow } from "$/components/FieldRow";
import type { AboutSettings } from "./useAboutSettings";

/** Preferences › About › Beta updates. Desktop only; the website has no updater. */
export const UpdateChannelSection = ({
	t,
	isWebsite,
	betaUpdates,
	setBetaUpdates,
}: Pick<AboutSettings, "t" | "isWebsite" | "betaUpdates" | "setBetaUpdates">) =>
	!isWebsite && (
		<Card>
			<FieldRow
				icon={<BeakerRegular />}
				label={t("settings.about.betaUpdates", "Beta updates")}
				description={t(
					"settings.about.betaUpdatesDescription",
					"Get new versions a few days early to try them out and report problems. Turning this off keeps your version until the next stable one is newer.",
				)}
			>
				{({ controlId, descriptionId }) => (
					<Switch
						id={controlId}
						aria-describedby={descriptionId}
						checked={betaUpdates}
						onCheckedChange={setBetaUpdates}
					/>
				)}
			</FieldRow>
		</Card>
	);
