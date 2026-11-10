#! /usr/bin/env bash
# AppRun hook, copied into apprun-hooks/ by scripts/patch-appimage.sh.
#
# linuxdeploy's GTK hook always sets GDK_BACKEND=x11, so on a Wayland desktop
# the app ran through XWayland. There WebKitGTK can't allocate GPU buffers on
# NVIDIA ("Failed to create GBM buffer") and falls back to a far slower path,
# and with fractional scaling XWayland also draws every frame at twice the
# size. The GTK hook forced X11 because the bundled libwayland clashed with the
# host's EGL; patch-appimage.sh removes those libraries, so native Wayland is
# safe again.
#
# patch-appimage.sh saves the launch value as APPIMAGE_LAUNCH_GDK_BACKEND
# before the GTK hook overwrites it. Order of precedence:
# 1. A GDK_BACKEND the user set at launch is kept as is.
# 2. APPIMAGE_FORCE_X11=1 keeps the old XWayland behavior.
# 3. On a Wayland session, prefer Wayland and let GTK fall back to X11.
# 4. Otherwise (an X11 session) the GTK hook's x11 stays.
#
# AppRun runs hooks under `set -e`, so nothing here may fail.

if [ -n "${APPIMAGE_LAUNCH_GDK_BACKEND:-}" ]; then
	export GDK_BACKEND="$APPIMAGE_LAUNCH_GDK_BACKEND"
elif [ "${APPIMAGE_FORCE_X11:-}" = "1" ]; then
	export GDK_BACKEND=x11
elif [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
	export GDK_BACKEND=wayland,x11
fi
unset APPIMAGE_LAUNCH_GDK_BACKEND
