import { Open16Regular } from "@fluentui/react-icons";
import { Link } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { InlineAlert } from "$/components/InlineAlert";
import { openExternal } from "$/modules/settings/modals/about/externalLinks";

/**
 * Says Genius blocked a lyrics request and links to the song's page, where a
 * person can pass the check and copy the lyrics themselves.
 */
export function GeniusBlockedMessage({ songUrl }: { songUrl: string }) {
	const { t } = useTranslation();
	return (
		<InlineAlert
			action={
				<Link
					size="2"
					href={songUrl}
					target="_blank"
					rel="noreferrer"
					onClick={(event) => {
						if (import.meta.env.TAURI_ENV_PLATFORM) {
							event.preventDefault();
							openExternal(songUrl);
						}
					}}
				>
					<Open16Regular
						aria-hidden
						style={{
							marginInlineEnd: "var(--space-1)",
							verticalAlign: "text-bottom",
						}}
					/>
					{t("genius.openOnGenius", "Open on Genius")}
				</Link>
			}
		>
			{t(
				"genius.lyricsBlocked",
				"Genius blocked this lyrics request, likely a Cloudflare check. Try again in a moment, or copy the lyrics from the song page.",
			)}
		</InlineAlert>
	);
}
