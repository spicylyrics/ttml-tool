/** Windows-safe new names. Existing paths must never be passed through this. */
export function sanitizeFileName(name: string, maxLength = 240): string {
	let cleaned = Array.from(name, (char) => {
		const code = char.codePointAt(0) ?? 0;
		return code < 32 || code === 127 || /[\\/:*?"<>|]/.test(char) ? "_" : char;
	})
		.join("")
		.replace(/\s+/g, " ")
		.replace(/\.{2,}/g, ".");
	cleaned = trimDotsAndSpaces(cleaned);
	if (
		cleaned.toLowerCase() === "project.json" ||
		/^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])\s*(\..*)?$/i.test(
			cleaned,
		)
	) {
		cleaned = `_${cleaned}`;
	}
	// Keep an existing short extension when truncating. Metadata/folder stems
	// use 120; complete file names use 240, leaving Windows room for suffixes.
	const extension = cleaned.match(/\.[\p{L}\p{N}]{1,10}$/u)?.[0] ?? "";
	const suffix = cleaned.length > maxLength ? extension : "";
	const stem = suffix ? cleaned.slice(0, -suffix.length) : cleaned;
	let shortened = "";
	for (const char of stem) {
		if (shortened.length + char.length > maxLength - suffix.length) break;
		shortened += char;
	}
	return `${trimDotsAndSpaces(shortened)}${suffix}` || "Untitled";
}

// Index scans instead of /[.\s]+$/, which backtracks quadratically on long
// dot/space runs from untrusted metadata.
function trimDotsAndSpaces(value: string): string {
	const isTrimmed = (char: string) => char === "." || /\s/.test(char);
	let start = 0;
	let end = value.length;
	while (start < end && isTrimmed(value[start])) start++;
	while (end > start && isTrimmed(value[end - 1])) end--;
	return value.slice(start, end);
}
