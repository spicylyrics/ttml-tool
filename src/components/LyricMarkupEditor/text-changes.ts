export interface TextChange {
	from: number;
	to: number;
	insert: string;
}

/** How far ahead to look for the next matching line after a difference. */
const LOOKAHEAD = 4;

/**
 * The edits that turn `before` into `after`, line by line, with untouched
 * lines left out. Keeping them out lets the editor hold its scroll position
 * and cursor, which a single replacement over the whole range would lose.
 * Changes are in `before`'s offsets, sorted and non-overlapping.
 */
export function lineChanges(before: string, after: string): TextChange[] {
	if (before === after) return [];
	const old = before.split("\n");
	const next = after.split("\n");
	const starts: number[] = [];
	for (let index = 0, offset = 0; index < old.length; index++) {
		starts.push(offset);
		offset += old[index].length + 1;
	}
	const lineEnd = (index: number) => starts[index] + old[index].length;
	const changes: TextChange[] = [];

	const replace = (i: number, removed: number, j: number, added: number) => {
		const lines = next.slice(j, j + added);
		if (removed === 1 && added === 1) {
			// One line for one: change only the part that differs.
			const a = old[i];
			const b = lines[0];
			let head = 0;
			while (head < a.length && head < b.length && a[head] === b[head]) head++;
			let tail = 0;
			while (
				tail < a.length - head &&
				tail < b.length - head &&
				a[a.length - 1 - tail] === b[b.length - 1 - tail]
			)
				tail++;
			changes.push({
				from: starts[i] + head,
				to: starts[i] + a.length - tail,
				insert: b.slice(head, b.length - tail),
			});
		} else if (removed > 0 && added > 0) {
			changes.push({
				from: starts[i],
				to: lineEnd(i + removed - 1),
				insert: lines.join("\n"),
			});
		} else if (added > 0) {
			// New lines before old line i, or after the last one.
			changes.push(
				i < old.length
					? { from: starts[i], to: starts[i], insert: `${lines.join("\n")}\n` }
					: {
							from: before.length,
							to: before.length,
							insert: `\n${lines.join("\n")}`,
						},
			);
		} else if (removed > 0) {
			changes.push(
				i + removed < old.length
					? { from: starts[i], to: starts[i + removed], insert: "" }
					: { from: i > 0 ? lineEnd(i - 1) : 0, to: before.length, insert: "" },
			);
		}
	};

	let i = 0;
	let j = 0;
	while (i < old.length || j < next.length) {
		if (i < old.length && j < next.length && old[i] === next[j]) {
			i++;
			j++;
			continue;
		}
		// The nearest point where the two line up again.
		let removed = old.length - i;
		let added = next.length - j;
		search: for (let size = 1; size <= LOOKAHEAD * 2; size++) {
			for (let di = 0; di <= size; di++) {
				const dj = size - di;
				if (di > LOOKAHEAD || dj > LOOKAHEAD) continue;
				const oi = i + di;
				const nj = j + dj;
				if (oi < old.length && nj < next.length && old[oi] === next[nj]) {
					removed = di;
					added = dj;
					break search;
				}
			}
		}
		if (removed > 0 && added > 0) {
			// Share the new lines out over the old ones in order, so every old
			// line start stays a boundary the view can hold on to. A tool that
			// turns each line into two lands one old line on its own two.
			for (let index = 0; index < removed; index++) {
				const first = Math.floor((index * added) / removed);
				const last = Math.floor(((index + 1) * added) / removed);
				replace(i + index, 1, j + first, last - first);
			}
		} else replace(i, removed, j, added);
		i += removed;
		j += added;
	}
	return changes;
}
