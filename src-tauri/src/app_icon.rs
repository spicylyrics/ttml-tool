//! Recolors the app icon from the Logo color setting: the window and taskbar
//! icon while the app runs, and on Windows the installer's desktop and Start
//! menu shortcuts.
//!
//! The frontend calls `apply_app_icon` on every launch, so shortcuts the
//! updater rewrote get their color back. Shortcuts that already point at the
//! right icon are left untouched.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use resvg::{tiny_skia, usvg};
use tauri::{AppHandle, Manager};

const LOGO_SVG: &str = include_str!("../../public/logo.svg");
const TILE_TOP: &str = "#4E347E";
const TILE_BOTTOM: &str = "#3F2669";
const GLYPH: &str = "#BEB4D9";
const ICO_SIZES: [u32; 6] = [16, 24, 32, 48, 64, 256];
const ICON_PREFIX: &str = "logo-";

/// One apply at a time; a dragged color picker can fire several in a row.
static APPLY_LOCK: Mutex<()> = Mutex::new(());

fn parse_hex(color: &str) -> Option<[u8; 3]> {
    let hex = color.strip_prefix('#')?;
    if hex.len() != 6 || !hex.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    let channel = |i: usize| u8::from_str_radix(&hex[i..i + 2], 16).ok();
    Some([channel(0)?, channel(2)?, channel(4)?])
}

fn to_hex([r, g, b]: [u8; 3]) -> String {
    format!("#{r:02X}{g:02X}{b:02X}")
}

fn relative_luminance(rgb: [u8; 3]) -> f64 {
    let linear = |c: u8| {
        let c = f64::from(c) / 255.0;
        if c <= 0.039_28 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        }
    };
    0.0722f64.mul_add(
        linear(rgb[2]),
        0.2126f64.mul_add(linear(rgb[0]), 0.7152 * linear(rgb[1])),
    )
}

/// The logo with its tile in `rgb` (darkening toward the bottom, like the
/// original) and the glyph in white, or near-black on light tiles.
fn tinted_svg(rgb: [u8; 3]) -> String {
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let bottom = rgb.map(|c| (f64::from(c) * 0.82).round() as u8);
    // White needs 3:1 against the tile; below that, dark ink reads better.
    let glyph = if (1.05 / (relative_luminance(rgb) + 0.05)) >= 3.0 {
        "#FFFFFF"
    } else {
        "#1B1530"
    };
    // Through placeholders, so a color equal to one of the originals (Lilac is
    // the glyph's own color) can't be caught by a later replacement.
    LOGO_SVG
        .replace(TILE_TOP, "@tile-top@")
        .replace(TILE_BOTTOM, "@tile-bottom@")
        .replace(GLYPH, "@glyph@")
        .replace("@tile-top@", &to_hex(rgb))
        .replace("@tile-bottom@", &to_hex(bottom))
        .replace("@glyph@", glyph)
}

fn render(svg: &str, size: u32) -> Result<tiny_skia::Pixmap, String> {
    let tree = usvg::Tree::from_str(svg, &usvg::Options::default()).map_err(|e| e.to_string())?;
    let mut pixmap = tiny_skia::Pixmap::new(size, size).ok_or("Invalid icon size")?;
    #[allow(clippy::cast_precision_loss)]
    let scale = size as f32 / tree.size().width();
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    Ok(pixmap)
}

/// A multi-size `.ico` with PNG entries (Windows Vista and later read these).
fn encode_ico(svg: &str) -> Result<Vec<u8>, String> {
    let images = ICO_SIZES
        .iter()
        .map(|&size| {
            let png = render(svg, size)?.encode_png().map_err(|e| e.to_string())?;
            Ok((size, png))
        })
        .collect::<Result<Vec<_>, String>>()?;
    let mut ico = Vec::new();
    ico.extend_from_slice(&[0, 0, 1, 0]);
    #[allow(clippy::cast_possible_truncation)]
    ico.extend_from_slice(&(images.len() as u16).to_le_bytes());
    let mut offset = 6 + 16 * images.len();
    for (size, png) in &images {
        // 256 is stored as 0.
        #[allow(clippy::cast_possible_truncation)]
        let dimension = if *size >= 256 { 0 } else { *size as u8 };
        ico.extend_from_slice(&[dimension, dimension, 0, 0, 1, 0, 32, 0]);
        #[allow(clippy::cast_possible_truncation)]
        {
            ico.extend_from_slice(&(png.len() as u32).to_le_bytes());
            ico.extend_from_slice(&(offset as u32).to_le_bytes());
        }
        offset += png.len();
    }
    for (_, png) in images {
        ico.extend_from_slice(&png);
    }
    Ok(ico)
}

fn window_icon(svg: &str) -> Result<tauri::image::Image<'static>, String> {
    let pixmap = render(svg, 256)?;
    let rgba = pixmap
        .pixels()
        .iter()
        .flat_map(|pixel| {
            let c = pixel.demultiply();
            [c.red(), c.green(), c.blue(), c.alpha()]
        })
        .collect();
    Ok(tauri::image::Image::new_owned(rgba, 256, 256))
}

fn icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("icons"))
}

/// Deletes generated icons other than `keep`.
fn remove_stale_icons(dir: &Path, keep: Option<&Path>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let generated = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(ICON_PREFIX))
            && path
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("ico"));
        if generated && Some(path.as_path()) != keep {
            let _ = std::fs::remove_file(&path);
        }
    }
}

fn apply(app: &AppHandle, color: Option<[u8; 3]>) -> Result<(), String> {
    let _guard = APPLY_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = icons_dir(app)?;
    let window = app.get_webview_window("main");

    let Some(rgb) = color else {
        if let (Some(window), Some(icon)) = (window, app.default_window_icon()) {
            window.set_icon(icon.clone()).map_err(|e| e.to_string())?;
        }
        #[cfg(windows)]
        shortcuts::point_at(
            &std::env::current_exe().map_err(|e| e.to_string())?,
            None,
            &dir,
        )?;
        remove_stale_icons(&dir, None);
        return Ok(());
    };

    let svg = tinted_svg(rgb);
    if let Some(window) = window {
        window
            .set_icon(window_icon(&svg)?)
            .map_err(|e| e.to_string())?;
    }
    // The color is in the file name so Explorer's icon cache can't keep
    // showing an older color for the same path.
    let ico_path = dir.join(format!("{ICON_PREFIX}{}.ico", &to_hex(rgb)[1..]));
    if !ico_path.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        std::fs::write(&ico_path, encode_ico(&svg)?).map_err(|e| e.to_string())?;
    }
    #[cfg(windows)]
    shortcuts::point_at(
        &std::env::current_exe().map_err(|e| e.to_string())?,
        Some(&ico_path),
        &dir,
    )?;
    remove_stale_icons(&dir, Some(&ico_path));
    Ok(())
}

/// `color` is `#rrggbb`, or `None` for the default icon.
#[tauri::command]
pub fn apply_app_icon(app: AppHandle, color: Option<String>) -> Result<(), String> {
    let color = match color {
        Some(value) => Some(parse_hex(&value).ok_or("Expected a #rrggbb color")?),
        None => None,
    };
    // Off the main thread: rendering and shortcut I/O shouldn't hold up the UI,
    // and COM gets an apartment of its own.
    std::thread::spawn(move || {
        if let Err(error) = apply(&app, color) {
            log::warn!("Couldn't apply the app icon: {error}");
        }
    });
    Ok(())
}

#[cfg(windows)]
mod shortcuts {
    use std::path::{Path, PathBuf};

    use windows::Win32::System::Com::{
        CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, CoCreateInstance, CoInitializeEx,
        CoTaskMemFree, CoUninitialize, IPersistFile, STGM_READWRITE,
    };
    use windows::Win32::UI::Shell::{
        FOLDERID_CommonPrograms, FOLDERID_Desktop, FOLDERID_Programs, FOLDERID_PublicDesktop,
        IShellLinkW, KF_FLAG_DEFAULT, SHCNE_ASSOCCHANGED, SHCNE_UPDATEITEM, SHCNF_IDLIST,
        SHCNF_PATHW, SHChangeNotify, SHGetKnownFolderPath, ShellLink,
    };
    use windows::core::{GUID, HSTRING, Interface, PCWSTR};

    fn known_folder(id: &GUID) -> Option<PathBuf> {
        // SAFETY: the returned buffer is ours to free, and is freed below.
        unsafe {
            let path = SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None).ok()?;
            let result = path.to_string().ok().map(PathBuf::from);
            CoTaskMemFree(Some(path.0.cast()));
            result
        }
    }

    /// `.lnk` files in the folders the installer writes to, one level deep
    /// (the Start menu may put them in a folder).
    fn candidate_links() -> Vec<PathBuf> {
        let mut links = Vec::new();
        let folders = [
            FOLDERID_Desktop,
            FOLDERID_PublicDesktop,
            FOLDERID_Programs,
            FOLDERID_CommonPrograms,
        ];
        for folder in folders.iter().filter_map(known_folder) {
            let Ok(entries) = std::fs::read_dir(&folder) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Ok(inner) = std::fs::read_dir(&path) {
                        links.extend(inner.flatten().map(|e| e.path()).filter(|p| is_link(p)));
                    }
                } else if is_link(&path) {
                    links.push(path);
                }
            }
        }
        links
    }

    fn is_link(path: &Path) -> bool {
        path.extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
    }

    fn wide_to_string(buffer: &[u16]) -> String {
        let end = buffer.iter().position(|&c| c == 0).unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..end])
    }

    fn same_path(a: &str, b: &Path) -> bool {
        a.eq_ignore_ascii_case(&b.to_string_lossy())
    }

    /// Points shortcuts that launch `exe` at `icon`, or back at the exe's own
    /// icon when `icon` is `None`. Shortcuts already right are not rewritten;
    /// all-users shortcuts are skipped when we lack the rights to save them.
    unsafe fn retarget(exe: &Path, icon: Option<&Path>, icons_dir: &Path) -> usize {
        let mut changed = 0;
        for link_path in candidate_links() {
            let result: windows::core::Result<bool> = (|| unsafe {
                let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
                let file: IPersistFile = link.cast()?;
                let link_name = HSTRING::from(link_path.as_os_str());
                file.Load(&link_name, STGM_READWRITE)?;

                let mut target = [0u16; 1024];
                link.GetPath(&mut target, std::ptr::null_mut(), 0)?;
                if !same_path(&wide_to_string(&target), exe) {
                    return Ok(false);
                }

                let mut current = [0u16; 1024];
                let mut index = 0;
                link.GetIconLocation(&mut current, &raw mut index)?;
                let current = wide_to_string(&current);
                let wanted = icon.unwrap_or(exe);
                // For the default, anything not pointing at our generated icons is fine.
                let already = icon.map_or_else(
                    || {
                        !current
                            .to_ascii_lowercase()
                            .starts_with(&icons_dir.to_string_lossy().to_ascii_lowercase())
                    },
                    |icon| same_path(&current, icon),
                );
                if already {
                    return Ok(false);
                }

                link.SetIconLocation(&HSTRING::from(wanted.as_os_str()), 0)?;
                file.Save(PCWSTR::null(), true)?;
                SHChangeNotify(
                    SHCNE_UPDATEITEM,
                    SHCNF_PATHW,
                    Some(link_name.as_ptr().cast()),
                    None,
                );
                Ok(true)
            })();
            match result {
                Ok(true) => changed += 1,
                Ok(false) => {}
                Err(error) => log::info!("Skipped shortcut {}: {error}", link_path.display()),
            }
        }
        changed
    }

    pub fn point_at(exe: &Path, icon: Option<&Path>, icons_dir: &Path) -> Result<(), String> {
        // SAFETY: COM is initialized for this thread and torn down before it
        // returns; every interface is released when it goes out of scope.
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED)
                .ok()
                .map_err(|e| e.to_string())?;
            let changed = retarget(exe, icon, icons_dir);
            if changed > 0 {
                SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None);
                log::info!("Updated the icon on {changed} shortcut(s)");
            }
            CoUninitialize();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logo_still_has_the_colors_we_replace() {
        for marker in [TILE_TOP, TILE_BOTTOM, GLYPH] {
            assert!(LOGO_SVG.contains(marker), "public/logo.svg lost {marker}");
        }
    }

    #[test]
    fn parses_only_rrggbb() {
        assert_eq!(parse_hex("#EF3838"), Some([0xEF, 0x38, 0x38]));
        assert_eq!(parse_hex("#ef3838"), Some([0xEF, 0x38, 0x38]));
        assert_eq!(parse_hex("EF3838"), None);
        assert_eq!(parse_hex("#EF38"), None);
        assert_eq!(parse_hex("#EF383G"), None);
    }

    #[test]
    fn glyph_ink_follows_the_tile() {
        assert!(tinted_svg([0xEF, 0x38, 0x38]).contains("#FFFFFF"));
        assert!(tinted_svg([0xFF, 0xBB, 0x00]).contains("#1B1530"));
        assert!(!tinted_svg([0xEF, 0x38, 0x38]).contains(GLYPH));
    }

    #[test]
    fn a_color_equal_to_an_original_stays_on_the_tile() {
        // Lilac is the glyph's original color; the tile must keep it.
        let svg = tinted_svg(parse_hex(GLYPH).unwrap());
        assert!(svg.contains(&format!("stop-color=\"{GLYPH}\"")));
        assert!(!svg.contains(&format!("fill=\"{GLYPH}\"")));
    }

    #[test]
    fn writes_a_valid_multi_size_ico() {
        let ico = encode_ico(&tinted_svg([0xB9, 0x15, 0xD4])).unwrap();
        assert_eq!(&ico[..4], &[0, 0, 1, 0]);
        assert_eq!(
            u16::from_le_bytes([ico[4], ico[5]]) as usize,
            ICO_SIZES.len()
        );
        // The first entry's data is a PNG.
        let offset = u32::from_le_bytes(ico[18..22].try_into().unwrap()) as usize;
        assert_eq!(&ico[offset..offset + 4], b"\x89PNG");
    }
}
