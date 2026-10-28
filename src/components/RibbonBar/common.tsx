/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import { Flex, Grid, Separator } from "@radix-ui/themes";
import { motion } from "framer-motion";
import { useAtomValue } from "jotai";
import {
	type FC,
	Fragment,
	forwardRef,
	isValidElement,
	type PropsWithChildren,
	type ReactNode,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
} from "react";
import { useTranslation } from "react-i18next";
import type { RibbonMode } from "./customize/catalog";
import { arrangeRibbon, type RibbonEntry } from "./customize/layout";
import { RibbonCustomizeControls } from "./customize/RibbonCustomizeControls";
import {
	ribbonCustomizeEnabledAtom,
	useRibbonLayout,
	useRibbonMode,
} from "./customize/states";

export const RibbonSection: FC<PropsWithChildren<{ label: ReactNode }>> = ({
	children,
	label,
}) => (
	<>
		<Flex
			direction="column"
			gap="1"
			flexShrink="0"
			style={{
				alignSelf: "stretch",
				width: "unset",
			}}
		>
			<Flex
				flexGrow="1"
				align="center"
				justify="center"
				direction="row"
				gap="2"
				p="0"
			>
				{children}
			</Flex>
			<Flex
				align="center"
				justify="center"
				px="2"
				style={{
					color: "var(--ribbon-label-color)",
					fontSize: "var(--font-size-1)",
					whiteSpace: "nowrap",
				}}
			>
				{label}
			</Flex>
		</Flex>
		<Separator
			orientation="vertical"
			size="4"
			style={{
				height: "unset",
				width: "1px",
				alignSelf: "stretch",
			}}
		/>
	</>
);

const RibbonHeightReserve: FC<{ rows: number }> = ({ rows }) => (
	<Flex
		aria-hidden="true"
		direction="column"
		gap="1"
		flexShrink="0"
		style={{
			width: 0,
			minWidth: 0,
			overflow: "hidden",
			visibility: "hidden",
			pointerEvents: "none",
			marginInlineEnd: "calc(-1 * var(--space-3))",
		}}
	>
		<Grid rows={`repeat(${rows}, var(--space-5))`} gapY="1" />
		<Flex
			align="center"
			justify="center"
			px="2"
			style={{ fontSize: "var(--font-size-1)", whiteSpace: "nowrap" }}
		>
			Reserve
		</Flex>
	</Flex>
);

/**
 * Works out which catalog section a child is: a `key` that is a catalog id
 * (for components that wrap a section), or a RibbonSection whose label is the
 * translation of a catalog id. Section files don't need to change.
 */
function sectionIdOf(
	child: ReactNode,
	catalog: ReadonlySet<string>,
	labelToId: ReadonlyMap<string, string>,
): string | null {
	if (!isValidElement(child)) return null;
	if (typeof child.key === "string" && catalog.has(child.key)) return child.key;
	const label = (child.props as { label?: unknown }).label;
	if (child.type === RibbonSection && typeof label === "string") {
		return labelToId.get(label) ?? null;
	}
	return null;
}

/**
 * The children of a ribbon with the user's layout applied. This reorders the
 * real elements (not CSS `order`), so Tab follows what the user sees.
 */
const CustomizedRibbonChildren: FC<{
	mode: RibbonMode;
	children: ReactNode;
}> = ({ mode, children }) => {
	const { t, i18n } = useTranslation();
	const { catalog, layout } = useRibbonLayout(mode);
	const language = i18n.language;
	const labelToId = useMemo(
		() =>
			new Map<string, string>(
				catalog.map((id) => [t(id, { lng: language }), id]),
			),
		[catalog, t, language],
	);
	const catalogSet = useMemo(() => new Set(catalog), [catalog]);

	// Positions in the children array stay put while conditional sections come
	// and go, so they make stable keys for anything that isn't a section.
	const list: ReactNode[] = Array.isArray(children) ? children : [children];
	const entries: RibbonEntry[] = [];
	list.forEach((child, index) => {
		if (child === null || child === undefined || typeof child === "boolean") {
			return;
		}
		entries.push({ index, id: sectionIdOf(child, catalogSet, labelToId) });
	});
	const ids = new Map(entries.map((entry) => [entry.index, entry.id]));
	const { inline, overflow } = arrangeRibbon(entries, layout);
	const render = (index: number) => (
		<Fragment key={ids.get(index) ?? `child-${index}`}>{list[index]}</Fragment>
	);

	return (
		<>
			{inline.map(render)}
			<RibbonCustomizeControls mode={mode} overflow={overflow.map(render)} />
		</>
	);
};

export const RibbonFrame = forwardRef<
	HTMLDivElement,
	PropsWithChildren<{ reserveControlRows?: number }>
>(({ children, reserveControlRows }, ref) => {
	const frameRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(ref, () => frameRef.current as HTMLDivElement, []);
	const mode = useRibbonMode();
	const customizeEnabled = useAtomValue(ribbonCustomizeEnabledAtom);

	useEffect(() => {
		const frame = frameRef.current;
		if (!frame) return;

		let scrollTarget = frame.scrollLeft;
		let isAnimating = false;

		const handleWheel = (e: WheelEvent) => {
			if (e.deltaY !== 0) {
				const isScrollable = frame.scrollWidth > frame.clientWidth;
				if (isScrollable) {
					e.preventDefault();
					scrollTarget += e.deltaY;
					scrollTarget = Math.max(
						0,
						Math.min(scrollTarget, frame.scrollWidth - frame.clientWidth),
					);

					if (!isAnimating) {
						isAnimating = true;
						const animate = () => {
							const diff = scrollTarget - frame.scrollLeft;
							if (Math.abs(diff) > 0.5) {
								frame.scrollLeft += diff * 0.15;
								requestAnimationFrame(animate);
							} else {
								frame.scrollLeft = scrollTarget;
								isAnimating = false;
							}
						};
						requestAnimationFrame(animate);
					}
				}
			}
		};

		const handleScroll = () => {
			if (!isAnimating) {
				scrollTarget = frame.scrollLeft;
			}
		};

		frame.addEventListener("wheel", handleWheel, { passive: false });
		frame.addEventListener("scroll", handleScroll);
		return () => {
			frame.removeEventListener("wheel", handleWheel);
			frame.removeEventListener("scroll", handleScroll);
		};
	}, []);

	return (
		<Flex
			p="3"
			direction="row"
			gap="3"
			align="center"
			style={{
				overflowX: "auto",
				overflowY: "clip",
				height: "100%",
				width: "100%",
				scrollbarWidth: "thin",
				scrollbarColor: "var(--gray-a8) transparent",
			}}
			className="ribbon-scrollbar"
			asChild
		>
			<motion.div
				initial={{ x: 10, opacity: 0 }}
				animate={{ x: 0, opacity: 1 }}
				exit={{ x: -10, opacity: 0 }}
				layout
				ref={frameRef}
			>
				{reserveControlRows && (
					<RibbonHeightReserve rows={reserveControlRows} />
				)}
				{customizeEnabled && mode !== null ? (
					<CustomizedRibbonChildren mode={mode}>
						{children}
					</CustomizedRibbonChildren>
				) : (
					children
				)}
			</motion.div>
		</Flex>
	);
});
