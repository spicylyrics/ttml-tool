import { type Atom, useAtomValue } from "jotai";
import { type ReactNode, Suspense, useEffect, useState } from "react";

interface LazyDialogProps<T> {
	/** The atom that opens the dialog. */
	openAtom: Atom<T>;
	/** Reads "open" from object-shaped dialog atoms. Defaults to truthiness. */
	isOpen?: (value: T) => boolean;
	children: ReactNode;
}

/**
 * Renders nothing until the dialog is first opened, so its code is only
 * fetched on demand. Once opened it stays mounted, which keeps the close
 * animation and the dialog's state between opens as they were.
 */
export function LazyDialog<T>({
	openAtom,
	isOpen = Boolean,
	children,
}: LazyDialogProps<T>) {
	const open = isOpen(useAtomValue(openAtom));
	const [opened, setOpened] = useState(open);

	useEffect(() => {
		if (open) setOpened(true);
	}, [open]);

	if (!open && !opened) return null;
	return <Suspense fallback={null}>{children}</Suspense>;
}
