import { CheckmarkCircle20Filled } from "@fluentui/react-icons";
import { Flex, Grid, ScrollArea, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";
import { SelectablePanel } from "$/components/Panel";
import { SectionHeader } from "$/components/SectionHeader";
import { DEFAULT_FONTS } from "./catalog";
import styles from "./FontLibrarySection.module.css";
import type { FontSelection } from "./useFontSelection";

/** One pickable font. The check pairs with the ring so selection isn't color only. */
const FontCard = ({
	selected,
	onClick,
	tall = false,
	children,
}: {
	selected: boolean;
	onClick: () => void;
	tall?: boolean;
	children: ReactNode;
}) => (
	<SelectablePanel
		selected={selected}
		onClick={onClick}
		className={tall ? styles.tallCard : styles.card}
	>
		<span className={styles.cardBody}>
			<span className={styles.cardText}>{children}</span>
			{selected && (
				<CheckmarkCircle20Filled className={styles.check} aria-hidden="true" />
			)}
		</span>
	</SelectablePanel>
);

export const FontLibrarySection = ({
	t,
	appFont,
	appFontWeight,
	appFontStyle,
	filteredGoogleFonts,
	filteredSystemFonts,
	handleSelectFont,
}: Pick<
	FontSelection,
	| "t"
	| "appFont"
	| "appFontWeight"
	| "appFontStyle"
	| "filteredGoogleFonts"
	| "filteredSystemFonts"
	| "handleSelectFont"
>) => (
	<ScrollArea type="always" scrollbars="vertical" style={{ flexGrow: 1 }}>
		<Flex direction="column" gap="4" pr="4" pb="6">
			<Flex direction="column" gap="2">
				<SectionHeader
					size="3"
					title={t("settings.appearance.defaultFonts", "Standard font stacks")}
				/>
				<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
					{DEFAULT_FONTS.map((font) => (
						<FontCard
							key={font.label}
							selected={appFont === font.value}
							onClick={() => handleSelectFont(font.value, false)}
						>
							<Text size="3" style={{ fontFamily: font.value }}>
								{font.label}
							</Text>
						</FontCard>
					))}
				</Grid>
			</Flex>

			{filteredSystemFonts.length > 0 && (
				<Flex direction="column" gap="2">
					<SectionHeader
						size="3"
						title={t("settings.appearance.systemFonts", "System fonts")}
					/>
					<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
						{filteredSystemFonts.map((font) => (
							<FontCard
								key={font}
								selected={appFont === font}
								onClick={() => handleSelectFont(font, false)}
							>
								<Text
									size="4"
									style={{
										fontFamily: `"${font}", sans-serif`,
										fontWeight: appFontWeight,
										fontStyle: appFontStyle,
									}}
								>
									{font}
								</Text>
							</FontCard>
						))}
					</Grid>
				</Flex>
			)}

			<Flex direction="column" gap="2">
				<SectionHeader
					size="3"
					title={t("settings.appearance.googleFonts", "Google Fonts library")}
				/>
				<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
					{filteredGoogleFonts.map((font) => (
						<FontCard
							key={font}
							tall
							selected={appFont === `"${font}", sans-serif`}
							onClick={() => handleSelectFont(font)}
						>
							<Text size="1" color="gray">
								{font}
							</Text>
							<Text
								size="5"
								className={styles.sample}
								style={{
									fontFamily: `"${font}", sans-serif`,
									fontWeight: appFontWeight,
									fontStyle: appFontStyle,
								}}
							>
								{font}
							</Text>
						</FontCard>
					))}
				</Grid>
			</Flex>
		</Flex>
	</ScrollArea>
);
