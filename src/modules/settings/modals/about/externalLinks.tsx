import { Link } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import type { ReactNode } from "react";

export const CONTRIBUTORS_URL =
	"https://github.com/spicylyrics/ttml-tool/graphs/contributors";
export const openExternal = async (url: string) => {
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		await open(url);
	} else {
		window.open(url, "_blank");
	}
};

/** A link that opens in the system browser on desktop, not in the app. */
export const ExternalLink = ({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) => (
	<Link
		href={href}
		target="_blank"
		rel="noreferrer"
		onClick={(event) => {
			if (import.meta.env.TAURI_ENV_PLATFORM) {
				event.preventDefault();
				void openExternal(href);
			}
		}}
	>
		{children}
	</Link>
);
