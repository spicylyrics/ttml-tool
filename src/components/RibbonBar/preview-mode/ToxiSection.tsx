import { Grid } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { toxiTightLayoutAtom } from "$/components/AMLLWrapper/toxi-layout-states";
import { RibbonSection } from "../common";
import { RibbonToggle } from "../RibbonToggle";

/** Ribbon options for the Toxi preview. */
export const ToxiSection = () => {
	const { t } = useTranslation();
	return (
		<RibbonSection label={t("toxiLayout.section", "Toxi")}>
			<Grid
				columns="max-content auto"
				gap="2"
				gapY="1"
				flexGrow="1"
				align="center"
			>
				<RibbonToggle
					label={t("toxiLayout.tightLayout", "Tight layout")}
					description={t(
						"toxiLayout.tightLayoutDesc",
						"Use less empty space and make background lines easier to read.",
					)}
					setting={toxiTightLayoutAtom}
				/>
			</Grid>
		</RibbonSection>
	);
};
