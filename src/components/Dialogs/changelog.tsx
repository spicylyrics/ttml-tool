import { Box, Button, Dialog, Flex, Text, Heading, ScrollArea } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom } from "jotai";
import { changelogDialogAtom } from "$/states/dialogs.ts";
import { DismissRegular } from "@fluentui/react-icons";

export function ChangelogDialog() {
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);

	const openGitHub = async () => {
		const repoUrl = "https://github.com/spicylyrics/ttml-tool/commits/main";
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(repoUrl);
		} else {
			window.open(repoUrl, "_blank");
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">
							Changelog & Updates
						</Dialog.Title>
						<Button variant="soft" size="1" color="indigo" onClick={openGitHub} style={{ cursor: "pointer" }}>
							View Commits on GitHub
						</Button>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea type="always" scrollbars="vertical" style={{ height: "calc(100% - 60px)" }}>
					<Flex direction="column" gap="5" pr="4">
						<Box>
							<Heading size="4" mb="2" color="ruby">v0.1.0 Updates (Latest)</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Line Sync Mode:</strong> Easily perform macro-level (line-by-line) syncing. Go to Time &gt; Sync Level and set it to Line instead of Word. Pressing "Start Next Word/Line" automatically fills empty beats with proportionately distributed offsets based on syllables.
								</Text>
								<Text size="2">
									<strong>Syllable Chunk Splitting:</strong> The Sub-word split menu gives you the option of "Syllable Split" utilizing native hyphenation processing to instantly distribute polysyllabic words properly.
								</Text>
								<Text size="2">
									<strong>Community Guide Repository:</strong> An interactive catalog is now available on the Import Page with embedded community guides/references for creating perfectly formatted AMLL lyrics.
								</Text>
								<Text size="2">
									<strong>Smart Double Click Editor:</strong> If Quick Fixes is disabled, double clicking skips context evaluation saving resources and opening the inline-editor quickly.
								</Text>
							</Flex>
						</Box>
						
						<Box>
							<Heading size="4" mb="2" color="blue">Past Custom Fixes</Heading>
							<Flex direction="column" gap="3">
								<Text size="2">
									<strong>Live Spectrogram Alignment:</strong> Drag-and-drop waveform timing adjustments directly onto phonetic events within the Timeline panel. Visually tune your timings against the actual source audio.
								</Text>
								<Text size="2">
									<strong>Sync Keybinding Performance:</strong> Greatly reduced UI freezing issues related to the <code>undoableLyricLinesAtom</code> memory stack overcommits by isolating history snapshots from real-time events.
								</Text>
                                <Text size="2">
									<strong>Genius Lyrics Importer:</strong> A completely integrated Search Tool for automated text syncing sourced directly from Paxsenix API.
								</Text>
							</Flex>
						</Box>
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}

// Ensure Box is imported. Oops, let me just add it above.
