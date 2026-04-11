import {
	DismissRegular,
	Search16Regular,
	TextFont24Regular,
	ArrowUpload24Regular,
	Delete20Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Grid,
	Heading,
	IconButton,
	ScrollArea,
	SegmentedControl,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { fontSelectionDialogAtom } from "$/states/dialogs";
import { appFontAtom, appFontStyleAtom, appFontWeightAtom, customFontDataAtom, customFontNameAtom } from "../states/index.ts";

// A massive library of popular Google Fonts (300+)
export const GOOGLE_FONTS = [
	"Inter", "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", "Source Sans Pro", "Roboto Condensed", 
	"Oswald", "Raleway", "Merriweather", "Noto Sans", "Playfair Display", "Mukta", "Rubik", "Lora", 
	"Nunito", "Ubuntu", "PT Sans", "Work Sans", "Arimo", "Quicksand", "Kanit", "Noto Serif", 
	"Barlow", "Titillium Web", "Fira Sans", "Nanum Gothic", "Heebo", "Josefin Sans", "Dosis", "Arvo", 
	"Oxygen", "PT Serif", "Libre Franklin", "Hind", "Bitter", "Karla", "Bebas Neue", "Crimson Text", 
	"Libre Baskerville", "Cabin", "Anton", "Abel", "Cairo", "Exo 2", "Varela Round", "Prompt", 
	"EB Garamond", "Muli", "Comfortaa", "Orbitron", "Questrial", "Saira", "Archivo", "Rajdhani", 
	"Pacifico", "Dancing Script", "Caveat", "Satisfy", "Lobster", "Righteous", "Permanent Marker", 
	"Fredoka One", "Patua One", "Yellowtail", "Abril Fatface", "Kaushan Script", "Passion One", 
	"Lobster Two", "Courgette", "Shadows Into Light", "Creepster", "Bangers", "Luckiest Guy", 
	"Sacramento", "Cookie", "Great Vibes", "Indie Flower", "Zilla Slab", "Cinzel", "Cormorant Garamond", 
	"Domine", "Cardo", "Josefin Slab", "Spectral", "Tinos", "Old Standard TT", "Crimson Pro", 
	"JetBrains Mono", "Fira Code", "Source Code Pro", "Inconsolata", "Ubuntu Mono", "Space Mono", 
	"IBM Plex Mono", "Courier Prime", "Anonymous Pro", "Nanum Gothic Coding",
	"Alice", "Amatic SC", "Assistant", "Balsamiq Sans", "Bebas Neue", "BioRhyme", "Bree Serif",
	"Cantarell", "Catamaran", "Chivo", "Cinzel Decorative", "Concert One", "Cookie", "Cormorant",
	"Cuprum", "DM Sans", "DM Serif Display", "Didact Gothic", "Eczar", "Faustina", "Frank Ruhl Libre",
	"Gelasio", "Hind Siliguri", "Inika", "Jost", "Kufam", "Lexend", "Libre Caslon Text", "Manrope",
	"Martel", "Newsreader", "Overpass", "Oxanium", "Public Sans", "Recursive", "Red Hat Display",
	"Sen", "Sora", "Syne", "Tenor Sans", "Urbanist", "Vollkorn", "Yantramanav", "Alata", "Aleo",
	"Almarai", "Amaranth", "Asap", "Asap Condensed", "Averia Serif Libre", "B612", "Baloo 2",
	"Bangla", "Baskervville", "Belleza", "Bodoni Moda", "Bottler", "Calistoga", "Castoro", "Chakra Petch",
	"Charm", "Codystar", "Coming Soon", "Copse", "Covered By Your Grace", "DM Mono", "Darker Grotesque",
	"Delius", "Diplomata SC", "Domine", "DotGothic16", "Eagle Lake", "Economica", "El Messiri",
	"Enriqueta", "Ewert", "Fahkwang", "Fanwood Text", "Farro", "Farsan", "Fascinate", "Fauna One",
	"Federant", "Federo", "Felipa", "Fenix", "Finger Paint", "Flamenco", "Flavors", "Fondamento",
	"Forum", "Fraunces", "Frederickathe Great", "Fresca", "Frijole", "Fugaz One", "GFS Didot",
	"GFS Neohellenic", "Gabriela", "Gafata", "Galada", "Galdeano", "Galindo", "Gentium Basic",
	"Gentium Book Basic", "Geo", "Geostar", "Geostar Fill", "Germania One", "Gidugu", "Gilda Display",
	"Give You Glory", "Glass Antiqua", "Glegoo", "Gloria Hallelujah", "Glory", "Gluten", "Goblin One",
	"Gochi Hand", "Goldman", "Goudy Bookletter 1911", "Gowun Batang", "Gowun Dodum", "Graduate",
	"Grand Hotel", "Grandstander", "Gravitas One", "Great Vibes", "Grechen Fuemen", "Grenze",
	"Grenze Gotisch", "Griffy", "Gruppo", "Gudea", "Gugi", "Gupter", "Gurajada", "Habibi", "Halant",
	"Hammersmith One", "Hanalei", "Hanalei Fill", "Handlee", "Hanuman", "Happy Monkey", "Hasan Alquds",
	"Hasti", "Hepta Slab", "Herr Von Muellerhoff", "Hi Melody", "Hina Mincho", "Hind Guntur",
	"Hind Madurai", "Hind Vadodara", "Holtwood One SC", "Homemade Apple", "Honeymoon", "Horta",
	"Hubballi", "IBM Plex Sans", "IBM Plex Serif", "IM Fell DW Pica", "IM Fell Double Pica",
	"IM Fell English", "IM Fell French Canon", "IM Fell Great Primer", "Ibarra Real Nova", "Iceberg",
	"Iceland", "Imbue", "Imperial Script", "Imprima", "Inspiration", "Instrument Sans", "Inter Tight"
];

const SYSTEM_FONTS = [
	"Arial", "Helvetica", "Verdana", "Tahoma", "Trebuchet MS", "Impact", "Times New Roman", "Georgia", 
	"Garamond", "Courier New", "Comic Sans MS", "Palatino", "Bookman", "Avant Garde", "Apple System", 
	"Segoe UI", "San Francisco", "Avenir", "Futura", "Optima", "Gill Sans", "Franklin Gothic", 
	"Century Gothic", "Lucida Grande", "Standard Symbols PS", "Nimbus Sans L"
];

const DEFAULT_FONTS = [
	{ label: "AMLL Default (MiSans)", value: '"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
	{ label: "Modern Sans Stack", value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
	{ label: "Modern Serif Stack", value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
	{ label: "Modern Mono Stack", value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }
];

export const FontSelectionDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(fontSelectionDialogAtom);
	const [appFont, setAppFont] = useAtom(appFontAtom);
	const [appFontWeight, setAppFontWeight] = useAtom(appFontWeightAtom);
	const [appFontStyle, setAppFontStyle] = useAtom(appFontStyleAtom);
	const setCustomFontData = useSetAtom(customFontDataAtom);
	const [customFontName, setCustomFontName] = useAtom(customFontNameAtom);
	
	const [searchQuery, setSearchQuery] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const filteredGoogleFonts = useMemo(() => {
		const search = searchQuery.toLowerCase();
		return GOOGLE_FONTS.filter(font => font.toLowerCase().includes(search));
	}, [searchQuery]);

	const filteredSystemFonts = useMemo(() => {
		const search = searchQuery.toLowerCase();
		return SYSTEM_FONTS.filter(font => font.toLowerCase().includes(search));
	}, [searchQuery]);

	const handleSelectFont = (fontFamily: string, isGoogleFont = true) => {
		if (isGoogleFont) {
			setAppFont(`"${fontFamily}", sans-serif`);
			// Ensure it's loaded - simple way is to touch a hidden element or just rely on CSS injection
		} else {
			setAppFont(fontFamily);
		}
		// setIsOpen(false); // Keep it open for user to "preview" maybe?
	};

	const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const dataUrl = event.target?.result as string;
			const fontName = file.name.split(".")[0].replace(/[^a-zA-Z0-9]/g, "");
			setCustomFontData(dataUrl);
			setCustomFontName(fontName);
			setAppFont(`"${fontName}", sans-serif`);
			toast.success(t("settings.appearance.fontImportSuccess", "Font imported successfully!"));
		};
		reader.readAsDataURL(file);
	};

	const clearCustomFont = () => {
		setCustomFontData(null);
		setCustomFontName(null);
		setAppFont('"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif');
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 850, width: "95vw", height: "90vh", maxHeight: 900, padding: "32px" }}>
				<Flex justify="between" align="center" mb="5">
					<Flex align="center" gap="3">
						<TextFont24Regular />
						<Dialog.Title mb="0" style={{ fontSize: "32px" }}>
							{t("settings.appearance.fontLibrary", "Font Library")}
						</Dialog.Title>
					</Flex>
					<Dialog.Close>
						<IconButton variant="ghost" color="gray" style={{ cursor: "pointer" }}>
							<DismissRegular />
						</IconButton>
					</Dialog.Close>
				</Flex>

				<Flex direction="column" gap="5" height="calc(100% - 50px)">
					<Card variant="surface" style={{ padding: "40px", backgroundColor: "var(--gray-2)" }}>
						<Grid columns="2" gap="6" width="100%">
							<Flex direction="column" gap="3">
								<Text size="4" weight="bold" mb="2">{t("settings.appearance.fontWeight", "Font Weight")}</Text>
								<SegmentedControl.Root size="3" value={appFontWeight} onValueChange={setAppFontWeight} style={{ width: "100%" }}>
									<SegmentedControl.Item value="400" style={{ flexGrow: 1 }}>{t("settings.appearance.weight.regular", "Regular")}</SegmentedControl.Item>
									<SegmentedControl.Item value="700" style={{ flexGrow: 1 }}>{t("settings.appearance.weight.bold", "Bold")}</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
							<Flex direction="column" gap="3">
								<Text size="4" weight="bold" mb="2">{t("settings.appearance.fontStyle", "Font Style")}</Text>
								<SegmentedControl.Root size="3" value={appFontStyle} onValueChange={setAppFontStyle} style={{ width: "100%" }}>
									<SegmentedControl.Item value="normal" style={{ flexGrow: 1 }}>{t("settings.appearance.style.normal", "Normal")}</SegmentedControl.Item>
									<SegmentedControl.Item value="italic" style={{ flexGrow: 1 }}>{t("settings.appearance.style.italic", "Italic")}</SegmentedControl.Item>
								</SegmentedControl.Root>
							</Flex>
						</Grid>
					</Card>

					<Flex gap="3" wrap="wrap" align="center">
						<TextField.Root
							placeholder={t("common.search", "Search fonts...")}
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
							{t("settings.appearance.importFont", "Import Font File")}
						</Button>
					</Flex>

					{customFontName && (
						<Card variant="surface" style={{ backgroundColor: "var(--indigo-3)" }}>
							<Flex align="center" justify="between">
								<Flex direction="column">
									<Text size="1" color="indigo" weight="bold">
										{t("settings.appearance.customFontActive", "LOCAL CUSTOM FONT")}
									</Text>
									<Text size="3" style={{ fontFamily: `"${customFontName}", sans-serif` }}>
										{customFontName}
									</Text>
								</Flex>
								<Flex gap="2">
									<Button 
										variant="solid" 
										color="indigo" 
										size="1"
										onClick={() => handleSelectFont(`"${customFontName}", sans-serif`, false)}
										disabled={appFont === `"${customFontName}", sans-serif`}
									>
										{t("common.apply", "Apply")}
									</Button>
									<IconButton 
										variant="ghost" 
										color="red" 
										size="1"
										onClick={clearCustomFont}
									>
										<Delete20Regular />
									</IconButton>
								</Flex>
							</Flex>
						</Card>
					)}

					<ScrollArea type="always" scrollbars="vertical" style={{ flexGrow: 1 }}>
						<Flex direction="column" gap="4" pr="4" pb="6">
							<Box>
								<Heading size="3" mb="2">{t("settings.appearance.defaultFonts", "Standard Stacks")}</Heading>
								<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
									{DEFAULT_FONTS.map(font => (
										<Card 
											key={font.label} 
											style={{ 
												cursor: "pointer",
												padding: "12px",
												minHeight: "60px",
												display: "flex",
												alignItems: "center",
												border: appFont === font.value ? "2px solid var(--accent-9)" : "none",
											}}
											onClick={() => handleSelectFont(font.value, false)}
										>
											<Text size="3" style={{ fontFamily: font.value }}>{font.label}</Text>
										</Card>
									))}
								</Grid>
							</Box>

							{filteredSystemFonts.length > 0 && (
								<Box>
									<Heading size="3" mb="2">{t("settings.appearance.systemFonts", "System Fonts")}</Heading>
									<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
										{filteredSystemFonts.map(font => (
											<Card 
												key={font} 
												style={{ 
													cursor: "pointer",
													padding: "12px",
													minHeight: "60px",
													display: "flex",
													alignItems: "center",
													border: appFont === `"${font}", sans-serif` ? "2px solid var(--accent-9)" : "none",
												}}
												onClick={() => handleSelectFont(font, false)}
											>
												<Text size="4" style={{ fontFamily: `"${font}", sans-serif`, fontWeight: appFontWeight, fontStyle: appFontStyle }}>{font}</Text>
											</Card>
										))}
									</Grid>
								</Box>
							)}

							<Box>
								<Heading size="3" mb="2">{t("settings.appearance.googleFonts", "Google Fonts Library")}</Heading>
								<Grid columns="repeat(auto-fill, minmax(280px, 1fr))" gap="3">
									{filteredGoogleFonts.map(font => (
										<Card 
											key={font} 
											style={{ 
												cursor: "pointer",
												padding: "12px",
												minHeight: "80px",
												display: "flex",
												flexDirection: "column",
												justifyContent: "center",
												border: appFont === `"${font}", sans-serif` ? "2px solid var(--accent-9)" : "none",
											}}
											onClick={() => handleSelectFont(font)}
										>
											<Flex direction="column" gap="1">
												<Text size="1" color="gray">{font}</Text>
												<Text size="5" style={{ fontFamily: `"${font}", sans-serif`, fontWeight: appFontWeight, fontStyle: appFontStyle, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
													{font}
												</Text>
											</Flex>
										</Card>
									))}
								</Grid>
							</Box>
						</Flex>
					</ScrollArea>
					
					<Flex justify="end" pt="2">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{t("common.close", "Close")}
							</Button>
						</Dialog.Close>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
