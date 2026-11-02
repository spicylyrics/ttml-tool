import {
	ArrowMove20Regular,
	Edit16Regular,
	Play16Regular,
	Timer16Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";
import type { ViewCategory } from "./key-index";

/** Shown with every category color, so a category is never color alone. */
export const CATEGORY_ICONS: Record<ViewCategory, ReactNode> = {
	sync: <Timer16Regular />,
	edit: <Edit16Regular />,
	playback: <Play16Regular />,
	navigation: <ArrowMove20Regular />,
};
