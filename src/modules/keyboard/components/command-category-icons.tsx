import {
	Edit20Regular,
	Eye20Regular,
	Folder20Regular,
	Play20Regular,
	Pulse20Regular,
	QuestionCircle20Regular,
	Speaker220Regular,
	Timer20Regular,
	Wrench20Regular,
} from "@fluentui/react-icons";
import type { ReactNode } from "react";

/**
 * One icon per shortcut group, shared by the Shortcuts list headings and the
 * command palette rows.
 */
export const COMMAND_CATEGORY_ICONS: Record<string, ReactNode> = {
	File: <Folder20Regular />,
	Edit: <Edit20Regular />,
	Sync: <Timer20Regular />,
	Audio: <Speaker220Regular />,
	View: <Eye20Regular />,
	Spectrogram: <Pulse20Regular />,
	Preview: <Play20Regular />,
	Tools: <Wrench20Regular />,
	Help: <QuestionCircle20Regular />,
};
