import type { Window } from "@tauri-apps/api/window";
import styles from "./ResizeEdges.module.css";

type ResizeDirection = Parameters<Window["startResizeDragging"]>[0];

const EDGES: readonly { direction: ResizeDirection; className: string }[] = [
	{ direction: "North", className: styles.north },
	{ direction: "South", className: styles.south },
	{ direction: "West", className: styles.west },
	{ direction: "East", className: styles.east },
	{ direction: "NorthWest", className: styles.northWest },
	{ direction: "NorthEast", className: styles.northEast },
	{ direction: "SouthWest", className: styles.southWest },
	{ direction: "SouthEast", className: styles.southEast },
];

/**
 * Thin strips along the window's edges that show a resize cursor and start a
 * resize, for a window without native decorations (the Linux Flatpak).
 */
export function ResizeEdges() {
	return (
		<div className={styles.edges} aria-hidden="true">
			{EDGES.map(({ direction, className }) => (
				<div
					key={direction}
					className={className}
					onPointerDown={(event) => {
						if (event.button !== 0) return;
						event.preventDefault();
						import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
							getCurrentWindow().startResizeDragging(direction),
						);
					}}
				/>
			))}
		</div>
	);
}
