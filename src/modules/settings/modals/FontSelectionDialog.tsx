import { DismissRegular, TextFont24Regular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	IconButton,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { CustomFontSection } from "./FontSelectionDialog/CustomFontSection";
import { FontLibrarySection } from "./FontSelectionDialog/FontLibrarySection";
import { FontSearchSection } from "./FontSelectionDialog/FontSearchSection";
import { FontStyleSection } from "./FontSelectionDialog/FontStyleSection";
import { useFontSelection } from "./FontSelectionDialog/useFontSelection";

export { GOOGLE_FONTS } from "./FontSelectionDialog/catalog";
export const FontSelectionDialog = () => {
	const { t } = useTranslation();
	const state = useFontSelection();
	return (
		<Dialog.Root open={state.isOpen} onOpenChange={state.setIsOpen}>
			<Dialog.Content
				style={{
					maxWidth: 850,
					width: "95vw",
					height: "90vh",
					maxHeight: 900,
					padding: "32px",
				}}
			>
				<VisuallyHidden>
					<Dialog.Description>
						{t(
							"settings.appearance.fontDialogDescription",
							"Choose a standard, system or Google font.",
						)}
					</Dialog.Description>
				</VisuallyHidden>
				<Flex justify="between" align="center" mb="5">
					<Flex align="center" gap="3">
						<TextFont24Regular />
						<Dialog.Title
							mb="0"
							style={{ fontSize: "32px", letterSpacing: "-0.028em" }}
						>
							{state.t("settings.appearance.fontLibrary", "Font library")}
						</Dialog.Title>
					</Flex>
					<Dialog.Close>
						<IconButton
							variant="ghost"
							color="gray"
							style={{ cursor: "pointer" }}
							aria-label={t("common.close", "Close")}
						>
							<DismissRegular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				<Flex direction="column" gap="5" height="calc(100% - 50px)">
					<FontStyleSection {...state} />

					<FontSearchSection {...state} />

					<CustomFontSection {...state} />

					<FontLibrarySection {...state} />

					<Flex justify="end" pt="2">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{state.t("common.close", "Close")}
							</Button>
						</Dialog.Close>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
