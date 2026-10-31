# AGENTS.md

Instructions for coding agents working on the Spicy Lyrics TTML Tool. Read this before changing anything, and the design sections before changing any UI.

## Project

- Frontend: React, Vite, TypeScript, Radix UI, and CSS Modules.
- State: Jotai atoms. Keep module-local state in `src/modules/<feature>` and shared state in `src/states`.
- Desktop: Tauri/Rust in `src-tauri`.
- Locales: i18next with catalogs in `src/i18n/locales`. `pnpm test:locales` checks that every catalog has the same keys.
- Package manager: **pnpm** only (`pnpm install`, `pnpm dev`, `pnpm run build`). Don't use npm, Yarn or bun here, and don't hand-edit `pnpm-lock.yaml`.

## Working rules

- Branches: `main` is production, `dev` is staging. Do not commit or push directly to either.
- Start each feature or fix on its own working branch cut from the latest `dev` (e.g. `feat/<slug>`, `fix/<slug>`). Commit and push to that branch freely; open a PR into `dev` when the user asks. Target or retarget PRs to `dev` unless the user explicitly requests another branch.
- Merge `dev` into `main` only when the user explicitly requests it.
- Hotfix releases are cut on a `release/vX.Y.Z` branch from `main`, merged into `main` and tagged, then `main` is merged back into `dev`. Delete the release branch afterwards.
- When reviewing PRs, fix actionable issues directly when repository permissions allow instead of asking the contributor to make the changes. Prefer updating the PR branch; if maintainer edits are disabled, apply the fix through a maintainer-owned branch, while preserving contributor attribution and avoiding unrelated changes.
- Keep changes focused. Preserve unrelated work already present in the worktree.
- Follow existing module and test conventions. Add or update focused Vitest coverage for non-trivial logic changes.
- Before you're done: `pnpm exec biome check <changed files>`, `pnpm exec tsc -b`, `pnpm test`, `pnpm test:locales`, and `pnpm run build` for UI, dependency, configuration, Tauri, or other build-impacting changes. Do not run broad formatters that rewrite unrelated files.
- New strings go through i18next and into **every** locale in `src/i18n/locales/`, in the same key order as `en-US`. Treat existing hardcoded UI strings as legacy.
- Review licenses when copying external code, data, dictionaries, or dependencies, and add the attribution the license requires. Beyond that, don't credit or name outside projects or references in code, comments or docs. This is a public repo.

## Release documentation

- Add a `changes/<short-slug>.md` note for every user-visible feature or fix. See `changes/README.md` for frontmatter (`type`, `impact` 1-5, `highlight`) and the entry format.
- Every entry is one line everywhere (app, GitHub, Discord): a bold title of at most 60 characters and one body sentence of at most 120, neither with a final period. `changelog:compile` rejects notes that break it, and a test checks the compiled data.
- Set `highlight: true` for headline changes; they go in the release's Highlights box in **Preferences › Changelog**. Highlights describe what is new for our users, including fixes and refinements.
- `node scripts/generate-release-notes.mjs --version X.Y.Z --discord` prints the release's Discord announcement.
- Never edit `src/data/changelog.json` by hand except to fix typos. The changelog dialog and GitHub release notes render from compiled data; `changelog-legacy.json` preserves the migrated historical list.
- Release order: `pnpm contributors:update` (refreshes the About tab contributor list from GitHub), `pnpm changelog:compile --version X.Y.Z --summary "Short summary"` (1-5 words), `pnpm version:bump <patch|minor|major>`, a `release: vX.Y.Z` commit, then tag `vX.Y.Z`. Preview compilation with `--dry-run`; it validates and sorts features then fixes by descending impact, rotates Radix colors, and deletes compiled notes. Version bumping does not compile notes automatically.
- Treat requests to update or correct release documentation as edit-only. Do not commit it unless the user explicitly asks to commit.
- Keep the README feature list accurate for this hard fork; it does not need to track upstream differences.
- PRs touching `src/` or `src-tauri/` must add a change note, or carry the `no-changelog` label when no user-visible behavior changes.
- Change `src-tauri/tauri.conf.json`, `package.json` and `src-tauri/Cargo.toml` only when the user explicitly requests a release/version bump. Bump with `pnpm version:bump <patch|minor|major>` (`scripts/bump-version.mjs`), which keeps all three files and `Cargo.lock` in sync. CI validates that a pushed `vX.Y.Z` tag matches these files before building a release.

## Commits

- Do not commit unless requested.
- Stage only files belonging to the requested work.
- Use a conventional, descriptive subject and a body that explains the user-visible behavior and validation performed.

## The Spicy Lyrics design

The app has two looks, switched by the `spicyLyricsDesign` setting (Preferences → Appearance, on by default):

- **On:** `App.tsx` sets `data-design="spicy-lyrics"` on `<html>`, and `src/styles/spicy-lyrics-design.css` remaps Radix Themes and the app's own CSS variables to the Spicy Lyrics palette.
- **Off:** none of that CSS matches and the classic theme runs untouched.

Both looks must keep working. Never style only one.

### How to style new UI

1. **Use tokens, never hex.** Build with Radix components and variables (`--gray-*`, `--accent-*`, `--color-panel-solid`, `--editor-*`). The design remaps those, so new UI gets both looks for free.
2. **Design-only styling goes under the scope.** Write it as `:root[data-design="spicy-lyrics"] ...` in `spicy-lyrics-design.css`. In a CSS module, use `:global(:root[data-design="spicy-lyrics"]) .yourClass`.
3. **Mind the specificity map** at the top of `spicy-lyrics-design.css`. The user's Advanced color overrides must keep winning over the design.
4. **Reusable pieces:** `src/components/BrandBand` has the logo glyph (`BrandMark`) and the lavender band (`brandBandClassName` + `BrandBandMark`). `src/components/OptionPicker` chooses between named modes.

### Palette

| Token | Value | Use |
|---|---|---|
| `--sl-background` | `oklch(0.155 0.008 292)` | canvas, editor |
| `--sl-sunken` | `oklch(0.178 0.008 292)` | wells, tracks |
| `--sl-chrome` | `oklch(0.185 0.009 292)` | title bar, ribbon, audio bar |
| `--sl-card` | `oklch(0.205 0.009 292)` | lyric lines, cards, inputs |
| `--sl-popover` | `oklch(0.215 0.01 292)` | dialogs, menus, toasts |
| `--sl-foreground` / `--sl-muted` | L 0.965 / L 0.70 | body ink / secondary ink |
| `--sl-primary` | `oklch(0.955 0.004 292)` | the one loud fill (solid buttons, checked controls) |
| `--sl-border` | white 12% | every hairline |
| accent | `#b19eef` lavender | markers, tints, links, focus ring |

- Depth comes from lightness steps, not hue.
- Shadows are true black.
- Never use `rgba(255,255,255,x)` or `rgba(0,0,0,x)` as a surface. Use a token.
- Don't darken `--sl-muted`; L 0.70 is the AA floor on the canvas.
- Errors and destructive actions stay red, tinted rather than filled. Lavender is never used for errors.

### Radius

The design remaps Radix's `--radius-1..6` to the extension's settings panel scale. Use the variables, never a px radius:

| Variable | Value | Use |
|---|---|---|
| `--radius-2` | 8px | buttons, inputs, selects, tabs, segmented controls |
| `--radius-4` | 12px | cards, rows, popovers |
| `--radius-5` | 16px | dialogs, standalone panels |
| `--sl-radius-pill` | pill | icon-only buttons, badges, counts |

- Every value is multiplied by `--radius-factor`, which the user's Global radius setting controls. A custom radius must do the same, so 0 still means square.
- Switches and slider thumbs stay fully round.
- No side stripes on rounded items (they bend around the corner); mark selection with a fill.

### Type

- **Font:** Geist (bundled with `@fontsource-variable/geist`, so it works offline). The stack falls back to MiSans and system CJK fonts, because Geist has no Japanese, Chinese or Korean glyphs. Keep that fallback.
- **Hierarchy** comes from weight, size and leading together. Tracking tightens as size grows: headings at -0.014em, large headings at -0.028em, body text left alone.
- **Case:** sentence case everywhere. No uppercase, wide-tracked labels.
- **Preview font:** previews read `--preview-font-family` (the user's font), never the UI font. The Spicy, Standard and Toxi previews must look the same with the design on or off.

## Rules where guidelines conflict (pick these, don't re-decide)

1. **Dark only.** The design is always dark, whatever the OS theme. Users who want light mode turn the design off.
2. **Icons:** Fluent UI (`@fluentui/react-icons`). Don't add another icon set.
3. **Glass:**
   - Dialogs, menus, popovers and toasts are **solid** `--sl-popover`, with no `backdrop-filter`.
   - Translucency is allowed only when the user has picked a custom background (`data-design-backdrop`).
   - Never put blur on lyric lines or anything in the sync loop.
4. **Accent:** lavender marks things (playhead, selection, links, focus). Solid buttons, checkboxes and switches use the near-white primary, so lavender doesn't cover every control. A user's custom accent overrides all of this.
5. **Brand band** (lavender field + cropped logo glyph): only on rare screens (first-run dialog). Never on the editor, ribbons or settings rows.
6. **Logo:** the app logo is `public/logo.svg`. In UI, use its glyph without the tile (`BrandMark`), tinted with a token.
7. **Copy:**
   - Plain "...", never the ellipsis character.
   - No em dashes.
   - Use specific verbs, no marketing words.
   - Every line in every locale.
8. **Desktop first.** Check 1024 to 1440px widths and the settings modal for overflow. Don't build phone layouts.

## Motion

Decide by how often people see it:

- **Never animate the sync surface or keyboard actions:**
  - word chips, line selection and Time-mode highlights
  - spectrogram, playhead
  - anything a shortcut triggers
  Visual changes there must not move layout (no padding, size or border-width changes) or slow it down. Test with a long song.
- **Press feedback:** `scale(0.97)` over 150ms, pointer presses only (`:not(:focus-visible)`). Already global for Radix buttons.
- **Occasional surfaces** (dialogs, panels, toasts): opacity plus a short rise or scale from 0.95 or above. Never from `scale(0)`. Keep under 300ms.
- **Easing:**
  - `cubic-bezier(0.23, 1, 0.32, 1)` for UI
  - linear only for constant motion
  - never `ease-in`
- **Transitions:** always name the properties (`transition: transform 150ms ...`), never `transition: all`. Animate `transform` and `opacity` only.
- **Delight** (the band glyph settling, a cross-fade when the design toggles) belongs only to rare moments.

Anything you add must also handle:

- `prefers-reduced-motion`: remove movement and keep opacity. An animation that ends invisible must be hidden, not frozen.
- `prefers-reduced-transparency`: make translucent surfaces solid.
- `prefers-contrast: more`: stronger borders and brighter muted ink.

## Accessibility

- Text meets WCAG AA: 4.5:1, or 3:1 for 18px and up. UI boundaries and focus indicators meet 3:1.
- Measure contrast; don't eyeball it. The current pairs are 6.5:1 or better.
- Focus uses the solid `--sl-ring` (lavender, about 7:1 on the canvas). Never remove an outline without replacing it.
- Every control works by keyboard, dialogs close with Escape, and icon-only buttons have an accessible label.
- Status is never color alone; pair it with text or an icon.

## Don'ts

- Don't patch CSS or source with scripts. Write the change in the file.
- Don't hand-edit `pnpm-lock.yaml`. Don't run a formatter over files you didn't change.
- Don't edit `src/data/changelog.json` by hand (typo fixes aside); use `changes/` notes.
