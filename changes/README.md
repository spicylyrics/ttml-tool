# Change notes
Add one `changes/<short-slug>.md` per user-visible PR.
Start with these three frontmatter fields between `---` lines:
`type: feature`, `type: change` or `type: fix` (listed under New, Changed and Fixed)
`impact: 1` through `impact: 5` (5 is biggest)
`highlight: true` or `highlight: false` (true marks a headline change)
After the closing `---`, write a short user-facing title on one line.
Optional: a blank line, then one or two sentences using **bold**, `code`, or [links](https://example.com).
Release: `pnpm changelog:compile --version X.Y.Z --summary "Short summary"` (preview with `--dry-run`).
Use `change` for something that works differently now (a rename, a moved setting, a new default) rather than something new or a bug fixed.
Voice: plain words for users, sentence case, specific verbs; the title is the bold lead, the body explains it.
`node scripts/generate-release-notes.mjs --version X.Y.Z --sectioned` prints the shared New / Changed / Fixed release notes.
Compilation sorts features, then changes, then fixes by descending impact, rotates colors, and deletes compiled notes; then bump, release commit, and tag.
