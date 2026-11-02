import { ArrowUpload24Regular, Search16Regular } from "@fluentui/react-icons";
import { Button, TextField } from "@radix-ui/themes";
import { ToolbarGroup } from "$/components/ToolbarGroup";
import type { FontSelection } from "./useFontSelection";
export const FontSearchSection = ({
	t,
	searchQuery,
	setSearchQuery,
	fileInputRef,
	handleFileImport,
}: Pick<
	FontSelection,
	"t" | "searchQuery" | "setSearchQuery" | "fileInputRef" | "handleFileImport"
>) => (
	<ToolbarGroup
		label={t("settings.appearance.fontLibrary", "Font library")}
		wrap
	>
		<TextField.Root
			placeholder={t("common.search", "Search fonts...")}
			aria-label={t("common.search", "Search fonts...")}
			value={searchQuery}
			onChange={(e) => setSearchQuery(e.target.value)}
			style={{ flexGrow: 1, minWidth: "200px" }}
			size="3"
		>
			<TextField.Slot>
				<Search16Regular />
			</TextField.Slot>
		</TextField.Root>

		<input
			type="file"
			accept=".ttf,.otf,.woff,.woff2"
			style={{ display: "none" }}
			ref={fileInputRef}
			onChange={handleFileImport}
		/>
		<Button
			variant="solid"
			size="3"
			onClick={() => fileInputRef.current?.click()}
			style={{ cursor: "pointer" }}
		>
			<ArrowUpload24Regular />
			{t("settings.appearance.importFont", "Import font file")}
		</Button>
	</ToolbarGroup>
);
