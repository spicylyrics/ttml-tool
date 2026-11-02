import { Dismiss12Regular } from "@fluentui/react-icons";
import { Button, Text } from "@radix-ui/themes";
import classNames from "classnames";
import { type FC, type KeyboardEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

/** What reads as "several names in one": commas, semicolons, ampersands. */
const LIST_SEPARATORS = /\s*[,;&，；、]\s*/;
/** Dropped text is split more eagerly, as the old list editor did. */
const DROP_SEPARATORS = /[\n,;/，；、|\\]/;

export function splitNames(text: string, separators = LIST_SEPARATORS) {
	return text
		.split(separators)
		.map((part) => part.trim())
		.filter(Boolean);
}

const sameName = (a: string, b: string) =>
	a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Appends names that aren't in the list yet. */
function withNames(values: string[], names: string[]) {
	const next = [...values];
	for (const name of names) {
		if (!next.some((value) => sameName(value, name))) next.push(name);
	}
	return next;
}

export interface NameListInputProps {
	values: string[];
	onChange: (values: string[]) => void;
	/** Put on the text box so a FieldRow label points at it. */
	id?: string;
	"aria-describedby"?: string;
	placeholder?: string;
}

/**
 * A list of names as removable tags plus a text box. Enter adds the typed
 * name, Backspace in an empty box takes the last tag back for editing, and a
 * double-click edits a tag in place. Names that look like several in one
 * ("A, B & C") get a button to split them, since some real names contain a
 * comma or an ampersand.
 */
export const NameListInput: FC<NameListInputProps> = ({
	values,
	onChange,
	id,
	"aria-describedby": describedBy,
	placeholder,
}) => {
	const { t } = useTranslation();
	const [draft, setDraft] = useState("");
	const [editing, setEditing] = useState<{ index: number; text: string }>();
	const [dropping, setDropping] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const names = values.filter((value) => value.trim());

	const commitDraft = () => {
		const name = draft.trim();
		if (name) onChange(withNames(names, [name]));
		setDraft("");
	};

	const onDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			commitDraft();
		} else if (
			event.key === "Backspace" &&
			draft === "" &&
			names.length > 0 &&
			!event.repeat
		) {
			event.preventDefault();
			setDraft(names[names.length - 1]);
			onChange(names.slice(0, -1));
		}
	};

	const commitEdit = () => {
		if (!editing) return;
		const next = [...names];
		const name = editing.text.trim();
		if (name) next[editing.index] = name;
		else next.splice(editing.index, 1);
		onChange(next);
		setEditing(undefined);
	};

	const remove = (index: number) => {
		onChange(names.filter((_, i) => i !== index));
		inputRef.current?.focus();
	};

	// The first entry (typed or saved) that looks like several names.
	const splittable =
		splitNames(draft).length > 1
			? { index: -1, parts: splitNames(draft) }
			: names
					.map((name, index) => ({ index, parts: splitNames(name) }))
					.find(({ parts }) => parts.length > 1);

	const split = () => {
		if (!splittable) return;
		if (splittable.index === -1) {
			onChange(withNames(names, splittable.parts));
			setDraft("");
			return;
		}
		const before = names.slice(0, splittable.index);
		const after = names.slice(splittable.index + 1);
		onChange(withNames(before, [...splittable.parts, ...after]));
	};

	return (
		<div className={styles.root}>
			{/* Clicking the frame focuses the text box, which stays the keyboard target. */}
			<div
				className={classNames(styles.field, dropping && styles.dropping)}
				onClick={(event) => {
					if (event.target === event.currentTarget) inputRef.current?.focus();
				}}
				onDragOver={(event) => {
					event.preventDefault();
					setDropping(true);
				}}
				onDragLeave={(event) => {
					if (!event.currentTarget.contains(event.relatedTarget as Node))
						setDropping(false);
				}}
				onDrop={(event) => {
					event.preventDefault();
					setDropping(false);
					const parts = splitNames(
						event.dataTransfer.getData("text"),
						DROP_SEPARATORS,
					);
					if (parts.length) onChange(withNames(names, parts));
				}}
			>
				{names.map((name, index) =>
					editing?.index === index ? (
						<input
							// biome-ignore lint/suspicious/noArrayIndexKey: names are unique, but an edit can make two equal for a moment
							key={`edit-${index}`}
							className={styles.chipEditor}
							value={editing.text}
							size={Math.max(editing.text.length, 4)}
							aria-label={t("nameList.editName", "Edit {name}", { name })}
							autoFocus
							onChange={(event) =>
								setEditing({ index, text: event.currentTarget.value })
							}
							onBlur={commitEdit}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									commitEdit();
									inputRef.current?.focus();
								} else if (event.key === "Escape") {
									event.preventDefault();
									event.stopPropagation();
									setEditing(undefined);
									inputRef.current?.focus();
								}
							}}
						/>
					) : (
						// A loaded file can repeat a name, so the index is part of the key.
						<span key={`${index}-${name}`} className={styles.chip}>
							{/* Double-click is a shortcut; Backspace in the box edits by keyboard. */}
							<span
								className={styles.chipText}
								onDoubleClick={() => setEditing({ index, text: name })}
							>
								{name}
							</span>
							<button
								type="button"
								className={styles.remove}
								aria-label={t("nameList.removeName", "Remove {name}", {
									name,
								})}
								// Keep focus in the box, so a half-typed name isn't
								// committed and then overwritten by this removal.
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => remove(index)}
							>
								<Dismiss12Regular />
							</button>
						</span>
					),
				)}
				<input
					ref={inputRef}
					id={id}
					aria-describedby={describedBy}
					className={styles.input}
					value={draft}
					placeholder={names.length === 0 ? placeholder : undefined}
					onChange={(event) => setDraft(event.currentTarget.value)}
					onKeyDown={onDraftKeyDown}
					onBlur={commitDraft}
				/>
			</div>
			{splittable && (
				<div className={styles.splitHint}>
					<Text size="1" color="gray">
						{t(
							"nameList.looksLikeSeveral",
							"{count, plural, other {This looks like # names in one.}}",
							{ count: splittable.parts.length },
						)}
					</Text>
					<Button
						size="1"
						variant="ghost"
						onMouseDown={(event) => event.preventDefault()}
						onClick={split}
					>
						{t(
							"nameList.split",
							"{count, plural, other {Split into # names}}",
							{ count: splittable.parts.length },
						)}
					</Button>
				</div>
			)}
		</div>
	);
};
