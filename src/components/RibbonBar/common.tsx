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
import {
	type FC,
	forwardRef,
	type PropsWithChildren,
	type ReactNode,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";

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

export const RibbonFrame = forwardRef<
	HTMLDivElement,
	PropsWithChildren<{ reserveControlRows?: number }>
>(({ children, reserveControlRows }, ref) => {
	const frameRef = useRef<HTMLDivElement>(null);
	useImperativeHandle(ref, () => frameRef.current as HTMLDivElement, []);

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
			{/* No slide or fade: it runs on every Edit/Time/Preview switch. */}
			<div ref={frameRef}>
				{reserveControlRows && (
					<RibbonHeightReserve rows={reserveControlRows} />
				)}
				{children}
			</div>
		</Flex>
	);
});
