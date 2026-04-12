import { type FC, useCallback, useRef, useState } from "react";
import { useAtom } from "jotai";
import { previewPanelWidthAtom } from "$/states/main.ts";

interface ResizablePanelProps {
	children: React.ReactNode;
	minWidth?: number;
	maxWidth?: number;
}

export const ResizablePanel: FC<ResizablePanelProps> = ({
	children,
	minWidth = 300,
	maxWidth = 600,
}) => {
	const [width, setWidth] = useAtom(previewPanelWidthAtom);
	const [isDragging, setIsDragging] = useState(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(width);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			setIsDragging(true);
			startXRef.current = e.clientX;
			startWidthRef.current = width;

			const handleMouseMove = (moveEvent: MouseEvent) => {
				const delta = moveEvent.clientX - startXRef.current;
				const newWidth = Math.max(
					minWidth,
					Math.min(maxWidth, startWidthRef.current - delta),
				);
				setWidth(newWidth);
			};

			const handleMouseUp = () => {
				setIsDragging(false);
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};

			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
		},
		[width, minWidth, maxWidth, setWidth],
	);

	return (
		<div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
			<div
				onMouseDown={handleMouseDown}
				style={{
					width: "8px",
					cursor: "col-resize",
					backgroundColor: isDragging ? "var(--accent-8)" : "transparent",
					transition: "background-color 0.15s",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<div
					style={{
						width: "4px",
						height: "40px",
						borderRadius: "2px",
						backgroundColor: isDragging ? "var(--accent-9)" : "var(--gray-6)",
					}}
				/>
			</div>
			<div style={{ width: `${width}px`, flexShrink: 0, overflow: "hidden" }}>
				{children}
			</div>
		</div>
	);
};
