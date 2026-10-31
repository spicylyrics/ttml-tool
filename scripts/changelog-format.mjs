// The one changelog line shared by the app, GitHub releases and Discord:
// "- **Title.** Body", where the stored title and body carry no final
// punctuation and the renderers add the period after the title.

export const TITLE_MAX = 60;
export const BODY_MAX = 120;

const FINAL_PUNCTUATION = /[.!?:;,]$/;

/** Problems with one entry's wording; empty when it fits the format. */
export function entryProblems({ title, body }) {
	const problems = [];
	if (!title?.trim()) return ["a title is required"];
	if (title.length > TITLE_MAX)
		problems.push(`title is over ${TITLE_MAX} characters`);
	if (FINAL_PUNCTUATION.test(title))
		problems.push("title ends with punctuation");
	if (/^[a-z]/.test(title)) problems.push("title starts lowercase");
	// Renderers bold the title themselves, so markup here doubles up.
	if (/[*`]/.test(title)) problems.push("title has markdown");
	if (!body?.trim()) problems.push("a one-sentence body is required");
	else {
		if (body.length > BODY_MAX)
			problems.push(`body is over ${BODY_MAX} characters`);
		if (FINAL_PUNCTUATION.test(body))
			problems.push("body ends with punctuation");
		if (/\n/.test(body)) problems.push("body has a line break");
		if (/[.!?] [A-Z]/.test(body.replace(/`[^`]*`/g, "")))
			problems.push("body is more than one sentence");
		if (/\]\(/.test(body)) problems.push("body has a link");
	}
	if (/[…—]/.test(`${title}${body ?? ""}`))
		problems.push(
			'use "..." and commas, not the ellipsis character or em dash',
		);
	return problems;
}
