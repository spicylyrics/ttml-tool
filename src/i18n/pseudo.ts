/**
 * Pseudo-locale for layout testing. Every string is accented, padded by about
 * 40% and wrapped in brackets, so overflow and truncation show up without a
 * real long language: "[Šåṽé··]" lost its "]" means the label was clipped.
 *
 * Only literal text changes. Interpolation ({{name}}), ICU arguments and
 * plural/select keywords, "#", numbered tags (<0>) and ICU-quoted text are
 * copied unchanged, so the result formats exactly like en-US.
 */

/** Private-use region tag, so Intl accepts it and nobody ships it. */
export const PSEUDO_LOCALE = "en-XA";

const PADDING_RATIO = 0.4;
const PADDING = "·";

const ACCENTED: Record<string, string> = {
	a: "å",
	b: "ƀ",
	c: "ç",
	d: "ð",
	e: "é",
	f: "ƒ",
	g: "ĝ",
	h: "ĥ",
	i: "î",
	j: "ĵ",
	k: "ķ",
	l: "ļ",
	m: "ɱ",
	n: "ñ",
	o: "ö",
	p: "þ",
	q: "ǫ",
	r: "ŕ",
	s: "š",
	t: "ţ",
	u: "û",
	v: "ṽ",
	w: "ŵ",
	x: "ẋ",
	y: "ý",
	z: "ž",
	A: "Å",
	B: "Ɓ",
	C: "Ç",
	D: "Ð",
	E: "É",
	F: "Ƒ",
	G: "Ĝ",
	H: "Ĥ",
	I: "Î",
	J: "Ĵ",
	K: "Ķ",
	L: "Ļ",
	M: "Ṁ",
	N: "Ñ",
	O: "Ö",
	P: "Þ",
	Q: "Ǫ",
	R: "Ŕ",
	S: "Š",
	T: "Ţ",
	U: "Û",
	V: "Ṽ",
	W: "Ŵ",
	X: "Ẋ",
	Y: "Ý",
	Z: "Ž",
};

const PLURAL_TYPES = new Set(["plural", "selectordinal", "select"]);

const padding = (length: number) =>
	PADDING.repeat(Math.ceil(length * PADDING_RATIO));

function transform(message: string): string {
	let position = 0;

	const skipWhitespace = () => {
		while (position < message.length && /\s/.test(message[position])) {
			position++;
		}
	};
	const identifier = () => {
		const match = /^[\w.-]+/.exec(message.slice(position));
		if (!match) throw new Error(`Expected an identifier at ${position}`);
		position += match[0].length;
		return match[0];
	};
	const expect = (character: string) => {
		skipWhitespace();
		if (message[position] !== character) {
			throw new Error(`Expected ${character} at ${position}`);
		}
		position++;
	};

	// Copies an ICU argument verbatim, recursing into plural/select branches.
	const argument = (): string => {
		const start = position;
		position++; // "{"
		skipWhitespace();
		identifier();
		skipWhitespace();
		if (message[position] === "}") {
			position++;
			return message.slice(start, position);
		}
		expect(",");
		skipWhitespace();
		const type = identifier();
		if (!PLURAL_TYPES.has(type)) {
			// number, date, time: the style has no translatable text.
			const end = message.indexOf("}", position);
			if (end < 0) throw new Error("Unclosed argument");
			position = end + 1;
			return message.slice(start, position);
		}
		expect(",");
		skipWhitespace();
		const offset = /^offset\s*:\s*\d+\s*/.exec(message.slice(position));
		if (offset) position += offset[0].length;
		let out = message.slice(start, position);
		while (position < message.length && message[position] !== "}") {
			const selectorStart = position;
			skipWhitespace();
			const exact = /^=\d+/.exec(message.slice(position));
			if (exact) position += exact[0].length;
			else identifier();
			expect("{");
			out += message.slice(selectorStart, position);
			const branch = text(true);
			out += `${branch.out}${padding(branch.length)}}`;
			const trailingStart = position;
			skipWhitespace();
			out += message.slice(trailingStart, position);
		}
		expect("}");
		return `${out}}`;
	};

	// Literal text until the end of the message, or of a branch when nested.
	const text = (nested: boolean): { out: string; length: number } => {
		let out = "";
		let length = 0;
		while (position < message.length) {
			const rest = message.slice(position);
			const character = message[position];
			if (character === "}") {
				if (!nested) throw new Error("Unexpected closing brace");
				position++;
				return { out, length };
			}
			const tag = /^<\/?[\w-]+\s*\/?>/.exec(rest);
			if (tag) {
				out += tag[0];
				position += tag[0].length;
				continue;
			}
			if (rest.startsWith("{{")) {
				const end = message.indexOf("}}", position + 2);
				if (end < 0) throw new Error("Unclosed interpolation");
				out += message.slice(position, end + 2);
				position = end + 2;
				continue;
			}
			if (character === "{") {
				out += argument();
				continue;
			}
			if (character === "'" && /^'[{}#']/.test(rest)) {
				// ICU quoting: "''" is an apostrophe, "'{...}'" is literal syntax.
				const start = position++;
				if (message[position] === "'") position++;
				else {
					while (position < message.length) {
						if (message[position++] !== "'") continue;
						if (message[position] !== "'") break;
						position++;
					}
				}
				out += message.slice(start, position);
				length += position - start;
				continue;
			}
			out += ACCENTED[character] ?? character;
			length++;
			position++;
		}
		if (nested) throw new Error("Unclosed branch");
		return { out, length };
	};

	const { out, length } = text(false);
	return `[${out}${padding(length)}]`;
}

/** Pseudo-localize one message. Blank strings stay blank. */
export function pseudoLocalize(message: string): string {
	if (!message.trim()) return message;
	try {
		return transform(message);
	} catch {
		// Unparseable text still gets brackets, so it stays visible.
		return `[${message}]`;
	}
}

type Catalog = { [key: string]: string | Catalog };

/** Pseudo-localize every string in a nested catalog, keeping its shape. */
export function pseudoCatalog<T extends Catalog>(catalog: T): T {
	return Object.fromEntries(
		Object.entries(catalog).map(([key, value]) => [
			key,
			typeof value === "string" ? pseudoLocalize(value) : pseudoCatalog(value),
		]),
	) as T;
}
