import { TextField } from "@radix-ui/themes";
import {
	type ComponentProps,
	type FC,
	type KeyboardEvent,
	useEffect,
	useState,
} from "react";

/** Turns what was typed into a value inside the bounds, or null if it isn't a number. */
export const parseDraftNumber = (
	draft: string,
	{
		min,
		max,
		integer = false,
	}: { min?: number; max?: number; integer?: boolean } = {},
): number | null => {
	const parsed = Number.parseFloat(draft.trim().replace(",", "."));
	if (!Number.isFinite(parsed)) return null;
	let next = integer ? Math.round(parsed) : parsed;
	if (min !== undefined) next = Math.max(min, next);
	if (max !== undefined) next = Math.min(max, next);
	return next;
};

type DraftNumberFieldProps = Omit<
	ComponentProps<typeof TextField.Root>,
	"value" | "onChange" | "type" | "min" | "max" | "step"
> & {
	value: number;
	onCommit: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	/** Round what's typed to a whole number. */
	integer?: boolean;
};

/**
 * A number field that keeps what you type as text and only commits on blur or
 * Enter. Clearing the box or typing "-" or "0." mid-edit never snaps the value,
 * and a bad entry falls back to the last good one.
 */
export const DraftNumberField: FC<DraftNumberFieldProps> = ({
	value,
	onCommit,
	min,
	max,
	step,
	integer,
	onBlur,
	onKeyDown,
	children,
	...rest
}) => {
	const [draft, setDraft] = useState(String(value));
	useEffect(() => setDraft(String(value)), [value]);

	const commit = () => {
		const next = parseDraftNumber(draft, { min, max, integer });
		if (next === null) {
			setDraft(String(value));
			return;
		}
		setDraft(String(next));
		if (next !== value) onCommit(next);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented) return;
		if (event.key === "Enter") commit();
		if (event.key === "Escape") setDraft(String(value));
	};

	return (
		<TextField.Root
			{...rest}
			type="number"
			inputMode={integer ? "numeric" : "decimal"}
			min={min}
			max={max}
			step={step}
			value={draft}
			onChange={(event) => setDraft(event.currentTarget.value)}
			onBlur={(event) => {
				commit();
				onBlur?.(event);
			}}
			onKeyDown={handleKeyDown}
		>
			{children}
		</TextField.Root>
	);
};
