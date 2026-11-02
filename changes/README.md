# Change notes
Add one `changes/<short-slug>.md` per user-visible PR.
Start with these three frontmatter fields between `---` lines:
`type: feature`, `type: change` or `type: fix` (listed under New, Changed and Fixed)
`impact: 1` through `impact: 5` (5 is biggest)
`highlight: true` or `highlight: false` (true puts it in the release's Highlights box)
Use `change` for something that works differently now (a rename, a moved setting, a new default) rather than something new or a bug fixed.

## The format
Every entry becomes one line, the same in the app, on GitHub and on Discord:
`- **Spectrogram follows the playhead.** Toggle it with `Shift+P`, or pick Page or Continuous`
After the closing `---`, write the title on one line, a blank line, then the body:
- Title: the bold lead, sentence case, at most 60 characters, no final period (the period is added for you).
- Body: one short sentence, at most 120 characters, no final period, no line breaks or links.
- Plain words for users. `code` only for keys, **bold** only for something on screen you click.
- No internal names, no "...", ellipsis character or em dashes in place of a sentence.
Compilation rejects notes that break these rules.

## Releasing
`pnpm changelog:compile --version X.Y.Z --summary "Short summary"` (preview with `--dry-run`) sorts features, then changes, then fixes by descending impact, rotates colors and deletes compiled notes; then bump, release commit and tag.
`node scripts/generate-release-notes.mjs --version X.Y.Z` prints the GitHub release notes; add `--discord` for the full Discord announcement.
