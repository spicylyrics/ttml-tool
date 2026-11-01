/** Lowercases and drops accents, so "edicion" finds "Edición". */
export function foldSearchText(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

/** Escapes regex syntax so the text matches literally. */
export function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
