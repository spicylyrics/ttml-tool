const GUIDES = "https://guides.spicylyrics.org/doc/";

const RULES_PAGE = `${GUIDES}uploading-and-ttml-rules-rvofBBi0PV`;
const CHECK_LYRICS = `${GUIDES}3-check-the-lyrics-ZHDMonddCz`;
const SONGWRITERS = `${GUIDES}5-add-the-songwriters-cP7OWZhyKd`;
const SPELLING = `${GUIDES}spelling-standards-1FRSAijBfI`;
const CAPITALIZATION = `${GUIDES}capitalization-hMwxrH5gfY`;
const PUNCTUATION = `${GUIDES}grammar-punctuation-QUEKxpgqyK`;
const CENSORED = `${GUIDES}censored-and-cut-lyrics-R9wey7a9IN`;
const REPEATS = `${GUIDES}repeats-sections-line-breaks-t27FWwMpAi`;
const ROMANIZATION = `${GUIDES}languages-scripts-romanization-5A2ng3QrHc`;
const SPLITTING = `${GUIDES}splitting-guidelines-IyXtGi4ta6`;

const LINKS: Record<string, string> = {
	"no-lyrics": RULES_PAGE,
	"empty-line": RULES_PAGE,
	"mixed-timing": RULES_PAGE,
	"text-outside-spans": RULES_PAGE,
	"background-untimed": RULES_PAGE,
	"untimed-line": RULES_PAGE,
	"untimed-syllable": RULES_PAGE,
	"zero-length": RULES_PAGE,
	"syllable-overlap": RULES_PAGE,
	"line-starts-late": RULES_PAGE,
	"line-ends-early": RULES_PAGE,
	"lines-out-of-order": RULES_PAGE,
	"duplicate-line": RULES_PAGE,
	"copied-text": RULES_PAGE,
	"adlib-in-lead": RULES_PAGE,
	"stretched-spelling": RULES_PAGE,
	"file-too-large": RULES_PAGE,
	"word-gap": RULES_PAGE,
	"spoken-number": SPELLING,
	"decorative-symbol": SPELLING,
	"starts-with-background": CHECK_LYRICS,
	"background-only-line": CHECK_LYRICS,
	"stacked-backgrounds": CHECK_LYRICS,
	"songwriters-missing": SONGWRITERS,
	"songwriter-empty": SONGWRITERS,
	"songwriter-several-names": SONGWRITERS,
	"songwriter-duplicate": SONGWRITERS,
	spelling: SPELLING,
	"guide-spelling": SPELLING,
	"curly-quote": SPELLING,
	"lowercase-start": CAPITALIZATION,
	"lowercase-i": CAPITALIZATION,
	"case-lower": CAPITALIZATION,
	"case-upper": CAPITALIZATION,
	"case-title": CAPITALIZATION,
	ellipsis: PUNCTUATION,
	"stacked-punctuation": PUNCTUATION,
	"trailing-period": PUNCTUATION,
	"dash-punctuation": PUNCTUATION,
	"fake-dash": PUNCTUATION,
	slash: PUNCTUATION,
	"unbalanced-brackets": PUNCTUATION,
	"censor-format": CENSORED,
	"section-label": REPEATS,
	"bracketed-note": REPEATS,
	"repeat-shorthand": REPEATS,
	"phrase-hyphen": REPEATS,
	"long-line": REPEATS,
	"stutter-unhyphenated": REPEATS,
	"romanization-orphan": ROMANIZATION,
	"romanization-empty": ROMANIZATION,
	"hyphen-wrong-side": SPLITTING,
	"hyphen-gap": SPLITTING,
	"hyphen-line-end": SPLITTING,
	"split-no-vowel": SPLITTING,
	"split-inconsistent": SPLITTING,
	"gap-inside-word": SPLITTING,
};

/** The guide page a rule enforces, when one covers it. */
export function guideLinkFor(rule: string): string | undefined {
	return LINKS[rule];
}
