//! The system accent color, for the "Follow the system accent" setting.
//!
//! `system_accent` returns the accent plus the shades to use on dark and light
//! backgrounds, so the frontend can pick the one that matches its theme.
//! `watch_system_accent` emits `system-accent-changed` when the user changes
//! it, so the app follows along without a restart.
//!
//! - Windows: `WinRT` `UISettings`, with the shades Windows itself uses for
//!   controls (`AccentLight2` on dark, `AccentDark1` on light).
//! - macOS: `NSColor.controlAccentColor`, refreshed on
//!   `NSSystemColorsDidChangeNotification`. macOS has one shade for both.
//! - Linux: the freedesktop settings portal's `accent-color` (GNOME 47+,
//!   KDE Plasma 6). Desktops without one return nothing.
//!
//! When there is no accent the command returns `None`, and the frontend hides
//! the setting and keeps its own accent.

use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemAccent {
    /// The accent as picked in the system settings.
    pub accent: String,
    /// The shade to use for controls in dark mode.
    pub on_dark: String,
    /// The shade to use for controls in light mode.
    pub on_light: String,
}

impl SystemAccent {
    /// For systems that give one accent for both themes.
    #[cfg_attr(windows, allow(dead_code))]
    fn single(hex: String) -> Self {
        Self {
            accent: hex.clone(),
            on_dark: hex.clone(),
            on_light: hex,
        }
    }
}

pub const CHANGED_EVENT: &str = "system-accent-changed";

/// `#RRGGBB` from sRGB channels in 0..=1, or `None` if any is out of range
/// (the Linux portal's way of saying "no accent").
#[cfg_attr(windows, allow(dead_code))]
fn hex_from_unit(red: f64, green: f64, blue: f64) -> Option<String> {
    let channels = [red, green, blue];
    if channels.iter().any(|c| !(0.0..=1.0).contains(c)) {
        return None;
    }
    // In range by the check above, so the cast can't truncate.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let [r, g, b] = channels.map(|c| (c * 255.0).round() as u8);
    Some(format!("#{r:02X}{g:02X}{b:02X}"))
}

#[cfg(windows)]
mod platform {
    use super::{CHANGED_EVENT, SystemAccent};
    use tauri::{AppHandle, Emitter};
    use windows::Foundation::TypedEventHandler;
    use windows::UI::ViewManagement::{UIColorType, UISettings};

    fn hex(settings: &UISettings, kind: UIColorType) -> windows::core::Result<String> {
        let color = settings.GetColorValue(kind)?;
        Ok(format!("#{:02X}{:02X}{:02X}", color.R, color.G, color.B))
    }

    fn read(settings: &UISettings) -> windows::core::Result<SystemAccent> {
        Ok(SystemAccent {
            accent: hex(settings, UIColorType::Accent)?,
            on_dark: hex(settings, UIColorType::AccentLight2)?,
            on_light: hex(settings, UIColorType::AccentDark1)?,
        })
    }

    pub fn current() -> Option<SystemAccent> {
        UISettings::new()
            .and_then(|settings| read(&settings))
            .map_err(|error| log::warn!("Couldn't read the Windows accent color: {error}"))
            .ok()
    }

    pub fn watch(app: &AppHandle) {
        let settings = match UISettings::new() {
            Ok(settings) => settings,
            Err(error) => {
                log::warn!("Couldn't watch the Windows accent color: {error}");
                return;
            }
        };
        let app = app.clone();
        let handler = TypedEventHandler::new(move |sender: windows::core::Ref<UISettings>, _| {
            // Fires for any system color change, often several times in a row;
            // the frontend ignores repeats of the same color.
            if let Some(accent) = sender.as_ref().and_then(|settings| read(settings).ok()) {
                let _ = app.emit(CHANGED_EVENT, Some(accent));
            }
            Ok(())
        });
        match settings.ColorValuesChanged(&handler) {
            // The subscription lasts as long as this UISettings, which is the
            // whole run of the app.
            Ok(_) => std::mem::forget(settings),
            Err(error) => log::warn!("Couldn't watch the Windows accent color: {error}"),
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{CHANGED_EVENT, SystemAccent, hex_from_unit};
    use objc2_app_kit::{NSColor, NSColorSpace, NSSystemColorsDidChangeNotification};
    use objc2_foundation::{NSNotification, NSNotificationCenter};
    use std::ptr::NonNull;
    use tauri::{AppHandle, Emitter};

    /// Call on the main thread (sync commands and the observer both run there).
    pub fn current() -> Option<SystemAccent> {
        let accent = NSColor::controlAccentColor();
        let srgb = accent.colorUsingColorSpace(&NSColorSpace::sRGBColorSpace())?;
        hex_from_unit(
            srgb.redComponent(),
            srgb.greenComponent(),
            srgb.blueComponent(),
        )
        .map(SystemAccent::single)
    }

    pub fn watch(app: &AppHandle) {
        let app = app.clone();
        let block = block2::RcBlock::new(move |_: NonNull<NSNotification>| {
            let _ = app.emit(CHANGED_EVENT, current());
        });
        let center = NSNotificationCenter::defaultCenter();
        // SAFETY: no object filter, and no queue, so the block runs on the
        // posting (main) thread; it only reads a color and emits an event.
        let observer = unsafe {
            center.addObserverForName_object_queue_usingBlock(
                Some(NSSystemColorsDidChangeNotification),
                None,
                None,
                &block,
            )
        };
        // Observe for the whole run of the app.
        std::mem::forget(observer);
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::{CHANGED_EVENT, SystemAccent, hex_from_unit};
    use ashpd::desktop::{Color, settings::Settings};
    use futures_util::StreamExt;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};

    fn accent(color: &Color) -> Option<SystemAccent> {
        hex_from_unit(color.red(), color.green(), color.blue()).map(SystemAccent::single)
    }

    pub async fn current() -> Option<SystemAccent> {
        // Without a portal the D-Bus call could hang for its full timeout.
        let lookup = async { Settings::new().await?.accent_color().await };
        match tokio::time::timeout(Duration::from_secs(2), lookup).await {
            Ok(Ok(color)) => accent(&color),
            _ => None,
        }
    }

    pub fn watch(app: &AppHandle) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let changes = async { Settings::new().await?.receive_accent_color_changed().await };
            let mut changes = match changes.await {
                Ok(changes) => changes,
                Err(error) => {
                    log::info!("No accent color from the desktop portal: {error}");
                    return;
                }
            };
            while let Some(color) = changes.next().await {
                let _ = app.emit(CHANGED_EVENT, accent(&color));
            }
        });
    }
}

/// The current system accent, or `None` if there isn't one.
#[cfg(not(target_os = "linux"))]
#[tauri::command]
#[must_use]
pub fn system_accent() -> Option<SystemAccent> {
    #[cfg(any(windows, target_os = "macos"))]
    return platform::current();
    #[cfg(not(any(windows, target_os = "macos")))]
    None
}

/// The current system accent, or `None` if there isn't one. Async on Linux,
/// so the portal call never blocks the main thread.
#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn system_accent() -> Option<SystemAccent> {
    platform::current().await
}

/// Emits [`CHANGED_EVENT`] with the new accent (or null) when it changes.
#[cfg_attr(
    not(any(windows, target_os = "macos", target_os = "linux")),
    allow(unused_variables)
)]
pub fn watch_system_accent(app: &tauri::AppHandle) {
    #[cfg(any(windows, target_os = "macos", target_os = "linux"))]
    platform::watch(app);
}

#[cfg(test)]
mod tests {
    use super::hex_from_unit;

    #[test]
    fn unit_channels_become_hex() {
        assert_eq!(hex_from_unit(0.0, 0.5, 1.0).as_deref(), Some("#0080FF"));
    }

    #[test]
    fn out_of_range_means_no_accent() {
        // The portal reports an unset accent with channels outside 0..=1.
        assert_eq!(hex_from_unit(-1.0, 0.5, 0.5), None);
        assert_eq!(hex_from_unit(0.5, 0.5, 1.5), None);
    }
}
