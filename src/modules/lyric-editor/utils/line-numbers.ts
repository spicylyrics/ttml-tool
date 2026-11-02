/** The line numbers the editor shows: a background line shares its main line's. */
export const getLineDisplayNumbers = (lines: readonly { isBG: boolean }[]) => {
	let currentNumber = 0;
	return lines.map((line, index) => {
		if (index === 0 || !line.isBG) currentNumber++;
		return currentNumber;
	});
};
