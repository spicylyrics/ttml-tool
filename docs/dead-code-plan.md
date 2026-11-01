# Dead code plan

Inventory of dead and leftover code in the Spicy Lyrics TTML Tool, and a staged plan to remove it. First written 2026-11-01 against `dev` at `59ea2b67`; rechecked after #179 and #182 merged (`b4f08f60`).

How it was found: `pnpm dlx knip@5` (no config, nothing committed), then every hit checked by hand with grep and git history. Also: flags pinned on or off, "legacy" / "removed" / "deprecated" comments, settings atoms with no reader or writer, Tauri commands without an `invoke()` caller, en-US keys never referenced in code, Chinese text outside the locale catalogs, and helpers written more than once. Raw outputs are in the shared session notes (`dead-code-data/`).

## Status

| Batch | What | State |
|---|---|---|
| 1 | Dead files, dependencies, symbols | PR #268 |
| 2 | Chinese comments and `t()` fallbacks | to do, one PR per module |
| 3 | 21 unused locale keys | in PR #268 |
| 4 | Product questions | answered; expired upgrades in PR #269 |
| 5 | Duplicate helpers | in PR #268 (Mac check dropped, see below) |

## Decisions (TX24, 2026-11-01)

- **Tips ("Did you know")** stay hidden behind `TIPS_RELEASED = false` for now. Don't remove `src/modules/did-you-know`.
- **One-time upgrades for old installs** stay six months after they shipped, then go.

## Batch 1: dead files, dependencies and symbols (PR #268)

No visible change.

- **Files:** `src/modules/audio/worklet/text-decoder.ts` (orphaned when SoundTouch moved to `pcm-render.worker.ts` in `25c6bf2c`), `src/modules/project/folder-project/index.ts` (barrel nobody imports).
- **Dependencies:** `@applemusic-like-lyrics/react`, `@radix-ui/react-dialog`, `@tauri-apps/plugin-log` (JS only; the Rust `tauri-plugin-log` stays), `pako`, `@types/pako`, `jotai-optics`, `@types/emscripten`, `babel-plugin-react-compiler`, and AMLL core's own dependencies we listed twice (`bezier-easing`, `deep-freeze`, `gl-matrix`, `@ungap/structured-clone` + types). The upstream local-AMLL alias block in `vite.config.ts` goes with them.
- **Symbols with no caller:** `generateNameFromMetadataAtom` (UI removed in `cb5d4b57`), `previewExportBackup`, `usePlaybackTime`, `useCurrentLocation`, `allLyricsWordsAtom`, `isInteracting`, `DISCORD_LOGO_URL`, `REPOSITORY_URL`, `ALL_PUNCTUATION` with `PUNCT_RIGHT` and `PUNCT_EXTRA`, `EFFECTS_MODES`, `LINE_END_BASE_HIT_PX`. `autoDarkModeAtom` / `isDarkThemeAtom` merged; wrong `@deprecated` on `useKeyBindingAtom` removed.

Not dead, even though knip lists them: `src/utils/url-shim.ts` (vite `url` alias), the ambient `.d.ts` files (`vite-env`, `syllabification`, `soundtouch`, `wasm_spectrogram*`), `scripts/verify-pcm-playback.mjs` (manual audio check), `public/sw.js` (see below).

Left out on purpose: about 45 exports and 63 exported types only used inside their own file, and 16 components exported both by name and as `default`. Dropping `export` is churn unless knip runs in CI.

## Batch 2: Chinese comments and fallback strings (to do)

No visible change. Split by module: (a) `segmentation`, (b) `project` (autosave, modals, logic), (c) `lyric-editor` + `spectrogram`, (d) the rest.

- **Comments:** about 340 lines in 94 files. Translate where they still describe the code, delete where the code was rewritten.
- **`t()` fallbacks:** 112 `t("key", "中文")` calls in 32 files. Every key exists in en-US, so the Chinese never shows. Replace each with the en-US text.
- **Keep** the bilingual GPL header in 58 files. It is the upstream license notice.

## Batch 3: unused locale keys (PR #268)

`ribbonBar.syncMode.{showTimestampUpdate, quickFixes, manualTimestampEdit, manageQuickFixExclusions.*}`, `spectrogram.fftSizeOption.*`, `settings.backup.{hint.assetsSet, previewToggle, previewEmpty}`, `lyricWordView.{removeWord, editingWordTitle, editingWordDesc, correctedWordPlaceholder, noSuggestions}`, `changeNotes.changelogTitle`, `commandPalette.commandTag`, `common.edit`. Removed from all 16 catalogs and `regional/es-MX.json`.

## Batch 4: timed removals

**Upgrades for old installs**, removable six months after they shipped:

| Upgrade | Where | Shipped | Remove after |
|---|---|---|---|
| Autosave v1 snapshot import | `project/autosave/autosave.ts` | 2025-12-09 | done in #269 |
| Custom background from localStorage | `settings/modals/customBackground/storage.tsx` | 2026-02-05 | done in #269 |
| `legacyKey` setting copies (`syncAutoScroll`, `editActiveLineHighlight`, `syncTabPosition`, `advBackdropBlur`) | `settings/states/sync.ts`, `settings/states/index.ts`, `settings/states/migrated-storage.ts` | 2026-10-08 | 2027-04-08 |
| `ruby` strip on open | `project/logic/normalize-document.ts` | 2026-10-14 | 2027-04-14 |
| Auto segment double-press switch | `keyboard/states.ts` (`migrateDoublePressSetting`) | 2026-10-30 | 2027-04-30 |
| Sections moved to `TTMLLyric.sections` | `lyric-editor/utils/section-system.ts` (`migrateLegacySections`) | 2026-07-24 | 2027-01-24 |

`LEGACY_KEYS` in `settings/backup/denylist.ts` is not an upgrade; it keeps retired keys out of backups. Keep it. Once #269 lands, the `customBackgroundImage` cleanup line in `storage.tsx` follows the same six-month rule (2027-05).

**After the domain migration window (around 2026-11-15):** `vercel.json`, `src/modules/domain-migration/` with its routes and strings, and later `public/sw.js`. Follow the repo migration note.

## Batch 5: duplicate helpers (PR #268)

Accent-folding search text (3 identical copies) and regex escaping (2) now live in `src/utils/text.ts`. `keyboard/view/key-index.ts`'s `normalizeSearch` stays separate: it also collapses whitespace and uses `toLowerCase`.

Dropped: the 8 `navigator.userAgent.includes("Mac")` checks. They run at call time and the keyboard tests swap the user agent mid-run, so a shared constant would break them, and a helper saves nothing. Also not worth it: about 30 inline `Math.min(Math.max(...))` clamps.

## Checked and clean

- **Tauri commands:** all 10 in `generate_handler!` have a frontend caller.
- **Settings atoms:** every stored setting has a reader and a writer (most toggle through `settings/modals/workflow.tsx` and `menu-actions/ribbon-actions.ts`).
- **Upstream audio decoder** (`audio/workers/audio.worker.ts`, `assets/decode-audio.js`): live, the fallback when the browser can't decode a file.

Not covered: unused CSS module classes, unused Rust crates in `src-tauri/Cargo.toml`, unused files under `public/`.
