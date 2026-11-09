//! The Windows accent color, for the "Follow the Windows accent" setting.
//!
//! `system_accent` returns the accent and the two shades Windows itself uses
//! for controls (a lighter one on dark backgrounds, a darker one on light), so
//! the frontend can pick the one that matches its theme. `watch_system_accent`
//! emits `system-accent-changed` whenever the user changes it in Windows
//! Settings, so the app follows along without a restart. Other platforms
//! return nothing and the frontend keeps its own accent.

use serde::Serialize;

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemAccent {
    /// The accent as picked in Windows Settings.
    pub accent: String,
    /// The shade Windows uses for controls in dark mode.
    pub on_dark: String,
    /// The shade Windows uses for controls in light mode.
    pub on_light: String,
}

pub const CHANGED_EVENT: &str = "system-accent-changed";

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

    pub fn read(settings: &UISettings) -> windows::core::Result<SystemAccent> {
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
                let _ = app.emit(CHANGED_EVENT, accent);
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

/// The current Windows accent, or `None` off Windows or if it can't be read.
#[tauri::command]
#[must_use]
pub fn system_accent() -> Option<SystemAccent> {
    #[cfg(windows)]
    return platform::current();
    #[cfg(not(windows))]
    None
}

/// Emits [`CHANGED_EVENT`] with the new accent whenever Windows changes it.
#[cfg_attr(not(windows), allow(unused_variables))]
pub fn watch_system_accent(app: &tauri::AppHandle) {
    #[cfg(windows)]
    platform::watch(app);
}
