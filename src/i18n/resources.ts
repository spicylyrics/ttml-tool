import loaded from "virtual:i18next-loader";
import { type Catalog, withRegionalVariants } from "./regional";

// One JSON file per regional variant, named after its locale (es-MX.json).
const variants = Object.fromEntries(
	Object.entries(
		import.meta.glob<Catalog>("./regional/*.json", {
			eager: true,
			import: "default",
		}),
	).map(([path, overrides]) => [path.replace(/^.*\/|\.json$/g, ""), overrides]),
);

/** Full catalogs plus the regional variants built on top of them. */
const resources = withRegionalVariants(loaded, variants);

export default resources;
