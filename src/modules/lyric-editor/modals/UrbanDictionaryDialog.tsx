import {
	BookSearchRegular,
	DismissRegular,
	SearchRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Flex,
	IconButton,
	Link,
	ScrollArea,
	Spinner,
	Text,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "$/components/EmptyState";
import { Panel } from "$/components/Panel";
import { SectionHeader } from "$/components/SectionHeader";
import { urbanDictionaryDialogAtom } from "$/states/urban-dictionary";
import styles from "./UrbanDictionaryDialog.module.css";

interface Definition {
	definition: string;
	permalink: string;
	thumbs_up: number;
	author: string;
	word: string;
	defid: number;
	example: string;
	thumbs_down: number;
}

export const UrbanDictionaryDialog = () => {
	const { t } = useTranslation();
	const [state, setState] = useAtom(urbanDictionaryDialogAtom);
	const [definitions, setDefinitions] = useState<Definition[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (state.open && state.word) {
			setLoading(true);
			setError(null);
			fetch(
				`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(state.word)}`,
			)
				.then((res) => res.json())
				.then((data) => {
					setDefinitions(data.list || []);
					setLoading(false);
				})
				.catch((err) => {
					console.error("Failed to fetch Urban Dictionary definitions", err);
					setError("Failed to reach Urban Dictionary");
					setLoading(false);
				});
		} else {
			setDefinitions([]);
		}
	}, [state.open, state.word]);

	const handleClose = () => {
		setState({ ...state, open: false });
	};

	const closeButtonRef = useRef<HTMLButtonElement>(null);

	// Escape closes, focus starts on the close button and goes back to where it
	// was. An open Radix menu or popover inside gets Escape first.
	useEffect(() => {
		if (!state.open) return;
		const previous =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		closeButtonRef.current?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			if (event.isComposing || event.keyCode === 229) return;
			if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
			event.preventDefault();
			setState((current) => ({ ...current, open: false }));
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			if (previous?.isConnected) previous.focus();
		};
	}, [state.open, setState]);

	return (
		<>
			{state.open && (
				<Box className={styles.overlay} onClick={handleClose}>
					<Box className={styles.dialog} onClick={(e) => e.stopPropagation()}>
						<SectionHeader
							as="h2"
							size="3"
							className={styles.header}
							icon={<BookSearchRegular className={styles.headerIcon} />}
							title={t("urbanDictionary.title")}
							actions={
								<IconButton
									ref={closeButtonRef}
									size="1"
									variant="ghost"
									onClick={handleClose}
									color="gray"
									aria-label={t("common.close", "Close")}
								>
									<DismissRegular />
								</IconButton>
							}
						/>

						<Box className={styles.word}>
							<Flex align="baseline" gap="2">
								<Text size="6" weight="bold" className={styles.wordText}>
									{state.word}
								</Text>
								<Text size="2" color="gray">
									{t("urbanDictionary.slang")}
								</Text>
							</Flex>
						</Box>

						<ScrollArea style={{ maxHeight: "65vh" }} type="auto">
							<Box className={styles.body}>
								{loading ? (
									<Flex
										align="center"
										justify="center"
										className={styles.status}
									>
										<Spinner size="3" />
									</Flex>
								) : error ? (
									<Flex
										direction="column"
										align="center"
										justify="center"
										gap="3"
										className={styles.status}
									>
										<Text color="red" size="2">
											{error}
										</Text>
									</Flex>
								) : definitions.length === 0 ? (
									<Flex
										align="center"
										justify="center"
										className={styles.status}
									>
										<EmptyState
											icon={<SearchRegular />}
											title={t("urbanDictionary.noDefinitions", {
												word: state.word,
											})}
										/>
									</Flex>
								) : (
									<Flex direction="column" gap="4">
										{definitions.map((def) => (
											<Panel key={def.defid} size="2">
												<Flex direction="column" gap="3">
													<Text size="3" className={styles.definition}>
														{def.definition.replace(/\[|\]/g, "")}
													</Text>
													{def.example && (
														<Panel tone="sunken">
															<Text
																size="2"
																color="gray"
																className={styles.example}
															>
																"{def.example.replace(/\[|\]/g, "")}"
															</Text>
														</Panel>
													)}
													<Flex
														justify="between"
														align="center"
														className={styles.footer}
													>
														<Text size="1" color="gray">
															{t("urbanDictionary.by")} {def.author} • 👍{" "}
															{def.thumbs_up}
														</Text>
														<Link
															href={def.permalink}
															target="_blank"
															size="1"
															className={styles.link}
														>
															{t("urbanDictionary.viewOnline")}
														</Link>
													</Flex>
												</Flex>
											</Panel>
										))}
									</Flex>
								)}
							</Box>
						</ScrollArea>
					</Box>
				</Box>
			)}
		</>
	);
};
