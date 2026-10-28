import { LinkRegular } from "@fluentui/react-icons";
import {
	Button,
	Card,
	Flex,
	ScrollArea,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { workspaceDirAtom } from "$/modules/project/folder-project/state";
import { error as logError } from "$/utils/logging";
import {
	type FolderPair,
	linkPairAsProject,
	scanFolderForPairs,
} from "../folder-scan";

/**
 * Under the folder scan: TTML and audio files with the same name, saved before
 * projects existed, offered as linked projects.
 */
export const LinkableFilesPanel = () => {
	const { t } = useTranslation();
	const dir = useAtomValue(workspaceDirAtom);
	const [pairs, setPairs] = useState<FolderPair[]>([]);
	const [scanning, setScanning] = useState(false);
	const [linking, setLinking] = useState(false);

	const scan = useCallback(async () => {
		if (!dir) return;
		setScanning(true);
		try {
			setPairs(await scanFolderForPairs(dir));
		} finally {
			setScanning(false);
		}
	}, [dir]);

	useEffect(() => {
		void scan();
	}, [scan]);

	const link = useCallback(
		async (targets: FolderPair[]) => {
			setLinking(true);
			const done: FolderPair[] = [];
			for (const pair of targets) {
				try {
					if (await linkPairAsProject(pair)) done.push(pair);
					else
						toast.error(
							t("projectsHub.scan.linkFailed", "Couldn't link {name}.", {
								name: pair.name,
							}),
						);
				} catch (e) {
					logError(`Failed to link ${pair.lyricPath}`, e);
					toast.error(
						t("projectsHub.scan.linkFailed", "Couldn't link {name}.", {
							name: pair.name,
						}),
					);
				}
			}
			setLinking(false);
			if (done.length === 0) return;
			setPairs((current) => current.filter((pair) => !done.includes(pair)));
			toast.success(
				done.length === 1
					? t("projectsHub.scan.linked", "Linked {name} as a project.", {
							name: done[0].name,
						})
					: t(
							"projectsHub.scan.linkedCount",
							"{count, plural, one {Linked # project} other {Linked # projects}}",
							{ count: done.length },
						),
			);
		},
		[t],
	);

	if (!dir) return null;

	return (
		<Flex direction="column" gap="2">
			<Flex justify="between" align="center" gap="3">
				<Flex direction="column" gap="1" minWidth="0">
					<Text size="2" weight="medium">
						{t("projectsHub.scan.pairsTitle", "Files you can link as projects")}
					</Text>
					<Text size="1" color="gray">
						{t(
							"projectsHub.scan.pairsHint",
							"A TTML and an audio file with the same name. Linking keeps both files where they are.",
						)}
					</Text>
				</Flex>
				{pairs.length > 1 && (
					<Button
						size="1"
						variant="soft"
						disabled={linking}
						onClick={() => void link(pairs)}
						style={{ flexShrink: 0 }}
					>
						<LinkRegular />
						{t("projectsHub.scan.linkAll", "Link all")}
					</Button>
				)}
			</Flex>
			{scanning ? (
				<Flex align="center" gap="2">
					<Spinner size="1" />
					<Text size="1" color="gray">
						{t("projectsHub.scan.scanning", "Looking for files...")}
					</Text>
				</Flex>
			) : pairs.length === 0 ? (
				<Text size="1" color="gray">
					{t(
						"projectsHub.scan.noPairs",
						"No same-name TTML and audio files found.",
					)}
				</Text>
			) : (
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "18vh" }}
				>
					<Flex direction="column" gap="2" pr="3">
						{pairs.map((pair) => (
							<Card key={pair.lyricPath} variant="surface">
								<Flex justify="between" align="center" gap="3">
									<Flex direction="column" gap="1" minWidth="0">
										<Text size="2" weight="bold" truncate>
											{pair.name}
										</Text>
										<Text size="1" color="gray" truncate>
											{pair.lyricFile} + {pair.audioFile}
										</Text>
									</Flex>
									<Button
										size="1"
										variant="soft"
										disabled={linking}
										onClick={() => void link([pair])}
										style={{ flexShrink: 0 }}
									>
										<LinkRegular />
										{t("projectsHub.scan.link", "Link")}
									</Button>
								</Flex>
							</Card>
						))}
					</Flex>
				</ScrollArea>
			)}
		</Flex>
	);
};
