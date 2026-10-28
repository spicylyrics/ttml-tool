import {
	ArrowCounterclockwise16Regular,
	ArrowDown16Regular,
	ArrowUp16Regular,
	MoreHorizontal16Regular,
	Options16Regular,
	Pin16Filled,
	Pin16Regular,
} from "@fluentui/react-icons";
import { Button, Flex, IconButton, Popover, Text } from "@radix-ui/themes";
import {
	type FC,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { OptionPicker } from "$/components/OptionPicker";
import { SectionHeader } from "$/components/SectionHeader";
import { ToolbarGroup } from "$/components/ToolbarGroup";
import type { RibbonMode, SectionId } from "./catalog";
import styles from "./index.module.css";
import {
	canMove,
	effectiveOrder,
	isDefaultLayout,
	isPinned,
	type MoveDirection,
	moveSection,
	placementOf,
	type SectionPlacement,
	setPlacement,
	togglePin,
} from "./layout";
import { useRibbonLayout } from "./states";

/** The More menu: sections the user moved out of the ribbon. */
const MoreMenu: FC<{ children: ReactNode }> = ({ children }) => {
	const { t } = useTranslation();
	const label = t("ribbonCustomize.more", "More");
	return (
		<Popover.Root>
			<ActionTooltip
				label={label}
				description={t(
					"ribbonCustomize.moreDesc",
					"Sections you moved out of the ribbon.",
				)}
			>
				<Popover.Trigger>
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						radius="full"
						aria-label={label}
					>
						<MoreHorizontal16Regular />
					</IconButton>
				</Popover.Trigger>
			</ActionTooltip>
			<Popover.Content size="1" className={styles.morePopover}>
				<Flex
					role="group"
					aria-label={label}
					direction="row"
					wrap="wrap"
					gap="3"
					align="stretch"
				>
					{children}
				</Flex>
			</Popover.Content>
		</Popover.Root>
	);
};

const CustomizePanel: FC<{ mode: RibbonMode }> = ({ mode }) => {
	const { t } = useTranslation();
	const { catalog, layout, setLayout, resetLayout } = useRibbonLayout(mode);
	const listRef = useRef<HTMLOListElement>(null);
	const [focusAfterMove, setFocusAfterMove] = useState<{
		id: string;
		direction: MoveDirection;
	} | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const order = effectiveOrder(layout);

	// Moving a row can move its button in the DOM, which drops focus. Put it
	// back on the same button, or on the other one when the row hit an end.
	useLayoutEffect(() => {
		if (!focusAfterMove || !listRef.current) return;
		const { id, direction } = focusAfterMove;
		const find = (dir: MoveDirection) =>
			Array.from(
				listRef.current?.querySelectorAll<HTMLButtonElement>(
					"button[data-move]",
				) ?? [],
			).find(
				(button) =>
					button.dataset.move === dir && button.dataset.section === id,
			);
		const same = find(direction);
		const target =
			same && !same.disabled ? same : find(direction === "up" ? "down" : "up");
		target?.focus();
		setFocusAfterMove(null);
	}, [focusAfterMove]);

	const placementOptions = [
		{
			value: "ribbon",
			label: t("ribbonCustomize.placement.ribbon", "Ribbon"),
			description: t(
				"ribbonCustomize.placement.ribbonDesc",
				"Show it on the ribbon.",
			),
		},
		{
			value: "more",
			label: t("ribbonCustomize.placement.more", "More"),
			description: t(
				"ribbonCustomize.placement.moreDesc",
				"Keep it in the More menu at the end of the ribbon.",
			),
		},
		{
			value: "hidden",
			label: t("ribbonCustomize.placement.hidden", "Hidden"),
			description: t(
				"ribbonCustomize.placement.hiddenDesc",
				"Don't show it anywhere.",
			),
		},
	] as const;

	const move = (id: string, name: string, direction: MoveDirection) => {
		const next = moveSection(layout, id, direction);
		setLayout(() => next);
		setFocusAfterMove({ id, direction });
		setAnnouncement(
			t("ribbonCustomize.moved", "{{name}} is now at position {{position}}", {
				name,
				position: effectiveOrder(next).indexOf(id) + 1,
			}),
		);
	};

	return (
		<Flex direction="column" gap="3">
			<SectionHeader
				size="3"
				title={t("ribbonCustomize.title", "Customize this ribbon")}
				description={t(
					"ribbonCustomize.hint",
					"Some sections only show up with a selection or with Advanced on.",
				)}
				actions={
					<Button
						size="1"
						variant="soft"
						color="gray"
						disabled={isDefaultLayout(layout, catalog)}
						onClick={() => {
							resetLayout();
							setAnnouncement(
								t("ribbonCustomize.resetDone", "Ribbon reset to default"),
							);
						}}
					>
						<ArrowCounterclockwise16Regular />
						{t("ribbonCustomize.reset", "Reset")}
					</Button>
				}
			/>
			<ol ref={listRef} className={styles.list}>
				{order.map((id) => {
					// Layouts only hold catalog ids (see normalizeLayout).
					const name = t(id as SectionId);
					const pinned = isPinned(layout, id);
					const placement = placementOf(layout, id);
					const pinLabel = pinned
						? t("ribbonCustomize.unpin", "Unpin {{name}}", { name })
						: t("ribbonCustomize.pin", "Pin {{name}} to the front", { name });
					return (
						<li
							key={id}
							className={styles.row}
							data-placement={placement}
							data-pinned={pinned || undefined}
						>
							<span className={styles.name}>
								<Text size="2" truncate>
									{name}
								</Text>
								{pinned && (
									<Text size="1" color="gray" className={styles.status}>
										<Pin16Filled aria-hidden="true" />
										{t("ribbonCustomize.pinned", "Pinned")}
									</Text>
								)}
							</span>
							<ToolbarGroup label={name} className={styles.controls}>
								<ActionTooltip label={pinLabel}>
									<IconButton
										size="1"
										variant={pinned ? "soft" : "ghost"}
										color="gray"
										radius="full"
										aria-label={pinLabel}
										aria-pressed={pinned}
										onClick={() => setLayout((prev) => togglePin(prev, id))}
									>
										{pinned ? <Pin16Filled /> : <Pin16Regular />}
									</IconButton>
								</ActionTooltip>
								<OptionPicker<SectionPlacement>
									value={placement}
									options={placementOptions}
									label={t(
										"ribbonCustomize.placement.label",
										"Show {{name}} in",
										{
											name,
										},
									)}
									onValueChange={(value) =>
										setLayout((prev) => setPlacement(prev, id, value))
									}
								/>
								{(["up", "down"] as const).map((direction) => {
									const moveLabel =
										direction === "up"
											? t("ribbonCustomize.moveUp", "Move {{name}} up", {
													name,
												})
											: t("ribbonCustomize.moveDown", "Move {{name}} down", {
													name,
												});
									return (
										<IconButton
											key={direction}
											size="1"
											variant="ghost"
											color="gray"
											radius="full"
											aria-label={moveLabel}
											title={moveLabel}
											data-move={direction}
											data-section={id}
											disabled={!canMove(layout, id, direction)}
											onClick={() => move(id, name, direction)}
										>
											{direction === "up" ? (
												<ArrowUp16Regular />
											) : (
												<ArrowDown16Regular />
											)}
										</IconButton>
									);
								})}
							</ToolbarGroup>
						</li>
					);
				})}
			</ol>
			<span aria-live="polite" className={styles.srOnly}>
				{announcement}
			</span>
		</Flex>
	);
};

/**
 * The end of a customizable ribbon: the More menu (only while it has
 * something to show) and the Customize button.
 */
export const RibbonCustomizeControls: FC<{
	mode: RibbonMode;
	overflow: ReactNode[];
}> = ({ mode, overflow }) => {
	const { t } = useTranslation();
	const label = t("ribbonCustomize.customize", "Customize ribbon");
	return (
		<Flex
			direction="column"
			align="center"
			justify="center"
			gap="2"
			flexShrink="0"
			className={styles.controlsColumn}
		>
			{overflow.length > 0 && <MoreMenu>{overflow}</MoreMenu>}
			<Popover.Root>
				<ActionTooltip
					label={label}
					description={t(
						"ribbonCustomize.customizeDesc",
						"Hide, reorder or pin this ribbon's sections, or move them into More.",
					)}
				>
					<Popover.Trigger>
						<IconButton
							size="1"
							variant="ghost"
							color="gray"
							radius="full"
							aria-label={label}
						>
							<Options16Regular />
						</IconButton>
					</Popover.Trigger>
				</ActionTooltip>
				<Popover.Content size="2" className={styles.customizePopover}>
					<CustomizePanel mode={mode} />
				</Popover.Content>
			</Popover.Root>
		</Flex>
	);
};
