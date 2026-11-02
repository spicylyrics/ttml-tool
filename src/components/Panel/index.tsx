import { Card } from "@radix-ui/themes";
import classNames from "classnames";
import type {
	ButtonHTMLAttributes,
	CSSProperties,
	FC,
	HTMLAttributes,
	ReactNode,
} from "react";
import styles from "./index.module.css";

/**
 * - `card`: the default raised surface (lists of items, cards in dialogs).
 * - `sunken`: a well inside a card, for quoted or secondary content.
 */
export type PanelTone = "card" | "sunken";

interface PanelBaseProps {
	tone?: PanelTone;
	/** Radix Card size: padding and radius step together. */
	size?: "1" | "2" | "3";
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
}

/**
 * A solid card built on Radix Card. Radix paints Cards with the translucent
 * panel color and a blur, so a plain Card is glass whenever the theme is
 * translucent. Panel stays solid, and only turns translucent (no blur) when the
 * user has picked a custom background under the Spicy Lyrics design.
 */
export const Panel: FC<PanelBaseProps & HTMLAttributes<HTMLDivElement>> = ({
	tone = "card",
	size = "1",
	className,
	children,
	...rest
}) => (
	<Card
		variant="surface"
		size={size}
		data-panel-tone={tone}
		className={classNames(
			styles.panel,
			tone === "sunken" && styles.sunken,
			className,
		)}
		{...rest}
	>
		{children}
	</Card>
);

/**
 * A Panel that is one button: a pickable card such as a font in a list.
 * Selection is a ring plus a tint, never a border-width change, so picking a
 * card doesn't move its neighbours. Pair `selected` with a visible mark (an
 * icon or text); the ring alone is color only.
 */
export const SelectablePanel: FC<
	PanelBaseProps & {
		selected?: boolean;
	} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">
> = ({
	tone = "card",
	size = "1",
	selected = false,
	className,
	children,
	...rest
}) => (
	<Card
		asChild
		variant="surface"
		size={size}
		data-panel-tone={tone}
		data-selected={selected || undefined}
		className={classNames(
			styles.panel,
			styles.interactive,
			tone === "sunken" && styles.sunken,
			selected && styles.selected,
			className,
		)}
	>
		<button type="button" aria-pressed={selected} {...rest}>
			{children}
		</button>
	</Card>
);
