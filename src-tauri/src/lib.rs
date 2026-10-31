mod app_icon;

use std::fs;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity};
use tauri_plugin_fs::FsExt;

const DISCORD_CLIENT_ID: &str = "1250551199862624349";
const DISCORD_LOGO_URL: &str = "https://tool.spicylyrics.org/logo.png";
const DISCORD_PLAY_URL: &str = "https://cdn.rcd.gg/PreMiD/resources/play.png";
const DISCORD_PAUSE_URL: &str = "https://cdn.rcd.gg/PreMiD/resources/pause.png";
const REPOSITORY_URL: &str = "https://github.com/spicylyrics/ttml-tool";

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiscordActivityPayload {
    details: Option<String>,
    state: Option<String>,
    playing: bool,
    show_repository_button: bool,
    show_status_badge: bool,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
    large_image: Option<String>,
}

struct DiscordConnection {
    client: Option<DiscordIpcClient>,
    retry_after: Option<Instant>,
}

impl Default for DiscordConnection {
    fn default() -> Self {
        Self {
            client: None,
            retry_after: None,
        }
    }
}

#[derive(Default)]
struct DiscordState(Arc<Mutex<DiscordConnection>>, Arc<AtomicU64>);

#[cfg(windows)]
const LINKABLE_EXTENSIONS: &[&str] = &[
    "ttml", "flac", "wav", "mp3", "m4a", "aac", "ogg", "opus", "webm", "weba",
    "oga", "mid", "aiff", "wma", "au",
];
#[cfg(windows)]
const MAX_REMEMBERED_DROPS: usize = 64;
#[cfg(windows)]
const DROPPED_FILES_MESSAGE_PREFIX: &str = "amll-dropped-files:";

/// Real paths of linkable files that were dropped on the window. A path can
/// only be granted filesystem access (`allow_dropped_file`) if it is in here.
#[derive(Default)]
struct DroppedPaths(Mutex<Vec<String>>);

#[cfg(windows)]
#[derive(Clone, serde::Serialize)]
struct DroppedFilePathsPayload {
    id: String,
    paths: Vec<String>,
}

#[cfg(windows)]
fn is_linkable_path(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            LINKABLE_EXTENSIONS
                .iter()
                .any(|linkable| linkable.eq_ignore_ascii_case(ext))
        })
}

fn connect_discord() -> Result<DiscordIpcClient, String> {
    let mut client = DiscordIpcClient::new(DISCORD_CLIENT_ID);
    client.connect().map_err(|e| e.to_string())?;
    Ok(client)
}

#[tauri::command]
async fn set_discord_activity(
    payload: DiscordActivityPayload,
    discord: tauri::State<'_, DiscordState>,
) -> Result<(), String> {
    let connection = Arc::clone(&discord.0);
    let revision = Arc::clone(&discord.1);
    let generation = revision.fetch_add(1, Ordering::Relaxed) + 1;
    tauri::async_runtime::spawn_blocking(move || {
        update_discord_activity(payload, &connection, &revision, generation)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn update_discord_activity(
    payload: DiscordActivityPayload,
    discord: &Mutex<DiscordConnection>,
    revision: &AtomicU64,
    generation: u64,
) -> Result<(), String> {
    let mut connection = discord.lock().map_err(|e| e.to_string())?;
    if revision.load(Ordering::Relaxed) != generation {
        return Ok(());
    }
    if connection.client.is_none() {
        if connection
            .retry_after
            .is_some_and(|retry_after| retry_after > Instant::now())
        {
            return Ok(());
        }
        match connect_discord() {
            Ok(client) => {
                connection.client = Some(client);
                connection.retry_after = None;
            }
            Err(error) => {
                log::debug!("Discord RPC is unavailable: {error}");
                connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
                return Ok(());
            }
        }
    }

    let large_image = payload
        .large_image
        .as_deref()
        .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
        .unwrap_or(DISCORD_LOGO_URL);

    let mut assets = activity::Assets::new()
        .large_image(large_image)
        .large_text("TTML Tool");
    if payload.show_status_badge {
        let small_image = if payload.playing {
            DISCORD_PLAY_URL
        } else {
            DISCORD_PAUSE_URL
        };
        let small_text = if payload.playing { "Playing" } else { "Paused" };
        assets = assets.small_image(small_image).small_text(small_text);
    }
    let mut rich_presence = activity::Activity::new()
        .activity_type(activity::ActivityType::Listening)
        .status_display_type(activity::StatusDisplayType::Details)
        .assets(assets);

    if let Some(details) = payload.details.as_deref() {
        rich_presence = rich_presence.details(details);
    }
    if let Some(state) = payload.state.as_deref() {
        rich_presence = rich_presence.state(state);
    }
    if payload.show_repository_button {
        rich_presence = rich_presence.buttons(vec![activity::Button::new(
            "View repository",
            REPOSITORY_URL,
        )]);
    }

    if let Some(start) = payload.start_timestamp {
        let mut timestamps = activity::Timestamps::new().start(start);
        if let Some(end) = payload.end_timestamp {
            timestamps = timestamps.end(end);
        }
        rich_presence = rich_presence.timestamps(timestamps);
    }

    let result = connection
        .client
        .as_mut()
        .expect("Discord client was initialized")
        .set_activity(rich_presence)
        .map_err(|e| e.to_string());
    if result.is_err() {
        connection.client = None;
        connection.retry_after = Some(Instant::now() + Duration::from_secs(15));
    }
    result
}

#[tauri::command]
async fn clear_discord_activity(discord: tauri::State<'_, DiscordState>) -> Result<(), String> {
    let connection = Arc::clone(&discord.0);
    let revision = Arc::clone(&discord.1);
    let generation = revision.fetch_add(1, Ordering::Relaxed) + 1;
    tauri::async_runtime::spawn_blocking(move || {
        clear_discord_connection(&connection, &revision, generation)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn clear_discord_connection(
    discord: &Mutex<DiscordConnection>,
    revision: &AtomicU64,
    generation: u64,
) -> Result<(), String> {
    let mut connection = discord.lock().map_err(|e| e.to_string())?;
    if revision.load(Ordering::Relaxed) != generation {
        return Ok(());
    }
    if let Some(client) = connection.client.as_mut() {
        let result = client.clear_activity().map_err(|e| e.to_string());
        if result.is_err() {
            connection.client = None;
        }
        return result;
    }
    connection.retry_after = None;
    Ok(())
}

/// On Linux the updater can only replace an `AppImage`. Flatpak, AUR and other
/// package-manager installs update through their package manager instead.
#[tauri::command]
fn can_self_update() -> bool {
    !cfg!(target_os = "linux") || std::env::var_os("APPIMAGE").is_some()
}

/// Inside the Flatpak, GTK can't see the host's theme, so native decorations
/// come out as GNOME's Adwaita header bar on every desktop. Draw our own title
/// bar there instead, as on Windows. Other Linux installs keep the native one.
#[tauri::command]
fn uses_custom_title_bar() -> bool {
    cfg!(target_os = "linux") && std::path::Path::new("/.flatpak-info").exists()
}

#[derive(serde::Serialize)]
struct OpenFileData {
    pub filename: String,
    pub data: String,
    pub ext: String,
}

#[tauri::command]
fn get_open_file_data() -> Option<OpenFileData> {
    let filename = std::env::args().nth(1);
    if let Some(filename) = filename {
        let path = std::path::Path::new(&filename);
        let ext = path
            .extension()
            .map(|x| x.to_string_lossy().into_owned())
            .unwrap_or_default();
        if let Ok(data) = std::fs::read_to_string(&filename) {
            return Some(OpenFileData {
                filename,
                data,
                ext,
            });
        }
    }

    None
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn open_linked_projects_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data folder is unavailable: {e}"))?
        .join("projects");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create {}: {e}", dir.display()))?;
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program)
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("failed to open {}: {e}", dir.display()))?;
    Ok(())
}

/// `canonicalize` returns `\\?\C:\...` paths on Windows, which Explorer does not
/// reliably open or select, so hand it the plain drive path instead.
#[cfg(target_os = "windows")]
fn without_verbatim_prefix(path: &std::path::Path) -> std::path::PathBuf {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(rest) if !rest.starts_with("UNC\\") => std::path::PathBuf::from(rest),
        _ => path.to_path_buf(),
    }
}

/// Opens a linked project's data folder, selecting the one-time backup
/// (`original.ttml.bak`, see `LINKED_LYRIC_BACKUP_FILENAME` in
/// `folder-project/types.ts`) in Explorer when it exists.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn open_linked_project_dir(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    use std::path::PathBuf;
    use tauri::Manager;

    let base_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data folder is unavailable: {e}"))?
        .join("projects");
    if !base_dir.exists() {
        std::fs::create_dir_all(&base_dir)
            .map_err(|e| format!("failed to create projects folder: {e}"))?;
    }
    let canonical_base = base_dir
        .canonicalize()
        .map_err(|e| format!("projects directory is unavailable: {e}"))?;
    let path = PathBuf::from(&dir);
    let canonical_path = path
        .canonicalize()
        .map_err(|e| format!("invalid project directory: {e}"))?;

    if !canonical_path.starts_with(&canonical_base) || canonical_path == canonical_base {
        return Err("access denied: path outside projects directory".into());
    }

    let backup_file = canonical_path.join("original.ttml.bak");
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        if backup_file.exists() {
            let win_path = without_verbatim_prefix(&backup_file)
                .to_string_lossy()
                .replace('/', "\\");
            let _ = Command::new("explorer")
                .args(["/select,", &win_path])
                .spawn();
            return Ok(());
        }
    }

    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    #[cfg(target_os = "windows")]
    let open_path = without_verbatim_prefix(&canonical_path);
    #[cfg(not(target_os = "windows"))]
    let open_path = canonical_path;
    std::process::Command::new(program)
        .arg(&open_path)
        .spawn()
        .map_err(|e| format!("failed to open {}: {e}", open_path.display()))?;
    Ok(())
}

/// Grants filesystem access to a file the user dropped on the window.
///
/// Called only once the user actually links that file to a project, and only
/// for paths the host itself saw in a real drop, so a forged invoke cannot
/// widen the scope to arbitrary files.
///
/// Returns `false` (and grants nothing) for paths that were not dropped, such
/// as files picked with a native dialog, which already have their own access.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
fn allow_dropped_file(
    path: String,
    window: tauri::Window,
    dropped: tauri::State<'_, DroppedPaths>,
) -> Result<bool, String> {
    let known = dropped
        .0
        .lock()
        .map_err(|_| "the dropped file list is unavailable".to_string())?
        .contains(&path);
    if !known {
        return Ok(false);
    }
    window
        .try_fs_scope()
        .ok_or_else(|| "filesystem scope is unavailable".to_string())?
        .allow_file(&path)
        .map_err(|e| format!("failed to extend filesystem scope: {e}"))?;
    Ok(true)
}

/// Receives files dropped on the page and reports their real paths.
///
/// HTML drops only hand the page file contents, and native drag-drop events
/// stay off because they break in-page drag and drop on Windows. `WebView2` can
/// still pass the dropped `File` objects to the host, which can read their
/// paths. Paths are only remembered here (and reported to the page); the fs
/// scope is granted later by `allow_dropped_file`, when a file is really linked.
#[cfg(windows)]
fn watch_dropped_file_paths(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use tauri::{Emitter, Manager};
    use webview2_com::{
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2File, ICoreWebView2WebMessageReceivedEventArgs2,
        },
        WebMessageReceivedEventHandler, take_pwstr,
    };
    use windows::core::{Interface, PWSTR};

    let emitter = window.clone();
    window.with_webview(move |webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut message = PWSTR::null();
            if args.TryGetWebMessageAsString(&raw mut message).is_err() {
                return Ok(());
            }
            let text = take_pwstr(message);
            let Some(request_id) = text.strip_prefix(DROPPED_FILES_MESSAGE_PREFIX) else {
                return Ok(());
            };
            let request_id = request_id.to_owned();
            let objects = args
                .cast::<ICoreWebView2WebMessageReceivedEventArgs2>()?
                .AdditionalObjects()?;
            let mut count = 0;
            objects.Count(&raw mut count)?;
            let mut paths = Vec::new();
            for index in 0..count {
                let Ok(file) = objects
                    .GetValueAtIndex(index)
                    .and_then(|object| object.cast::<ICoreWebView2File>())
                else {
                    continue;
                };
                let mut path = PWSTR::null();
                if file.Path(&raw mut path).is_ok() {
                    paths.push(take_pwstr(path));
                }
            }
            if let Ok(mut known) = emitter.state::<DroppedPaths>().0.lock() {
                for path in paths.iter().filter(|path| is_linkable_path(path)) {
                    if !known.contains(path) {
                        known.push(path.clone());
                    }
                }
                while known.len() > MAX_REMEMBERED_DROPS {
                    known.remove(0);
                }
            }
            let _ = emitter.emit_to(
                emitter.label(),
                "dropped-file-paths",
                DroppedFilePathsPayload {
                    id: request_id,
                    paths,
                },
            );
            Ok(())
        }));
        let mut token = 0;
        let _ = core.add_WebMessageReceived(&handler, &raw mut token);
    })
}

/// Shows a native folder picker and grants the picked project folder's parent
/// (needed for folder create, auto-rename and sibling scans).
///
/// The picker lives here instead of taking a path from the webview so scope
/// can only be widened by a real user pick, never by a forged invoke call.
#[tauri::command]
async fn pick_project_folder(
    title: String,
    window: tauri::Window,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let Some(picked) = window
        .dialog()
        .file()
        .set_title(title)
        .set_parent(&window)
        .blocking_pick_folder()
    else {
        return Ok(None);
    };
    let project_path = picked
        .into_path()
        .map_err(|e| format!("invalid folder path: {e}"))?;
    let scope = window
        .try_fs_scope()
        .ok_or_else(|| "filesystem scope is unavailable".to_string())?;
    let granted = project_path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(&project_path);
    scope
        .allow_directory(granted, true)
        .map_err(|e| format!("failed to extend filesystem scope: {e}"))?;
    Ok(Some(project_path.to_string_lossy().into_owned()))
}

/// The main window starts hidden and the frontend shows it once it has rendered,
/// to avoid a white flash. If the frontend fails before that (a startup error,
/// or an API the system WebView lacks), the app would run with no window at all.
/// Show it anyway after a few seconds so there's something to see and report.
fn show_main_window_if_frontend_stalls(app: &tauri::App) {
    use tauri::Manager;

    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(3));
        if window.is_visible().is_ok_and(|visible| !visible) {
            log::warn!("The frontend didn't show the main window; showing it now");
            let _ = window.show();
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[allow(clippy::missing_panics_doc)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    if can_self_update() {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Always update through the NSIS installer. The MSI re-creates its desktop shortcut on
    // every upgrade, and newer updater versions would keep MSI installs on the MSI. NSIS
    // migrates an MSI install once, then leaves shortcuts alone in update mode.
    #[cfg(windows)]
    {
        builder = builder.plugin(
            tauri_plugin_updater::Builder::new()
                .target(format!("windows-{}-nsis", std::env::consts::ARCH))
                .build(),
        );
    }

    #[cfg(desktop)]
    {
        use tauri_plugin_window_state::StateFlags;

        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::SIZE | StateFlags::MAXIMIZED | StateFlags::FULLSCREEN,
                )
                .build(),
        );
    }

    builder
        .manage(DiscordState::default())
        .manage(DroppedPaths::default())
        .setup(|app| {
            #[cfg(windows)]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    watch_dropped_file_paths(&window)?;
                }
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            #[cfg(target_os = "macos")]
            {
                use tao::rwh_06::HasWindowHandle;
                use tauri::Manager;
                use tauri_plugin_decorum::WebviewWindowExt;

                // Cosmetic only: if any of these fail on a user's macOS version,
                // keep going instead of crashing at launch.
                if let Some(main_window) = app.get_webview_window("main") {
                    if let Err(error) = main_window.set_traffic_lights_inset(16.0, 20.0) {
                        log::warn!("Couldn't inset the traffic lights: {error}");
                    }
                    if let Err(error) = main_window.make_transparent() {
                        log::warn!("Couldn't make the window transparent: {error}");
                    }
                    let main_window_clone = main_window.clone();
                    main_window.on_window_event(move |evt| {
                        if let tauri::WindowEvent::Resized(_) = evt {
                            let _ = main_window_clone.set_traffic_lights_inset(16.0, 20.0);
                        }
                    });
                }
            }
            #[cfg(target_os = "linux")]
            if uses_custom_title_bar() {
                use tauri::Manager;

                // The window is still hidden, so this never flashes the native bar.
                // Tauri keeps edge resizing for undecorated GTK windows.
                if let Some(main_window) = app.get_webview_window("main") {
                    if let Err(error) = main_window.set_decorations(false) {
                        log::warn!("Couldn't remove the native title bar: {error}");
                    }
                }
            }
            show_main_window_if_frontend_stalls(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_data,
            can_self_update,
            uses_custom_title_bar,
            set_discord_activity,
            clear_discord_activity,
            pick_project_folder,
            open_linked_projects_folder,
            open_linked_project_dir,
            allow_dropped_file,
            app_icon::apply_app_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
