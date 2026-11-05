import {
	ArrowDownload24Regular,
	CheckmarkRegular,
	CopyArrowRightRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Flex,
	Heading,
	Progress,
	Text,
	Theme,
} from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "react-toastify";
import {
	type BackupCounts,
	buildBackup,
	exportBackup,
	getBackupCounts,
	saveBackupFile,
} from "$/modules/settings/backup/export";
import { applyBackup } from "$/modules/settings/backup/import";
import {
	BACKUP_CATEGORY_IDS,
	type BackupFile,
	validateBackupFile,
} from "$/modules/settings/backup/types";
import {
	createMigrationNonce,
	MIGRATION_PROTOCOL_VERSION,
	MIGRATION_RECEIVE_PATH,
	MIGRATION_SEND_PATH,
	type TransferRoute,
	transferRouteFrom,
	transferRoutesTo,
} from "./config";
import {
	getMigrationConflicts,
	hasMigrationConflicts,
	type MigrationConflictSummary,
	type MigrationMergeChoices,
	mergeMigrationBackup,
} from "./merge";
import {
	decodeMigrationPayload,
	encodeMigrationPayload,
	isMigrationMessage,
	type MigrationCounts,
	type MigrationMessage,
} from "./protocol";

const allCategories = new Set(BACKUP_CATEGORY_IDS);
const messageTimeout = 30_000;

const hostOf = (origin: string) => new URL(origin).host;

function countsLines(t: TFunction, counts: BackupCounts | MigrationCounts) {
	const lines: string[] = [
		t("domainMigration.transfer.counts", {
			defaultValue:
				"{projects, plural, one {# project} other {# projects}}, {settings, plural, one {# setting} other {# settings}}, {shortcuts, plural, one {# shortcut} other {# shortcuts}}",
			projects: counts.projects,
			settings: counts.settings,
			shortcuts: counts.keybindings,
		}),
	];
	if (counts.apiKeys > 0)
		lines.push(
			t("domainMigration.transfer.includesToken", "Includes your Genius token"),
		);
	if (
		counts.assets.background ||
		counts.assets.presets > 0 ||
		counts.assets.font
	)
		lines.push(
			t(
				"domainMigration.transfer.includesAppearance",
				"Includes your background, presets and font",
			),
		);
	return lines;
}

function waitForMigrationMessage(
	accept: (event: MessageEvent, message: MigrationMessage) => boolean,
	peer?: Window,
) {
	return new Promise<MigrationMessage>((resolve, reject) => {
		const cleanup = () => {
			window.clearTimeout(timeout);
			window.clearInterval(closedPoll);
			window.removeEventListener("message", listener);
		};
		const timeout = window.setTimeout(() => {
			cleanup();
			reject(new Error("timeout"));
		}, messageTimeout);
		const closedPoll = window.setInterval(() => {
			if (!peer?.closed) return;
			cleanup();
			reject(new Error("closed"));
		}, 500);
		const listener = (event: MessageEvent) => {
			if (!isMigrationMessage(event.data) || !accept(event, event.data)) return;
			cleanup();
			resolve(event.data);
		};
		window.addEventListener("message", listener);
	});
}

type MigrationReply =
	| { type: "chunk-ack"; index: number }
	| { type: "migration-complete"; counts: MigrationCounts }
	| { type: "migration-error"; reason: string }
	| { type: "migration-cancelled" };

function MigrationShell({ children }: { children: React.ReactNode }) {
	return (
		<Theme appearance="dark" accentColor="iris">
			<Flex align="center" justify="center" minHeight="100vh" p="4">
				<Card style={{ width: "min(680px, 100%)" }}>{children}</Card>
			</Flex>
			<ToastContainer theme="dark" />
		</Theme>
	);
}

function SenderPage({ route }: { route: TransferRoute }) {
	const { t } = useTranslation();
	const { destination } = route;
	const [counts, setCounts] = useState<BackupCounts | null>(null);
	const [status, setStatus] = useState<string>(() =>
		t("domainMigration.transfer.ready", "Ready to copy your data."),
	);
	const [progress, setProgress] = useState(0);
	const [working, setWorking] = useState(false);

	useEffect(() => {
		void getBackupCounts()
			.then(setCounts)
			.catch(() =>
				setStatus(
					t(
						"domainMigration.transfer.readFailed",
						"Could not read the data on this site.",
					),
				),
			);
	}, [t]);

	const migrate = useCallback(async () => {
		const nonce = createMigrationNonce();
		const receiver = window.open(
			`${destination}${MIGRATION_RECEIVE_PATH}#${nonce}`,
			"amll-domain-migration",
		);
		if (!receiver) {
			setStatus(
				t(
					"domainMigration.transfer.popupBlocked",
					"Your browser blocked the new window. Allow popups and try again, or download a backup.",
				),
			);
			return;
		}
		setWorking(true);
		try {
			setStatus(
				t(
					"domainMigration.transfer.waiting",
					"Waiting for the other site to open...",
				),
			);
			await waitForMigrationMessage(
				(event, message) =>
					event.origin === destination &&
					event.source === receiver &&
					message.nonce === nonce &&
					message.type === "receiver-ready",
				receiver,
			);
			setStatus(
				t("domainMigration.transfer.preparing", "Preparing your data..."),
			);
			const backup = await buildBackup(allCategories);
			const chunks = encodeMigrationPayload(backup);
			receiver.postMessage(
				{
					type: "metadata",
					protocol: MIGRATION_PROTOCOL_VERSION,
					nonce,
					counts: counts ?? (await getBackupCounts()),
					totalChunks: chunks.length,
				} satisfies MigrationMessage,
				destination,
			);

			for (let index = 0; index < chunks.length; index++) {
				const data = chunks[index];
				const acknowledgement = waitForMigrationMessage(
					(event, message) =>
						event.origin === destination &&
						event.source === receiver &&
						message.nonce === nonce &&
						message.type === "chunk-ack" &&
						message.index === index,
					receiver,
				);
				receiver.postMessage(
					{
						type: "chunk",
						protocol: MIGRATION_PROTOCOL_VERSION,
						nonce,
						index,
						data,
					} satisfies MigrationMessage,
					destination,
					[data],
				);
				await acknowledgement;
				setProgress(((index + 1) / chunks.length) * 100);
			}
			const resultPromise = waitForMigrationMessage(
				(event, message) =>
					event.origin === destination &&
					event.source === receiver &&
					message.nonce === nonce &&
					(message.type === "migration-complete" ||
						message.type === "migration-error" ||
						message.type === "migration-cancelled"),
				receiver,
			);
			receiver.postMessage(
				{
					type: "transfer-complete",
					protocol: MIGRATION_PROTOCOL_VERSION,
					nonce,
				},
				destination,
			);
			setStatus(
				t(
					"domainMigration.transfer.finishThere",
					"Check and finish in the new window.",
				),
			);
			const result = await resultPromise;
			if (result.type === "migration-error") throw new Error("failed");
			if (result.type === "migration-cancelled") throw new Error("cancelled");
			localStorage.setItem(route.completedKey, new Date().toISOString());
			setProgress(100);
			setStatus(
				t(
					"domainMigration.transfer.done",
					"Copied. Your data on this site hasn't changed.",
				),
			);
		} catch (error) {
			const reason = error instanceof Error ? error.message : "";
			setStatus(
				reason === "timeout"
					? t(
							"domainMigration.transfer.timedOut",
							"The other site didn't answer in time. Your data on this site hasn't changed. Try again.",
						)
					: reason === "closed" || reason === "cancelled"
						? t(
								"domainMigration.transfer.stopped",
								"The other window closed before the copy finished. Your data on this site hasn't changed.",
							)
						: t(
								"domainMigration.transfer.failed",
								"The copy failed. Your data on this site hasn't changed.",
							),
			);
		} finally {
			setWorking(false);
		}
	}, [counts, destination, route.completedKey, t]);

	return (
		<MigrationShell>
			<Flex direction="column" gap="4">
				<Box>
					<Heading>
						{t(
							"domainMigration.transfer.sendTitle",
							"Copy your data to {address}",
							{ address: hostOf(destination) },
						)}
					</Heading>
				</Box>
				<Flex direction="column" gap="1">
					{counts ? (
						countsLines(t, counts).map((line) => <Text key={line}>{line}</Text>)
					) : (
						<Text>
							{t("domainMigration.transfer.checking", "Checking your data...")}
						</Text>
					)}
				</Flex>
				{route.kind === "copy" && (
					<Text size="2">
						{t(
							"domainMigration.transfer.copyNote",
							"This is a one-time copy, not a sync. Changes you make afterwards stay on the site where you make them.",
						)}
					</Text>
				)}
				<Text size="2" color="gray">
					{t(
						"domainMigration.transfer.private",
						"Your data goes directly between the two browser windows and is never uploaded.",
					)}
				</Text>
				{progress > 0 && <Progress value={progress} />}
				<Text size="2" role="status">
					{status}
				</Text>
				<Flex gap="2" justify="end" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						onClick={() => void exportBackup(allCategories)}
					>
						<ArrowDownload24Regular />
						{t("domainMigration.notice.backup", "Download backup")}
					</Button>
					<Button disabled={!counts || working} onClick={() => void migrate()}>
						<CopyArrowRightRegular />
						{t("domainMigration.transfer.copy", "Copy my data")}
					</Button>
				</Flex>
			</Flex>
		</MigrationShell>
	);
}

function ReceiverPage({ routes }: { routes: readonly TransferRoute[] }) {
	const { t } = useTranslation();
	const nonce = useMemo(() => window.location.hash.slice(1), []);
	const opener = useRef(window.opener);
	const chunks = useRef<ArrayBuffer[]>([]);
	const expectedChunks = useRef(0);
	const receivedChunks = useRef(new Set<number>());
	const activeRoute = useRef<TransferRoute | null>(null);
	const accepted = useRef(false);
	const completed = useRef(false);
	const [source, setSource] = useState<BackupFile | null>(null);
	const [destination, setDestination] = useState<BackupFile | null>(null);
	const [conflicts, setConflicts] = useState<MigrationConflictSummary | null>(
		null,
	);
	const [status, setStatus] = useState<string>(() =>
		t("domainMigration.transfer.connecting", "Connecting to the other site..."),
	);
	const [working, setWorking] = useState(false);
	const [choices, setChoices] = useState<MigrationMergeChoices>({
		replaceSettings: false,
		replaceKeybindings: false,
		replaceApiKeys: false,
		replaceAppearance: false,
	});

	const reply = useCallback(
		(message: MigrationReply) => {
			if (!opener.current || !activeRoute.current) return;
			opener.current.postMessage(
				{ ...message, protocol: MIGRATION_PROTOCOL_VERSION, nonce },
				activeRoute.current.source,
			);
		},
		[nonce],
	);

	const finish = useCallback(
		async (
			sourceBackup: BackupFile,
			destinationBackup: BackupFile,
			mergeChoices: MigrationMergeChoices,
		) => {
			setWorking(true);
			try {
				const route = activeRoute.current;
				if (!route) throw new Error("No transfer route.");
				const merged = mergeMigrationBackup(sourceBackup, destinationBackup, {
					...mergeChoices,
					keepBothProjects:
						route.kind === "copy"
							? (name) =>
									t("domainMigration.transfer.copyName", "{name} (copy)", {
										name,
									})
							: undefined,
				});
				await applyBackup(merged, allCategories);
				const verifiedCounts = await getBackupCounts();
				const expected = {
					settings: Object.keys(merged.categories.settings?.localStorage ?? {})
						.length,
					keybindings: Object.keys(
						merged.categories.keybindings?.localStorage ?? {},
					).length,
					apiKeys: Object.keys(merged.categories.apiKeys?.localStorage ?? {})
						.length,
					background: Boolean(merged.categories.assets?.backgroundImage),
					projects: merged.categories.projects?.projects.length ?? 0,
				};
				if (
					verifiedCounts.settings < expected.settings ||
					verifiedCounts.keybindings < expected.keybindings ||
					verifiedCounts.apiKeys < expected.apiKeys ||
					verifiedCounts.projects < expected.projects ||
					(expected.background && !verifiedCounts.assets.background)
				)
					throw new Error("The copied data could not be verified.");
				localStorage.setItem(route.completedKey, new Date().toISOString());
				completed.current = true;
				reply({ type: "migration-complete", counts: verifiedCounts });
				setStatus(
					t(
						"domainMigration.transfer.opening",
						"Copied. Opening the TTML Tool...",
					),
				);
				window.setTimeout(() => window.location.replace("/"), 1200);
			} catch (error) {
				const reason =
					error instanceof Error
						? error.message
						: "Could not apply the copied data.";
				reply({ type: "migration-error", reason });
				setStatus(
					t(
						"domainMigration.transfer.applyFailed",
						"Could not save the copied data here. The other site's data hasn't changed.",
					),
				);
				setWorking(false);
			}
		},
		[reply, t],
	);

	useEffect(() => {
		window.history.replaceState(null, "", window.location.pathname);
		if (!/^[a-f0-9]{32}$/.test(nonce) || !opener.current) {
			setStatus(
				t(
					"domainMigration.transfer.invalidLink",
					"This page only works when the site with your data opens it. Start from that site.",
				),
			);
			return;
		}

		const listener = (event: MessageEvent) => {
			const route = routes.find((item) => item.source === event.origin);
			if (
				!route ||
				event.source !== opener.current ||
				!isMigrationMessage(event.data) ||
				event.data.nonce !== nonce
			)
				return;
			const message = event.data;
			activeRoute.current = route;
			if (message.type === "metadata" && !accepted.current) {
				accepted.current = true;
				expectedChunks.current = message.totalChunks;
				chunks.current = new Array(message.totalChunks);
				receivedChunks.current.clear();
				setStatus(
					t("domainMigration.transfer.receiving", "Receiving your data..."),
				);
				return;
			}
			if (message.type === "chunk" && accepted.current) {
				if (message.index < 0 || message.index >= expectedChunks.current)
					return;
				if (receivedChunks.current.has(message.index)) {
					reply({
						type: "migration-error",
						reason: "A duplicate migration chunk was rejected.",
					});
					return;
				}
				chunks.current[message.index] = message.data;
				receivedChunks.current.add(message.index);
				reply({ type: "chunk-ack", index: message.index });
				return;
			}
			if (message.type === "transfer-complete" && accepted.current) {
				const failed = () =>
					setStatus(
						t(
							"domainMigration.transfer.receiveFailed",
							"The data didn't arrive complete. Try again from the site with your data.",
						),
					);
				if (chunks.current.some((chunk) => !(chunk instanceof ArrayBuffer))) {
					reply({
						type: "migration-error",
						reason: "The transfer was incomplete.",
					});
					failed();
					return;
				}
				void (async () => {
					try {
						const decoded = decodeMigrationPayload(chunks.current);
						validateBackupFile(decoded);
						const current = await buildBackup(allCategories);
						const nextConflicts = getMigrationConflicts(decoded, current);
						setSource(decoded);
						setDestination(current);
						setConflicts(nextConflicts);
						if (!hasMigrationConflicts(nextConflicts)) {
							await finish(decoded, current, {
								replaceSettings: false,
								replaceKeybindings: false,
								replaceApiKeys: false,
								replaceAppearance: false,
							});
						} else {
							setStatus(
								t(
									"domainMigration.transfer.review",
									"Some of this data is already here. Choose what to keep.",
								),
							);
						}
					} catch (error) {
						const reason =
							error instanceof Error
								? error.message
								: "The received data is invalid.";
						reply({ type: "migration-error", reason });
						failed();
					}
				})();
			}
		};
		const cancelOnClose = () => {
			if (!completed.current) reply({ type: "migration-cancelled" });
		};
		window.addEventListener("message", listener);
		window.addEventListener("beforeunload", cancelOnClose);
		for (const { source: origin } of routes) {
			opener.current.postMessage(
				{ type: "receiver-ready", protocol: MIGRATION_PROTOCOL_VERSION, nonce },
				origin,
			);
		}
		return () => {
			window.removeEventListener("message", listener);
			window.removeEventListener("beforeunload", cancelOnClose);
		};
	}, [finish, nonce, reply, routes, t]);

	return (
		<MigrationShell>
			<Flex direction="column" gap="4">
				<Heading>
					{t("domainMigration.transfer.receiveTitle", "Receive your data")}
				</Heading>
				<Text size="2" role="status">
					{status}
				</Text>
				{conflicts && hasMigrationConflicts(conflicts) && (
					<Flex direction="column" gap="3">
						<Text size="2" color="gray">
							{activeRoute.current?.kind === "copy"
								? t(
										"domainMigration.transfer.projectsKept",
										"Projects already here are never overwritten. If the other site has a newer version, it's added next to yours as a copy.",
									)
								: t(
										"domainMigration.transfer.projectsNewest",
										"Projects on both sites keep the newer version.",
									)}
						</Text>
						{(
							[
								[
									"replaceSettings",
									conflicts.settings.length,
									t(
										"domainMigration.transfer.useSettings",
										"Use the other site's value for settings that differ",
									),
								],
								[
									"replaceKeybindings",
									conflicts.keybindings.length,
									t(
										"domainMigration.transfer.useShortcuts",
										"Use the other site's shortcuts where they differ",
									),
								],
								[
									"replaceApiKeys",
									conflicts.apiKeys.length,
									t(
										"domainMigration.transfer.useToken",
										"Use the other site's Genius token",
									),
								],
								[
									"replaceAppearance",
									Number(conflicts.appearance),
									t(
										"domainMigration.transfer.useAppearance",
										"Use the other site's background, presets and font",
									),
								],
							] as const
						)
							.filter(([, count]) => count > 0)
							.map(([key, , label]) => (
								<Text as="label" key={key}>
									<Flex gap="2" align="center">
										<Checkbox
											checked={choices[key]}
											onCheckedChange={(value) =>
												setChoices((current) => ({
													...current,
													[key]: value === true,
												}))
											}
										/>
										{label}
									</Flex>
								</Text>
							))}
						<Button
							disabled={!source || !destination || working}
							onClick={() =>
								source &&
								destination &&
								void finish(source, destination, choices)
							}
						>
							<CheckmarkRegular />
							{t("domainMigration.transfer.finish", "Finish copying")}
						</Button>
					</Flex>
				)}
				{source && (
					<Button
						variant="soft"
						color="gray"
						onClick={() => void saveBackupFile(source)}
					>
						<ArrowDownload24Regular />
						{t(
							"domainMigration.transfer.downloadReceived",
							"Download the received data",
						)}
					</Button>
				)}
			</Flex>
		</MigrationShell>
	);
}

export function MigrationRouteApp() {
	const { t } = useTranslation();
	const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);
	const { origin, pathname } = window.location;
	const sendRoute = transferRouteFrom(origin, isTauri);
	const receiveRoutes = transferRoutesTo(origin, isTauri);
	if (pathname === MIGRATION_SEND_PATH && sendRoute)
		return <SenderPage route={sendRoute} />;
	if (pathname === MIGRATION_RECEIVE_PATH && receiveRoutes.length > 0)
		return <ReceiverPage routes={receiveRoutes} />;
	return (
		<MigrationShell>
			<Heading>
				{t(
					"domainMigration.transfer.invalidTitle",
					"This page isn't available here",
				)}
			</Heading>
			<Text>
				{t(
					"domainMigration.transfer.invalidBody",
					"Copying data only works between the official TTML Tool sites.",
				)}
			</Text>
		</MigrationShell>
	);
}
