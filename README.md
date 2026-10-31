<div align=center>

<img src="./public/logo.svg" align="center" width="256">

# Spicy Lyrics TTML Tool

A fork of the word-by-word lyrics editor designed specifically for the [Spicy Lyrics ecosystem](https://spicylyrics.org/).

<img width="1312" alt="image" src="https://github.com/user-attachments/assets/4db81b29-df0c-4f6e-819a-3b956b28247c">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/929eefee-ebda-43db-ad04-c0f099077053">
<img width="1312" alt="image" src="https://github.com/user-attachments/assets/7c80902e-45a9-42ae-b980-f5500069acb8">

</div>

## Usage

> [!WARNING]
> This tool is not recommended for mobile phones or small screens, as the operation can be very cumbersome.

You can use the online version of this tool by visiting [https://tool.spicylyrics.org/](https://tool.spicylyrics.org/).

You can also use the Tauri desktop version built via GitHub Actions; see the [Latest Release](https://github.com/spicylyrics/ttml-tool/releases/latest) for details.

### Linux

The desktop app on Linux runs on WebKitGTK, which draws this app's effects much slower than Chrome or Firefox do. If it feels laggy on your machine, the [website](https://tool.spicylyrics.org/) in Chrome or Firefox is the smoothest option today.

- **Flatpak (recommended):** download the `.flatpak` file from the [latest release](https://github.com/spicylyrics/ttml-tool/releases/latest), then install it with the Flathub remote added:

  ```sh
  flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
  flatpak install --user ./Spicy-Lyrics-TTML-Tool_x86_64.flatpak
  ```

  WebKitGTK, GStreamer and GLib come from the GNOME runtime, so the app behaves the same on every distro. Install newer releases the same way; it is not on Flathub yet.
- **Arch Linux:** the `amll-ttml-tool-git` AUR package builds the app against your system libraries. See [`packaging/archlinux`](./packaging/archlinux).
- **AppImage (unsupported):** still published so existing installs keep updating, but it mixes Ubuntu's WebKitGTK and GLib with your system's GStreamer and GPU driver, which breaks on some distros. Move to the Flatpak.

On Linux the app starts with lighter visual effects: no blur, glows, dialog animations or moving preview background. Change it in **Preferences → Appearance → Visual effects**.

If the window stays black or blank on Wayland, try turning off WebKitGTK's compositing:

```sh
flatpak override --user --env=WEBKIT_DISABLE_COMPOSITING_MODE=1 io.github.spicylyrics.TTMLTool
```

## New Editor Features over the Original AMLL TTML Tool

- **Folder Projects** — The opt-in desktop feature keeps lyrics and audio together in a project folder with a `project.json` manifest, recent projects, workspace scanning, project-wide Ctrl+S saving, and file tracking that survives renames made outside the app. Linked projects leave the TTML and audio where they are, and only an explicit save writes back to the original, after keeping a one-time backup.
- **Guided Beginner Workflow** — Learn audio import, lyric review, timing, credits, export, and local testing through focused, state-aware steps using your own song; move the guide around the viewport or tuck it into a compact edge tab while working.
- **Compact Lyric Workspace** — Use edge-to-edge audio and lyric areas, visually connected word and romanization groups, and compact whitespace chips sized by their space count, with an optional legacy label style.
- **Discord Rich Presence & PreMiD Bridge** — The opt-in Tauri integration shares the current file or track, editor mode, line progress, playback state, and speed-aware timeline with Discord, preserves per-project elapsed time across app restarts, and exposes the same live state to PreMiD on the website while retaining a compatibility fallback for the original editor.
- **Combine Words Across Lyrics** — Preview a word combination, apply it to matching sequences throughout the project, and optionally ignore case and surrounding punctuation.
- **Header-Free Timing Tools** — Copy line and word timings onto existing lyrics or snap any selected timing block to the playhead without relying on imported Genius headers.
- **Remembered Desktop Window** — Restore the previous window size, maximized state, and fullscreen state across desktop app launches without persisting its position or visibility.
- **Inline Time-Tab Editing** — Double-click a synced word to edit it directly in Time mode, or edit per-word romanizations inline when displayed.
- **TTML Checklist** — Maintain a persistent local queue of songs to sync with notes, progress tracking, and completed history.
- **Smarter Lyrics Splitting** — Choose dedicated syllabification engines for English, Polish, Spanish, French, German, Indonesian, Italian, Portuguese, Russian, Japanese, and CJK lyrics; Auto Segment suggests an engine from the lyric language, while legacy fallbacks remain available.
- **Learned Word Splits** — Remember manual split boundaries and automatically reuse them for future occurrences of the same word.
- **Persistent Split Options** — The Split Word dialog remembers its last-used options, reducing repeated setup while correcting multiple words.
- **Spicy Lyrics Preview** — A high-fidelity Spicy Lyrics renderer with animated, custom, and cover-art backgrounds; karaoke, Simple Lyrics, and line-synced layouts; automatic scrolling; and an optional FPS counter.
- **Time Stretch** — Scale every TTML timestamp to fit a new song duration, with support for reading durations from audio files.
- **Unified Lyrics Import** — Choose Plain Text, LRCLIB, or Genius from clear cards in the empty editor, then use one consistent preparation, replacement-confirmation, and formatting workflow.
- **Genius sections & section tools** — Preserve headers such as `[Chorus]` and `[Verse]` as color-coded section metadata, with whole-section timing controls.
- **Backup & Restore** — Export and restore selected settings, keybindings, appearance assets, projects and history in a portable backup file.
- **Bouncy Word Indicator** — Long-duration syllables in Sync mode get a subtle bouncing dot, making held words easier to spot while timing.
- **Toxi Lyrics Engine** — High-fidelity jump-down animations, instant-on bloom with smooth fade-out, and adjustable wipe softness.
- **144Hz+ Rendering** — A dedicated interpolation engine for ultra-high refresh rates that bypasses React bottlenecks.
- **Millisecond Precision Sync** — Interpolated high-resolution performance markers for frame-accurate timing.
- **Cinematic Backgrounds** — Hardware-accelerated Mesh Gradient backgrounds running at 60 FPS.
- **Snap to Playhead** — One-click synchronization that snaps lyric start times directly to the audio playhead position.
- **Auto-Lyric Sanitizer** — Automatically strips Genius tags and cleans empty lines on import.
- **Automatic Multilingual Phonetics** — Generate contextual Japanese, Mandarin, and Korean romanization with per-word readings, tone-aware Mandarin mapping, and mixed-language line support.
- **Pre-Export Validator** — Checks for untimed or overlapping lyrics before saving.
- **Integrated Audio Bridge** — Built-in FFmpeg.wasm MP3-to-FLAC conversion to reduce decoding drift.
- **Appearance Editor** — More than 40 visual parameters and theme presets for customizing the editor.
- **Global Localization** — Full i18n support with community-driven translations.

## Contribution

All active code and translation contributions are welcome! We also welcome bug reports and suggestions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

For questions, bug reports and ideas, you can also post in [#ttml-tool](https://discord.com/channels/1369992682214264993/1558259984318603334) on the [Spicy Lyrics Discord](https://discord.com/invite/uqgXU5wh8j) (join first, then the channel link works).

If you want to provide a new language translation, please refer to [`./src/i18n/index.ts`](./src/i18n/index.ts) and [`./src/i18n/locales/en-US/translation.json`](./src/i18n/locales/en-US/translation.json)!
