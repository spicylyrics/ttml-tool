/**
 * Spicy Lyrics glyphs: solid shapes with softened corners and details cut
 * out of them, drawn on a 24px grid in `currentColor`. They follow the style
 * of the Spicy Lyrics role icons.
 */
export interface SlGlyph {
	/** Solid shapes. Each is filled and given a rounded outline. */
	solid: string[];
	/** Lines cut out of the solid shapes. */
	cut?: string[];
	/** Open lines drawn next to the shapes (sound waves). */
	line?: string[];
	/** Shapes drawn fainter, behind the rest. */
	faint?: string[];
}

export const SL_GLYPHS = {
	/** A background vocal: a singer with sound coming off them. */
	background: {
		solid: [
			"M9 3.75a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5Z",
			"M3 19.25c0-3.3 2.7-5.75 6-5.75s6 2.45 6 5.75a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75Z",
		],
		line: ["M17.25 8.75a4 4 0 0 1 0 5.5", "M19.75 6.25a7.5 7.5 0 0 1 0 10.5"],
	},
	/** A duet line: two singers, the second one behind. */
	duet: {
		faint: [
			"M16.25 3.75a2.75 2.75 0 1 1 0 5.5a2.75 2.75 0 0 1 0-5.5Z",
			"M10.75 17c0-2.7 2.45-4.75 5.5-4.75s5.25 2.05 5.25 4.75a.75.75 0 0 1-.75.75h-9.25a.75.75 0 0 1-.75-.75Z",
		],
		solid: [
			"M8.5 4.75a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5Z",
			"M2.5 19.25c0-3.3 2.7-5.75 6-5.75s6 2.45 6 5.75a.75.75 0 0 1-.75.75h-10.5a.75.75 0 0 1-.75-.75Z",
		],
	},
	/** A translation row: a speech bubble with text in it. */
	translation: {
		solid: [
			"M5 4h14a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-6.5l-4.6 3.5a.5.5 0 0 1-.8-.4v-3.1H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
		],
		cut: ["M7.5 8.75h9", "M7.5 12h5.5"],
	},
	/** A romanization row: a letter A. */
	romanization: {
		solid: [
			"M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5Z",
		],
		cut: ["M8.5 16.5 12 7.5l3.5 9", "M9.75 13.25h4.5"],
	},
	/** Swap main and duet: two singers trading sides. */
	swapDuet: {
		solid: ["M7.5 4.5 3.75 8.25 7.5 12Z", "M16.5 12l3.75 3.75L16.5 19.5Z"],
		line: ["M4.5 8.25h14.25", "M19.5 15.75H5.25"],
	},
	/** A section header. The header's own pill says which kind. */
	section: {
		solid: [
			"M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14.6a.6.6 0 0 1-.95.49L12 16.25l-5.55 3.84a.6.6 0 0 1-.95-.49V5A1.5 1.5 0 0 1 7 3.5Z",
		],
	},
	/** A header that won't become a section. */
	sectionRemoved: {
		solid: [
			"M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14.6a.6.6 0 0 1-.95.49L12 16.25l-5.55 3.84a.6.6 0 0 1-.95-.49V5A1.5 1.5 0 0 1 7 3.5Z",
		],
		cut: ["M4.5 4.5l15 15"],
	},
	/** Something on this row won't import as written. */
	warning: {
		solid: [
			"M10.27 4.5a2 2 0 0 1 3.46 0l7.5 13a2 2 0 0 1-1.73 3H4.5a2 2 0 0 1-1.73-3l7.5-13Z",
		],
		cut: ["M12 9.5v3.75", "M12 16.75h.01"],
	},
} satisfies Record<string, SlGlyph>;

export type SlIconName = keyof typeof SL_GLYPHS;

let maskCount = 0;

/** The glyph as SVG markup, for code that builds DOM by hand. */
export function slGlyphMarkup(name: SlIconName): string {
	const glyph: SlGlyph = SL_GLYPHS[name];
	const shape = (d: string) =>
		`<path d="${d}" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
	const solid = glyph.solid.map(shape).join("");
	let body = solid;
	if (glyph.cut?.length) {
		const id = `sl-cut-${++maskCount}`;
		const cuts = glyph.cut
			.map(
				(d) =>
					`<path d="${d}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
			)
			.join("");
		body = `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="#fff"/>${cuts}</mask><g mask="url(#${id})">${solid}</g>`;
	}
	const faint = (glyph.faint ?? [])
		.map(
			(d) =>
				`<path d="${d}" fill="currentColor" fill-opacity=".5" stroke="currentColor" stroke-opacity=".5" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`,
		)
		.join("");
	const lines = (glyph.line ?? [])
		.map(
			(d) =>
				`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
		)
		.join("");
	return `<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">${faint}${body}${lines}</svg>`;
}
