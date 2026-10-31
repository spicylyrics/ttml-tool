import { isolateHistory } from "@codemirror/commands";
import { type EditorState, Transaction } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	ArrowSwapRegular,
	ChevronDownRegular,
	ChevronRightRegular,
	ChevronUpRegular,
	DismissRegular,
	SearchRegular,
	SelectObjectRegular,
	TextAsteriskRegular,
	TextBulletListLtrRegular,
	TextCaseTitleRegular,
	TextWholeWordRegular,
} from "@fluentui/react-icons";
import {
	Button,
	Flex,
	IconButton,
	Select,
	Text,
	TextField,
} from "@radix-ui/themes";
import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { shortcutKeyFromEvent } from "$/utils/keybindings";
import {
	dispatchInPlace,
	markupField,
	numberLines,
	REPLACE_KEY,
} from "./extensions";
import type { LyricMarkupFormat, MarkupLine } from "./markup";
import styles from "./SearchPanel.module.css";
import {
	expandReplacement,
	findMatches,
	keepMarks,
	replacementChanges,
	type SearchMatch,
	type SearchOptions,
	type SearchRows,
} from "./search";
import { type LyricSearchRequest, setSearchHighlights } from "./search-view";

const IS_MAC = navigator.userAgent.includes("Mac");
const MOD = IS_MAC ? "Cmd" : "Ctrl";
/** The list stops drawing rows here; the count still says how many there are. */
const LIST_LIMIT = 300;
/** Characters of the line shown on each side of a match in the list. */
const CONTEXT = 28;

/** Whether a translation-row match is in a translation or a romanization. */
function subKindAt(line: MarkupLine, offset: number) {
	if (line.kind === "translation" || line.kind === "romanization")
		return line.kind;
	let sub: "translation" | "romanization" = "translation";
	for (const span of line.spans)
		if (span.type === "subSeparator" && span.to <= offset && span.sub)
			sub = span.sub;
	return sub;
}

type Range = { from: number; to: number };

/**
 * Find and replace for the lyric editor. Matching skips section headers and
 * reads lyric text without its split marks; replacing keeps the marks on
 * letters that didn't change. Every replacement is one undo step.
 */
export function SearchPanel({
	view,
	state,
	format,
	request,
	within,
	onWithinChange,
	onClose,
}: {
	view: EditorView;
	state: EditorState;
	format: LyricMarkupFormat;
	request: LyricSearchRequest;
	/** The range "In selection" holds, kept in step with edits by the editor. */
	within: Range | null;
	onWithinChange: (range: Range | null) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const findRef = useRef<HTMLInputElement>(null);
	const replaceRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState(request.text ?? "");
	const [replacement, setReplacement] = useState("");
	const [showReplace, setShowReplace] = useState(request.mode === "replace");
	const [showList, setShowList] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(false);
	const [wholeWord, setWholeWord] = useState(false);
	const [regex, setRegex] = useState(false);
	const [rows, setRows] = useState<SearchRows>("all");
	const [replaced, setReplaced] = useState<number | null>(null);
	const hasSubRows = format.mode !== "lyric";
	const separator = format.wordSeparator;

	// Which field to focus once it's on screen; the replace row may only
	// appear in the same render.
	const [focusField, setFocusField] = useState<{
		field: "find" | "replace";
	} | null>(null);
	useEffect(() => {
		if (!focusField) return;
		const input =
			focusField.field === "replace" ? replaceRef.current : findRef.current;
		input?.focus();
		input?.select();
	}, [focusField]);

	// The shortcut or palette asked again: take its text and mode.
	useEffect(() => {
		if (request.text) setQuery(request.text);
		if (request.mode === "replace") setShowReplace(true);
		const field =
			request.mode === "replace" && request.text ? "replace" : "find";
		const input = field === "replace" ? replaceRef.current : findRef.current;
		// Focus now when the field is there, so the next keys land in it.
		if (input) {
			input.focus();
			input.select();
		} else setFocusField({ field });
	}, [request]);

	const options = useMemo<SearchOptions>(
		() => ({
			query,
			caseSensitive,
			wholeWord,
			regex,
			rows: hasSubRows ? rows : "all",
			within,
		}),
		[query, caseSensitive, wholeWord, regex, rows, hasSubRows, within],
	);
	const lines = state.field(markupField);
	const result = useMemo(
		() => findMatches(state.doc.toString(), lines, options, separator),
		[state.doc, lines, options, separator],
	);
	const { matches } = result;
	const { from: selFrom, to: selTo } = state.selection.main;
	const current = matches.findIndex(
		(match) => match.from === selFrom && match.to === selTo,
	);

	useEffect(() => {
		view.dispatch({
			effects: setSearchHighlights.of({ ranges: matches, current }),
		});
	}, [view, matches, current]);
	useEffect(
		() => () => {
			view.dispatch({
				effects: setSearchHighlights.of({ ranges: [], current: -1 }),
			});
		},
		[view],
	);

	const select = (match: SearchMatch) => {
		view.dispatch({
			selection: { anchor: match.from, head: match.to },
			effects: EditorView.scrollIntoView(match.from, { y: "center" }),
		});
	};
	const step = (direction: 1 | -1, list = matches) => {
		if (!list.length) return;
		const { from, to } = view.state.selection.main;
		const next =
			direction === 1
				? (list.find((match) => match.from >= to && match.to > from) ?? list[0])
				: ([...list]
						.reverse()
						.find((match) => match.to <= from && match.from < to) ??
					list[list.length - 1]);
		select(next);
	};

	// A new search jumps to the first match from the cursor on. Keyed on what
	// the user set, not on the selection range moving with edits, so typing in
	// the text never pulls the cursor away.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the search itself changes
	useEffect(() => {
		setReplaced(null);
		if (current !== -1 || !matches.length) return;
		const { from } = view.state.selection.main;
		select(matches.find((match) => match.from >= from) ?? matches[0]);
	}, [query, caseSensitive, wholeWord, regex, rows, !!within]);

	const changesFor = (list: SearchMatch[]) =>
		replacementChanges(
			view.state.doc.toString(),
			list,
			replacement,
			options,
			separator,
		);
	const replaceOne = (match = matches[current]) => {
		if (!match) {
			step(1);
			return;
		}
		const changes = view.state.changes(changesFor([match]));
		view.dispatch({
			changes,
			annotations: [
				Transaction.addToHistory.of(true),
				isolateHistory.of("full"),
			],
			userEvent: "input.replace",
		});
		// Then on to the next match after the new text.
		const after = changes.mapPos(match.to);
		const next = findMatches(
			view.state.doc.toString(),
			view.state.field(markupField),
			{
				...options,
				within: within && {
					from: changes.mapPos(within.from, -1),
					to: changes.mapPos(within.to, 1),
				},
			},
			separator,
		).matches;
		const following = next.find((item) => item.from >= after) ?? next[0];
		if (following) select(following);
		setReplaced(1);
	};
	const replaceAll = () => {
		if (!matches.length) return;
		dispatchInPlace(
			view,
			view.state.changes(changesFor(matches)),
			"input.replace.all",
		);
		setReplaced(matches.length);
	};

	const toggleWithin = () => {
		if (within) {
			onWithinChange(null);
			return;
		}
		const { from, to, empty } = view.state.selection.main;
		if (empty) return;
		onWithinChange({ from, to });
	};

	const close = () => {
		onClose();
		view.focus();
	};

	const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
		const mod = IS_MAC ? event.metaKey : event.ctrlKey;
		const shortcutKey = shortcutKeyFromEvent(event);
		if (mod && shortcutKey === "KeyF" && !event.altKey) {
			event.preventDefault();
			findRef.current?.focus();
			findRef.current?.select();
		} else if (
			(REPLACE_KEY === "Mod-h" && mod && shortcutKey === "KeyH") ||
			(REPLACE_KEY !== "Mod-h" && mod && event.altKey && shortcutKey === "KeyF")
		) {
			event.preventDefault();
			setShowReplace(true);
			setFocusField({ field: "replace" });
		} else if (event.altKey && !mod && shortcutKey === "KeyC") {
			event.preventDefault();
			setCaseSensitive((value) => !value);
		} else if (event.altKey && !mod && shortcutKey === "KeyW") {
			event.preventDefault();
			setWholeWord((value) => !value);
		} else if (event.altKey && !mod && shortcutKey === "KeyR") {
			event.preventDefault();
			setRegex((value) => !value);
		} else if (event.altKey && !mod && shortcutKey === "KeyL") {
			event.preventDefault();
			toggleWithin();
		}
	};

	const count = (() => {
		if (result.error)
			return t("lyricMarkup.search.invalid", "Pattern isn't valid");
		if (!query) return "";
		if (!matches.length)
			return replaced
				? t(
						"lyricMarkup.search.replaced",
						"{count, plural, one {Replaced # match} other {Replaced # matches}}",
						{ count: replaced },
					)
				: t("lyricMarkup.search.noMatches", "No matches");
		return current === -1
			? t(
					"lyricMarkup.search.count",
					"{count, plural, one {# match} other {# matches}}",
					{ count: matches.length },
				)
			: t("lyricMarkup.search.position", "{current} of {count}", {
					current: current + 1,
					count: matches.length,
				});
	})();

	const toggle = (
		pressed: boolean,
		onPress: () => void,
		label: string,
		shortcut: string,
		icon: ReactNode,
		disabled = false,
		// The ones inside the find field are smaller so they fit in it.
		size: "1" | "2" = "2",
	) => (
		<IconButton
			size={size}
			variant="ghost"
			color="gray"
			className={styles.toggle}
			data-pressed={pressed || undefined}
			aria-pressed={pressed}
			aria-label={label}
			title={`${label} (${shortcut})`}
			disabled={disabled}
			onClick={onPress}
		>
			{icon}
		</IconButton>
	);

	return (
		<div
			className={styles.panel}
			role="search"
			aria-label={t("lyricMarkup.search.label", "Find and replace")}
			onKeyDown={onKeyDown}
		>
			<div className={styles.grid}>
				<IconButton
					size="2"
					variant="ghost"
					color="gray"
					aria-expanded={showReplace}
					aria-label={t("lyricMarkup.search.toggleReplace", "Show replace")}
					title={`${t("lyricMarkup.search.toggleReplace", "Show replace")} (${IS_MAC ? "Cmd+Alt+F" : "Ctrl+H"})`}
					onClick={() => setShowReplace((value) => !value)}
				>
					{showReplace ? <ChevronDownRegular /> : <ChevronRightRegular />}
				</IconButton>
				<TextField.Root
					ref={findRef}
					size="2"
					className={styles.field}
					value={query}
					placeholder={t("lyricMarkup.search.find", "Find")}
					aria-label={t("lyricMarkup.search.find", "Find")}
					aria-invalid={!!result.error}
					spellCheck={false}
					onChange={(event) => setQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							step(event.shiftKey ? -1 : 1);
						}
					}}
				>
					<TextField.Slot>
						<SearchRegular />
					</TextField.Slot>
					<TextField.Slot gap="1">
						{toggle(
							caseSensitive,
							() => setCaseSensitive((value) => !value),
							t("lyricMarkup.search.matchCase", "Match case"),
							"Alt+C",
							<TextCaseTitleRegular />,
							false,
							"1",
						)}
						{toggle(
							wholeWord,
							() => setWholeWord((value) => !value),
							t("lyricMarkup.search.wholeWord", "Whole word"),
							"Alt+W",
							<TextWholeWordRegular />,
							false,
							"1",
						)}
						{toggle(
							regex,
							() => setRegex((value) => !value),
							t("lyricMarkup.search.regex", "Use a pattern (regex)"),
							"Alt+R",
							<TextAsteriskRegular />,
							false,
							"1",
						)}
					</TextField.Slot>
				</TextField.Root>
				<Flex align="center" gap="2" className={styles.controls}>
					<Text
						size="2"
						className={styles.count}
						data-error={result.error ? true : undefined}
						aria-live="polite"
					>
						{count}
					</Text>
					<IconButton
						size="2"
						variant="ghost"
						color="gray"
						disabled={!matches.length}
						aria-label={t("lyricMarkup.search.previous", "Previous match")}
						title={`${t("lyricMarkup.search.previous", "Previous match")} (Shift+Enter)`}
						onClick={() => step(-1)}
					>
						<ChevronUpRegular />
					</IconButton>
					<IconButton
						size="2"
						variant="ghost"
						color="gray"
						disabled={!matches.length}
						aria-label={t("lyricMarkup.search.next", "Next match")}
						title={`${t("lyricMarkup.search.next", "Next match")} (Enter)`}
						onClick={() => step(1)}
					>
						<ChevronDownRegular />
					</IconButton>
					{toggle(
						!!within,
						toggleWithin,
						t("lyricMarkup.search.inSelection", "Only in the selection"),
						"Alt+L",
						<SelectObjectRegular />,
						!within && state.selection.main.empty,
					)}
					{toggle(
						showList,
						() => setShowList((value) => !value),
						t("lyricMarkup.search.showList", "List every match"),
						"",
						<TextBulletListLtrRegular />,
					)}
					{hasSubRows && (
						<Select.Root
							size="2"
							value={rows}
							onValueChange={(value) => setRows(value as SearchRows)}
						>
							<Select.Trigger
								variant="ghost"
								color="gray"
								aria-label={t("lyricMarkup.search.rows", "Rows to search")}
							/>
							<Select.Content position="popper">
								<Select.Item value="all">
									{t("lyricMarkup.search.rowsAll", "All rows")}
								</Select.Item>
								<Select.Item value="lyrics">
									{t("lyricMarkup.search.rowsLyrics", "Lyrics only")}
								</Select.Item>
								<Select.Item value="translations">
									{t(
										"lyricMarkup.search.rowsTranslations",
										"Translations and romanization",
									)}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					)}
					<IconButton
						size="2"
						variant="ghost"
						color="gray"
						className={styles.close}
						aria-label={t("lyricMarkup.search.close", "Close search")}
						title={`${t("lyricMarkup.search.close", "Close search")} (Esc)`}
						onClick={close}
					>
						<DismissRegular />
					</IconButton>
				</Flex>

				{showReplace && (
					<>
						<span />
						<TextField.Root
							ref={replaceRef}
							size="2"
							className={styles.field}
							value={replacement}
							placeholder={t("lyricMarkup.search.replace", "Replace with")}
							aria-label={t("lyricMarkup.search.replace", "Replace with")}
							spellCheck={false}
							onChange={(event) => setReplacement(event.target.value)}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return;
								event.preventDefault();
								if (IS_MAC ? event.metaKey : event.ctrlKey) replaceAll();
								else replaceOne();
							}}
						>
							<TextField.Slot>
								<ArrowSwapRegular />
							</TextField.Slot>
						</TextField.Root>
						<Flex align="center" gap="2" className={styles.controls}>
							<Button
								size="2"
								variant="soft"
								color="gray"
								disabled={!matches.length}
								title={`${t("lyricMarkup.search.replaceOne", "Replace")} (Enter)`}
								onClick={() => replaceOne()}
							>
								{t("lyricMarkup.search.replaceOne", "Replace")}
							</Button>
							<Button
								size="2"
								variant="soft"
								color="gray"
								disabled={!matches.length}
								title={`${t("lyricMarkup.search.replaceAll", "Replace all")} (${MOD}+Enter)`}
								onClick={replaceAll}
							>
								{t("lyricMarkup.search.replaceAll", "Replace all")}
							</Button>
						</Flex>
					</>
				)}
			</div>

			{showList && query && matches.length > 0 && (
				<MatchList
					state={state}
					matches={matches}
					current={current}
					replacement={showReplace ? replacement : null}
					regex={regex}
					separator={separator}
					onSelect={select}
					onReplace={replaceOne}
				/>
			)}
		</div>
	);
}

/** A line's text for the list, with split marks drawn as dots. */
const shown = (text: string, separator: string) =>
	separator ? text.split(separator).join("·") : text;

function MatchList({
	state,
	matches,
	current,
	replacement,
	regex,
	separator,
	onSelect,
	onReplace,
}: {
	state: EditorState;
	matches: SearchMatch[];
	current: number;
	replacement: string | null;
	regex: boolean;
	separator: string;
	onSelect: (match: SearchMatch) => void;
	onReplace: (match: SearchMatch) => void;
}) {
	const { t } = useTranslation();
	const lines = state.field(markupField);
	// The number the gutter shows; a translation row takes its lyric's.
	const numbers = useMemo(() => {
		const own = numberLines(lines);
		let last = 0;
		return own.map((number) => {
			if (number) last = number;
			return number || last;
		});
	}, [lines]);
	const currentRef = useRef<HTMLLIElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: follows the current match
	useEffect(() => {
		currentRef.current?.scrollIntoView({ block: "nearest" });
	}, [current]);
	const visible = matches.slice(0, LIST_LIMIT);

	return (
		<ul
			className={styles.list}
			aria-label={t("lyricMarkup.search.listLabel", "Matches")}
		>
			{visible.map((match, index) => {
				const line = state.doc.line(match.line + 1);
				const start = match.from - line.from;
				const end = match.to - line.from;
				const before = line.text.slice(Math.max(0, start - CONTEXT), start);
				const after = line.text.slice(end, end + CONTEXT);
				const original = line.text.slice(start, end);
				const next =
					replacement === null
						? null
						: keepMarks(
								original,
								match.text,
								expandReplacement(replacement, match, regex),
								separator,
							);
				return (
					<li
						key={`${match.from}:${match.to}`}
						ref={index === current ? currentRef : undefined}
						className={styles.row}
						data-current={index === current || undefined}
					>
						<button
							type="button"
							className={styles.rowButton}
							onClick={() => onSelect(match)}
						>
							<span className={styles.lineNumber}>
								{numbers[match.line] || ""}
							</span>
							<span className={styles.excerpt}>
								{start > CONTEXT && "..."}
								{shown(before, separator).trimStart()}
								<span className={next === null ? styles.hit : styles.removed}>
									{shown(original, separator)}
								</span>
								{next !== null && next !== "" && (
									<span className={styles.added}>{shown(next, separator)}</span>
								)}
								{shown(after, separator)}
								{end + CONTEXT < line.text.length && "..."}
							</span>
							{match.row === "translation" && (
								<span className={styles.rowKind}>
									{subKindAt(lines[match.line], start) === "romanization"
										? t("lyricMarkup.gutter.romanization", "Romanization")
										: t("lyricMarkup.gutter.translation", "Translation")}
								</span>
							)}
						</button>
						{replacement !== null && (
							<IconButton
								size="2"
								variant="ghost"
								color="gray"
								className={styles.rowReplace}
								aria-label={t(
									"lyricMarkup.search.replaceThis",
									"Replace this match",
								)}
								title={t(
									"lyricMarkup.search.replaceThis",
									"Replace this match",
								)}
								onClick={() => onReplace(match)}
							>
								<ArrowSwapRegular />
							</IconButton>
						)}
					</li>
				);
			})}
			{matches.length > visible.length && (
				<li className={styles.more}>
					<Text size="1" color="gray">
						{t("editAsText.more", "{count, plural, other {and # more}}", {
							count: matches.length - visible.length,
						})}
					</Text>
				</li>
			)}
		</ul>
	);
}
