# Dead code plan

Inventory of dead and leftover code on `dev` (at `59ea2b67`, 2026-11-01), and a staged plan to remove it. Nothing has been removed yet.

How it was found: `pnpm dlx knip@5` (no config, nothing committed), then every hit checked by hand with grep and git history. Also: grep for flags pinned on or off, "legacy" / "removed" / "deprecated" comments, settings atoms with no reader or writer, Tauri commands without an `invoke()` caller, en-US keys never referenced in code, Chinese text outside the locale catalogs, and helpers written more than once. Raw outputs are in the shared session notes (`dead-code-data/`).

Risk labels: **safe** (no callers, build and tests prove it), **check** (looks dead, one thing to confirm first), **product** (removing it changes what users see, so TX24 decides).

PRs #179 (sections) and #182 (Line timing) are still open and touch about 120 files, including every locale catalog and `src/modules/settings/states/*`. Items in those files are marked **after #179/#182** and wait for both to land.

## Batch 1: dead files, dependencies and symbols

Safe. Nothing a user can see changes. One PR.

### Files

| Path | Why it's dead | Risk |
|---|---|---|
| `src/modules/audio/worklet/text-decoder.ts` | TextDecoder polyfill for the AudioWorklet. Its only import was removed in `25c6bf2c`, when SoundTouch moved to `pcm-render.worker.ts` (workers have TextDecoder). | safe |
| `src/modules/project/folder-project/index.ts` | Barrel file. Every caller imports the submodules directly; no import of `folder-project` itself. | safe |

### Dependencies (`package.json`)

| Package | Why | Risk |
|---|---|---|
| `@applemusic-like-lyrics/react` | Never imported. The AMLL preview uses `@applemusic-like-lyrics/core` directly. | safe |
| `@radix-ui/react-dialog` | Never imported; dialogs use Radix Themes. | safe |
| `@tauri-apps/plugin-log` | JS binding never imported. **Keep** the Rust `tauri-plugin-log` crate: `src-tauri/src/lib.rs` initializes it. | safe |
| `pako`, `@types/pako` | Never imported (the only grep hits are Czech/Slovak words in locales). | safe |
| `bezier-easing`, `deep-freeze`, `gl-matrix`, `@ungap/structured-clone`, `@types/ungap__structured-clone` | Not imported by us. They are `@applemusic-like-lyrics/core`'s own dependencies, which pnpm installs for it anyway. They only mattered for the local-AMLL alias below. | safe, with the alias |
| `jotai-optics` | Never imported. | safe |
| `@types/emscripten` (dev) | Only appears in comments of the generated `decode-audio.js`. | safe |
| `babel-plugin-react-compiler` (dev) | Not in the Vite babel config (only the Jotai preset is). | safe |

Also remove from `vite.config.ts`: the `AMLL_LOCAL_PATH` / `AMLL_LOCAL_EXISTS` block and its four `resolve.alias` entries. It is an upstream dev hook that switches to an unzipped AMLL checkout at `./applemusic-like-lyrics-main/...` inside the repo; it maps `/react` (removed above) and `/ttml` (not even a dependency). Safe.

### Symbols with no caller anywhere

| Path | Symbol | Note |
|---|---|---|
| `src/modules/settings/states/index.ts` | `generateNameFromMetadataAtom` | Setting whose UI went in `cb5d4b57` ("cut unused and deprecated features"). Nothing reads it. **after #179/#182** (file is in both). |
| `src/modules/settings/backup/preview.ts` | `previewExportBackup` | Wrapper superseded by `loadExportParts` + `summarizeExportParts`. |
| `src/modules/playback-clock/index.ts` | `usePlaybackTime` | Unused hook. Also update `src/modules/playback-clock/README.md`, which mentions it. |
| `src/modules/lyric-editor/utils/lyric-states.ts` | `useCurrentLocation` | Unused hook. |
| `src/states/main.ts` | `allLyricsWordsAtom` | Unused derived atom. |
| `src/utils/keybindings.ts` | `isInteracting` | Unused. |
| `src/modules/discord-presence/presence.ts` | `DISCORD_LOGO_URL`, `REPOSITORY_URL` | Unused constants. |
| `src/modules/segmentation/utils/charUtils.ts` | `ALL_PUNCTUATION` | Unused set. |
| `src/modules/settings/logic/effects-mode.ts` | `EFFECTS_MODES` | Unused list. |
| `src/modules/spectrogram/utils/line-end-handles.ts` | `LINE_END_BASE_HIT_PX` | Unused. The comment on `LINE_END_WIDE_HIT_PX` ("while the flag is on") points at a flag that no longer exists; fix it too. |
| `src/states/main.ts` | `isDarkThemeAtom = autoDarkModeAtom` | Two names for one atom. Keep one. |
| `src/utils/keybindings.ts` | `@deprecated 请使用 useCommand` on `useKeyBindingAtom` | Not dead: 10 callers. Drop the wrong `@deprecated` tag (or leave the migration to `useCommand` for a separate task). |

Not dead, even though knip lists them:

- `src/utils/url-shim.ts`: wired in through the `url` alias in `vite.config.ts`.
- `src/types/vite-env.d.ts`, `src/types/syllabification.d.ts`, `src/modules/audio/worklet/vendor/soundtouch.d.ts`, the four `src/modules/spectrogram/vendor/**/wasm_spectrogram*.d.ts`: ambient types that tsc picks up through `tsconfig`. `syllabification.d.ts` types `compromise/tokenize` and `compromise-speech`, both imported.
- `scripts/verify-pcm-playback.mjs`: a manual audio check, run by hand against a dev server. Keep.
- `public/sw.js`: the self-destroying service worker. See batch 4.

Left out on purpose: about 45 exports that are only used inside their own file, 62 exported types with the same pattern, and 16 components exported both by name and as `default`. Dropping the `export` keyword is churn with no payoff unless knip runs in CI. Skip them.

## Batch 2: Chinese comments and fallback strings

Safe. Nothing a user can see changes. Split by module so each PR stays reviewable.

- **Comments:** 94 files have Chinese text beyond the license header (about 340 lines; the most in `project/autosave/autosave.ts`, `segmentation/*`, `project/modals/*`, `states/main.ts`, `RibbonBar/edit-mode.tsx`). Translate them where they still describe the code, delete them where the code was rewritten and they no longer match.
- **`t()` fallbacks:** 112 `t("key", "中文")` calls in 32 files. Every one of those keys exists in en-US, so the Chinese never shows. Replace each fallback with the en-US text.
- **Keep** the bilingual GPL header in 58 files ("本源代码文件是属于 AMLL TTML Tool 项目的一部分 ..."). It is the upstream license notice.
- 25 of the 129 files are in #179/#182: **after #179/#182**.

Suggested split: (a) `segmentation`, (b) `project` (autosave, modals, logic), (c) `lyric-editor` + `spectrogram`, (d) the rest (`components`, `states`, `utils`, `keyboard`, `lrclib`, `settings`).

## Batch 3: unused locale keys

Safe. Nothing a user can see changes. **After #179/#182**: both PRs edit all 16 catalogs and `regional/es-MX.json`, so this would only make conflicts.

21 en-US keys have no reference in code (checked against template-literal prefixes and plural suffixes):

- `ribbonBar.syncMode.showTimestampUpdate`, `.quickFixes`, `.manualTimestampEdit`, `.manageQuickFixExclusions.{title,description,placeholder}`
- `spectrogram.fftSizeOption.{512,1024,2048,4096}`
- `settings.backup.hint.assetsSet`, `settings.backup.previewToggle`, `settings.backup.previewEmpty`
- `lyricWordView.removeWord`, `.editingWordTitle`, `.editingWordDesc`, `.correctedWordPlaceholder`, `.noSuggestions`
- `changeNotes.changelogTitle`, `commandPalette.commandTag` (orphaned by #242)
- `experimentalFeatures.geniusCategorization.title`: #179 removes this whole block already.

Rerun the key check after both PRs land; they remove and add keys of their own. Remove from every catalog in one go, then `pnpm test:locales`.

## Batch 4: product questions and timed removals

These change what users see or what old installs keep, so TX24 decides.

1. **Tips ("Did you know").** `src/modules/did-you-know` is finished: hints, detectors, a "Show tips" setting, tests and strings. `TIPS_RELEASED = false` in `states.ts` hides all of it until there are more than a couple of tips. Question: *Tips are built but hidden until there are more of them. Keep waiting, or drop the feature?* Removing it changes nothing visible today; it deletes the module, its setting and its strings.
2. **One-time migrations for old installs.** Each moves an old setting or saved data into the current format the first time a user opens a newer version. None is dead while someone might still update from an old version.
   - `src/modules/keyboard/states.ts`: `migrateDoublePressSetting` (old Auto segment double-press switch)
   - `src/modules/settings/modals/customBackground/storage.tsx`: `readLegacyCustomBackground` (background image in localStorage)
   - `src/modules/project/autosave/autosave.ts`: import of the old snapshot store into "Legacy Snapshots Archive" (from upstream)
   - `src/modules/project/logic/normalize-document.ts`: strips the old `ruby` field from words
   - `src/modules/settings/states/sync.ts` + `migrated-storage.ts`: the `legacyKey` copies (`syncAutoScroll`, `editActiveLineHighlight`, `syncTabPosition`), plus `advBackdropBlur` in `settings/states/index.ts`
   - `src/modules/settings/backup/denylist.ts`: `LEGACY_KEYS` keeps two retired keys out of backups

   Question: *How long do we keep these one-time upgrades for people updating from an old version? For example: drop each one six months after it shipped.* Removing one means a user who skipped that many versions loses that old setting (or, for autosave, the archived upstream snapshots).
   `migrateLegacySections` in `section-system.ts` is #179's to decide.
3. **After the domain migration window (around 2026-11-15).** Already scheduled: `vercel.json` (Vercel no longer deploys), `src/modules/domain-migration/` with its routes and strings, and later `public/sw.js`. Follow the existing migration note; listed here so nobody deletes them early.

## Batch 5: duplicate helpers

Safe. Nothing a user can see changes.

| Helper | Copies | Plan |
|---|---|---|
| Accent-folding search text (`normalize("NFD")`, strip marks, lowercase) | `components/SearchSelect/index.tsx`, `command-palette/ranking.ts` (`foldPaletteText`), `settings/logic/settings-search.ts` (`foldSearchText`), `keyboard/view/key-index.ts` (`normalizeSearch`) | One `foldSearchText` in `src/utils`. Check `normalizeSearch` does the same steps before swapping it. |
| Regex escape | `components/LyricMarkupEditor/search.ts` (`escapeRegex`), `segmentation/utils/charUtils.ts` (`escapeRegExp`) | Keep one in `src/utils`. |
| Mac detection (`navigator.userAgent.includes("Mac")`) | 8 places: `LyricMarkupEditor/{extensions.ts,index.tsx,SearchPanel.tsx}`, `did-you-know/DidYouKnowHints.tsx`, `keyboard/commands.ts`, `keyboard/view/labels.ts`, `utils/keybindings.ts` (2) | One `IS_MAC` constant. `keyboard/commands.ts` is in #182: **after #179/#182**. |

Not worth it: about 30 inline `Math.min(Math.max(...))` clamps next to `SpicyLyrics/math.ts`'s `clamp`. Each is one line and readable.

## Checked and clean

- **Tauri commands:** all 10 registered in `generate_handler!` have a frontend `invoke()` caller.
- **Settings atoms:** every stored setting has a reader and a writer (most are toggled through the tables in `settings/modals/workflow.tsx` and `menu-actions/ribbon-actions.ts`), except `generateNameFromMetadataAtom` above.
- **Upstream audio decoder** (`audio/workers/audio.worker.ts`, `assets/decode-audio.js`): still live as the fallback when the browser can't decode a file.
- **`text-import-words.ts` hyphen default:** already fixed; the comment describes the current behavior.

Not covered: unused CSS module classes, unused Rust crates in `src-tauri/Cargo.toml`, unused files under `public/`.

## Order

1. Batch 1 (minus the `settings/states/index.ts` line) and batch 5 (minus `keyboard/commands.ts`): now.
2. Batch 2, one PR per module: now for files outside #179/#182.
3. When #179 and #182 have landed: rerun knip and the locale check, then batch 3 and the held-back lines from batches 1, 2 and 5.
4. Batch 4: when TX24 answers the two questions; item 3 on the migration schedule.

Each PR runs `pnpm exec biome check <changed files>`, `pnpm exec tsc -b`, `pnpm test`, `pnpm test:locales` and `pnpm run build`, carries the `no-changelog` label, and changes no behavior.
